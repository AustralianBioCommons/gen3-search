import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import {
  AppConfig,
  EbsConfig,
  EnvironmentTarget,
  ResolvedSearchConfig,
  ResolvedStageConfig,
  SearchConfig,
  StageConfig,
} from "../types";
import { validateConfig } from "./schema";

export function loadAppConfig(configPath: string): AppConfig {
  const absolutePath = path.resolve(configPath);
  const raw = fs.readFileSync(absolutePath, "utf8");
  const config = JSON.parse(raw) as AppConfig;
  validateConfig(config);
  return config;
}

function resolveEnvironmentTarget(
  environments: Record<string, EnvironmentTarget>,
  envKey: string
): EnvironmentTarget {
  const resolved = environments[envKey];
  if (!resolved) {
    throw new Error(`Unknown envKey: ${envKey}`);
  }
  return resolved;
}

function resolveRemovalPolicy(value?: string): cdk.RemovalPolicy {
  switch ((value ?? "RETAIN").toUpperCase()) {
    case "DESTROY":
      return cdk.RemovalPolicy.DESTROY;
    case "SNAPSHOT":
      return cdk.RemovalPolicy.SNAPSHOT;
    default:
      return cdk.RemovalPolicy.RETAIN;
  }
}

function resolveEngineVersion(value?: string): opensearch.EngineVersion {
  switch ((value ?? "OPENSEARCH_2_17").toUpperCase()) {
    case "OPENSEARCH_2_19":
      return opensearch.EngineVersion.OPENSEARCH_2_19;
    case "OPENSEARCH_2_17":
      return opensearch.EngineVersion.OPENSEARCH_2_17;
    case "OPENSEARCH_2_15":
      return opensearch.EngineVersion.OPENSEARCH_2_15;
    case "OPENSEARCH_2_13":
      return opensearch.EngineVersion.OPENSEARCH_2_13;
    default:
      throw new Error(`Unsupported engine version: ${value}`);
  }
}

function resolveEbsDefaults(ebs?: EbsConfig): Required<EbsConfig> {
  return {
    enabled: ebs?.enabled ?? true,
    volumeSize: ebs?.volumeSize ?? 100,
    volumeType: ebs?.volumeType ?? "GP3",
    iops: ebs?.iops ?? 3000,
    throughput: ebs?.throughput ?? 125,
  };
}

function resolveSearchConfig(
  appConfig: AppConfig,
  envName: string,
  search: SearchConfig
): ResolvedSearchConfig {
  const ebs = resolveEbsDefaults(search.ebs);
  return {
    enabled: search.enabled,
    domainName: search.domainName ?? `${appConfig.naming.namePrefix}-${envName}`,
    engineVersion: resolveEngineVersion(search.engineVersion),
    capacity: {
      dataNodes: search.capacity.dataNodes,
      dataNodeInstanceType: search.capacity.dataNodeInstanceType,
      masterNodes: search.capacity.masterNodes ?? 0,
      masterNodeInstanceType: search.capacity.masterNodeInstanceType ?? "",
      warmNodes: search.capacity.warmNodes ?? 0,
      warmInstanceType: search.capacity.warmInstanceType ?? "",
    },
    ebs,
    zoneAwareness: {
      enabled: search.zoneAwareness?.enabled ?? true,
      availabilityZoneCount: search.zoneAwareness?.availabilityZoneCount ?? 2,
    },
    encryption: {
      atRestEnabled: search.encryption?.atRestEnabled ?? true,
      nodeToNodeEncryptionEnabled: search.encryption?.nodeToNodeEncryptionEnabled ?? true,
      enforceHttps: search.encryption?.enforceHttps ?? true,
    },
    fineGrainedAccess: {
      enabled: search.fineGrainedAccess?.enabled ?? false,
      masterUserNameSecretName: search.fineGrainedAccess?.masterUserNameSecretName ?? "",
    },
    logging: {
      appLogEnabled: search.logging?.appLogEnabled ?? true,
      slowSearchLogEnabled: search.logging?.slowSearchLogEnabled ?? true,
      slowIndexLogEnabled: search.logging?.slowIndexLogEnabled ?? true,
      auditLogEnabled: search.logging?.auditLogEnabled ?? false,
    },
    accessPolicies: search.accessPolicies ?? [],
    removalPolicy: resolveRemovalPolicy(search.removalPolicy),
  };
}

export function resolveStageConfig(
  appConfig: AppConfig,
  stage: StageConfig
): ResolvedStageConfig {
  const envTarget = resolveEnvironmentTarget(appConfig.environments, stage.envKey);
  const networkEnvKey = stage.networkLookup.envKey ?? stage.envKey;

  return {
    id: stage.id,
    stageName: stage.stageName,
    envTarget,
    networkLookup: {
      envKey: networkEnvKey,
      vpcIdParameterName:
        stage.networkLookup.vpcIdParameterName ??
        `${appConfig.naming.ssmPrefix}/${appConfig.project}/${appConfig.application}/${networkEnvKey}/vpc-id`,
      privateSubnetIdsParameterName:
        stage.networkLookup.privateSubnetIdsParameterName ??
        `${appConfig.naming.ssmPrefix}/${appConfig.project}/${appConfig.application}/${networkEnvKey}/private-subnet-ids`,
    },
    search: resolveSearchConfig(appConfig, envTarget.name, stage.search),
    requireManualApproval: stage.approvals?.requireManualApproval ?? false,
  };
}
