import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { SearchStackProps } from "../types";

function parseSubnetIds(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function resolveEbsVolumeType(value: string): ec2.EbsDeviceVolumeType {
  switch (value) {
    case "GP2":
      return ec2.EbsDeviceVolumeType.GP2;
    case "GP3":
      return ec2.EbsDeviceVolumeType.GP3;
    case "IO1":
      return ec2.EbsDeviceVolumeType.IO1;
    case "STANDARD":
      return ec2.EbsDeviceVolumeType.STANDARD;
    default:
      throw new Error(`Unsupported EBS volume type: ${value}`);
  }
}

export class SearchStack extends cdk.Stack {
  public readonly domain: opensearch.Domain;

  constructor(scope: Construct, id: string, props: SearchStackProps) {
    super(scope, id, props);

    const envName = props.envTarget.name;
    const qualifiedName = `${props.namePrefix}-${envName}`;

    const vpcId = ssm.StringParameter.valueForStringParameter(this, props.networkLookup.vpcIdParameterName);
    const subnetIds = parseSubnetIds(
      ssm.StringParameter.valueForStringParameter(this, props.networkLookup.privateSubnetIdsParameterName)
    );

    const vpc = ec2.Vpc.fromLookup(this, "Vpc", { vpcId });
    const subnets = subnetIds.map((subnetId, index) =>
      ec2.Subnet.fromSubnetId(this, `ImportedSubnet${index}`, subnetId)
    );

    const securityGroup = new ec2.SecurityGroup(this, "SearchSecurityGroup", {
      vpc,
      allowAllOutbound: true,
      description: `Security group for ${qualifiedName} OpenSearch domain`,
    });

    securityGroup.addIngressRule(ec2.Peer.ipv4(vpc.vpcCidrBlock), ec2.Port.tcp(443), "Allow HTTPS from within VPC");

    const logging: opensearch.LoggingOptions = {
      ...(props.search.logging.appLogEnabled
        ? {
          appLogEnabled: true,
          appLogGroup: new logs.LogGroup(this, "AppLogGroup", {
            logGroupName: `/aws/opensearch/${qualifiedName}/application-logs`,
            removalPolicy: props.search.removalPolicy,
          }),
        }
        : {}),

      ...(props.search.logging.slowSearchLogEnabled
        ? {
          slowSearchLogEnabled: true,
          slowSearchLogGroup: new logs.LogGroup(this, "SlowSearchLogGroup", {
            logGroupName: `/aws/opensearch/${qualifiedName}/slow-search-logs`,
            removalPolicy: props.search.removalPolicy,
          }),
        }
        : {}),

      ...(props.search.logging.slowIndexLogEnabled
        ? {
          slowIndexLogEnabled: true,
          slowIndexLogGroup: new logs.LogGroup(this, "SlowIndexLogGroup", {
            logGroupName: `/aws/opensearch/${qualifiedName}/slow-index-logs`,
            removalPolicy: props.search.removalPolicy,
          }),
        }
        : {}),

      ...(props.search.logging.auditLogEnabled
        ? {
          auditLogEnabled: true,
          auditLogGroup: new logs.LogGroup(this, "AuditLogGroup", {
            logGroupName: `/aws/opensearch/${qualifiedName}/audit-logs`,
            removalPolicy: props.search.removalPolicy,
          }),
        }
        : {}),
    };

    let fineGrainedAccessControl:
      | opensearch.AdvancedSecurityOptions
      | undefined;

    if (props.search.fineGrainedAccess.enabled) {
      if (!props.search.fineGrainedAccess.masterUserNameSecretName) {
        throw new Error("fineGrainedAccess.masterUserNameSecretName is required when fine-grained access is enabled");
      }

      const masterSecret = secretsmanager.Secret.fromSecretNameV2(
        this,
        "MasterUserSecret",
        props.search.fineGrainedAccess.masterUserNameSecretName
      );

      fineGrainedAccessControl = {
        masterUserName: masterSecret.secretValueFromJson("username").toString(),
        masterUserPassword: masterSecret.secretValueFromJson("password"),
      };
    }

    this.domain = new opensearch.Domain(this, "Domain", {
      domainName: props.search.domainName,
      version: props.search.engineVersion,
      capacity: {
        dataNodes: props.search.capacity.dataNodes,
        dataNodeInstanceType: props.search.capacity.dataNodeInstanceType,
        masterNodes: props.search.capacity.masterNodes > 0 ? props.search.capacity.masterNodes : undefined,
        masterNodeInstanceType:
          props.search.capacity.masterNodes > 0 ? props.search.capacity.masterNodeInstanceType : undefined,
        warmNodes: props.search.capacity.warmNodes > 0 ? props.search.capacity.warmNodes : undefined,
        warmInstanceType:
          props.search.capacity.warmNodes > 0 ? props.search.capacity.warmInstanceType : undefined,
      },
      ebs: {
        enabled: props.search.ebs.enabled,
        volumeSize: props.search.ebs.volumeSize,
        volumeType: resolveEbsVolumeType(props.search.ebs.volumeType),
        iops: props.search.ebs.volumeType === "IO1" || props.search.ebs.volumeType === "GP3" ? props.search.ebs.iops : undefined,
        throughput: props.search.ebs.volumeType === "GP3" ? props.search.ebs.throughput : undefined,
      },
      zoneAwareness: {
        enabled: props.search.zoneAwareness.enabled,
        availabilityZoneCount: props.search.zoneAwareness.availabilityZoneCount,
      },
      enforceHttps: props.search.encryption.enforceHttps,
      nodeToNodeEncryption: props.search.encryption.nodeToNodeEncryptionEnabled,
      encryptionAtRest: {
        enabled: props.search.encryption.atRestEnabled,
      },
      fineGrainedAccessControl,
      logging,
      removalPolicy: props.search.removalPolicy,
      vpc,
      securityGroups: [securityGroup],
      vpcSubnets: [{ subnets }],
    });

    for (const statement of props.search.accessPolicies) {
      this.domain.addAccessPolicies(
        new iam.PolicyStatement({
          effect: statement.effect === "ALLOW" ? iam.Effect.ALLOW : iam.Effect.DENY,
          principals: statement.principals.map((arn) => new iam.ArnPrincipal(arn)),
          actions: statement.actions,
          resources: [`${this.domain.domainArn}/*`, this.domain.domainArn],
        })
      );
    }

    new ssm.StringParameter(this, "DomainArnParameter", {
      parameterName: `${props.ssmPrefix}/${props.project}/${props.application}/${envName}/search-domain-arn`,
      stringValue: this.domain.domainArn,
    });

    new ssm.StringParameter(this, "DomainEndpointParameter", {
      parameterName: `${props.ssmPrefix}/${props.project}/${props.application}/${envName}/search-endpoint`,
      stringValue: `https://${this.domain.domainEndpoint}`,
    });

    new cdk.CfnOutput(this, "DomainArn", {
      value: this.domain.domainArn,
      exportName: `${qualifiedName}-search-domain-arn`,
    });

    new cdk.CfnOutput(this, "DomainEndpoint", {
      value: `https://${this.domain.domainEndpoint}`,
      exportName: `${qualifiedName}-search-endpoint`,
    });
  }
}
