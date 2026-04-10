import * as cdk from "aws-cdk-lib";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";

export interface EnvironmentTarget {
  name: string;
  account: string;
  region: string;
}

export interface AppConfig {
  project: string;
  application: string;
  owner?: string;
  tags?: Record<string, string>;
  naming: NamingConfig;
  environments: Record<string, EnvironmentTarget>;
  stages: StageConfig[];
}

export interface NamingConfig {
  namePrefix: string;
  ssmPrefix: string;
  secretPrefix: string;
}

export interface StageConfig {
  id: string;
  stageName: string;
  envKey: string;
  networkLookup: NetworkLookupConfig;
  search: SearchConfig;
  approvals?: ApprovalConfig;
}

export interface NetworkLookupConfig {
  envKey?: string;
  vpcIdParameterName?: string;
  privateSubnetIdsParameterName?: string;
  vpcCidr?: string;
  availabilityZones?: string[];
}

export interface SearchConfig {
  enabled: boolean;
  domainName?: string;
  engineVersion?: string;
  capacity: CapacityConfig;
  ebs: EbsConfig;
  zoneAwareness?: ZoneAwarenessConfig;
  encryption?: EncryptionConfig;
  fineGrainedAccess?: FineGrainedAccessConfig;
  logging?: LoggingConfig;
  accessPolicies?: AccessPolicyStatement[];
  removalPolicy?: "DESTROY" | "RETAIN" | "SNAPSHOT";
}

export interface CapacityConfig {
  dataNodes: number;
  dataNodeInstanceType: string;
  masterNodes?: number;
  masterNodeInstanceType?: string;
  warmNodes?: number;
  warmInstanceType?: string;
}

export interface EbsConfig {
  enabled: boolean;
  volumeSize: number;
  volumeType?: "GP2" | "GP3" | "IO1" | "STANDARD";
  iops?: number;
  throughput?: number;
}

export interface ZoneAwarenessConfig {
  enabled: boolean;
  availabilityZoneCount?: 2 | 3;
}

export interface EncryptionConfig {
  atRestEnabled?: boolean;
  nodeToNodeEncryptionEnabled?: boolean;
  enforceHttps?: boolean;
}

export interface FineGrainedAccessConfig {
  enabled: boolean;
  masterUserNameSecretName?: string;
}

export interface LoggingConfig {
  appLogEnabled?: boolean;
  slowSearchLogEnabled?: boolean;
  slowIndexLogEnabled?: boolean;
  auditLogEnabled?: boolean;
}

export interface AccessPolicyStatement {
  effect: "ALLOW" | "DENY";
  principals: string[];
  actions: string[];
}

export interface ApprovalConfig {
  requireManualApproval?: boolean;
}

export interface ResolvedStageConfig {
  id: string;
  stageName: string;
  envTarget: EnvironmentTarget;
  networkLookup: Required<NetworkLookupConfig>;
  search: ResolvedSearchConfig;
  requireManualApproval: boolean;
}

export interface ResolvedSearchConfig {
  enabled: boolean;
  domainName: string;
  engineVersion: opensearch.EngineVersion;
  capacity: Required<CapacityConfig>;
  ebs: Required<EbsConfig>;
  zoneAwareness: Required<ZoneAwarenessConfig>;
  encryption: Required<EncryptionConfig>;
  fineGrainedAccess: Required<FineGrainedAccessConfig>;
  logging: Required<LoggingConfig>;
  accessPolicies: AccessPolicyStatement[];
  removalPolicy: cdk.RemovalPolicy;
}

export interface BaseNamingProps {
  project: string;
  application: string;
  namePrefix: string;
  ssmPrefix: string;
  secretPrefix: string;
}

export interface SearchStackProps extends cdk.StackProps, BaseNamingProps {
  envTarget: EnvironmentTarget;
  networkLookup: Required<NetworkLookupConfig>;
  search: ResolvedSearchConfig;
}