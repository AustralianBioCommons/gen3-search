import * as fs from "fs";
import * as path from "path";
import * as cdk from "aws-cdk-lib";
import * as opensearch from "aws-cdk-lib/aws-opensearchservice";
import {
  AppConfig,
  EnvironmentTarget,
  ResolvedSearchConfig,
  ResolvedStageConfig,
  SearchConfig,
  StageConfig,
} from "../types";
import { validateConfig } from "./schema";

export function loadAppConfig(configPath: string): AppConfig {
  const absolutePath = path.resolve(configPath);
  const config = JSON.parse(fs.readFileSync(absolutePath, "utf8")) as AppConfig;
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

function resolveEngineVersion(value: string): opensearch.EngineVersion {
  switch (value) {
    case "OpenSearch_2_17":
      return opensearch.EngineVersion.OPENSEARCH_2_17;
    case "OpenSearch_2_15":
      return opensearch.EngineVersion.OPENSEARCH_2_15;
    case "OpenSearch_2_13":
      return opensearch.EngineVersion.OPENSEARCH_2_13;
    case "OpenSearch_2_11":
      return opensearch.EngineVersion.OPENSEARCH_2_11;
    case "OpenSearch_2_9":
      return opensearch.EngineVersion.OPENSEARCH_2_9;
    default:
      throw new Error(`Unsupported engine version: ${value}`);
  }
}

function resolveSearchConfig(search: SearchConfig): ResolvedSearchConfig {
  if (!search.domainName) throw new Error("search.domainName is required");
  if (!search.engineVersion) throw new Error("search.engineVersion is required");

  return {
    enabled: search.enabled,
    domainName: search.domainName,
    engineVersion: resolveEngineVersion(search.engineVersion),
    capacity: {
      dataNodes: search.capacity.dataNodes,
      dataNodeInstanceType: search.capacity.dataNodeInstanceType,
      masterNodes: search.capacity.masterNodes ?? 0,
      masterNodeInstanceType: search.capacity.masterNodeInstanceType ?? "",
      warmNodes: search.capacity.warmNodes ?? 0,
      warmInstanceType: search.capacity.warmInstanceType ?? "",
    },
    ebs: {
      enabled: search.ebs.enabled,
      volumeSize: search.ebs.volumeSize,
      volumeType: search.ebs.volumeType ?? "GP3",
      iops: search.ebs.iops ?? 3000,
      throughput: search.ebs.throughput ?? 125,
    },
    zoneAwareness: {
      enabled: search.zoneAwareness?.enabled ?? false,
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
      appLogEnabled: search.logging?.appLogEnabled ?? false,
      slowSearchLogEnabled: search.logging?.slowSearchLogEnabled ?? false,
      slowIndexLogEnabled: search.logging?.slowIndexLogEnabled ?? false,
      auditLogEnabled: search.logging?.auditLogEnabled ?? false,
    },
    accessPolicies: search.accessPolicies ?? [],
    removalPolicy: resolveRemovalPolicy(search.removalPolicy),
  };
}

export function resolveStageConfig(appConfig: AppConfig, stage: StageConfig): ResolvedStageConfig {
  const envTarget = resolveEnvironmentTarget(appConfig.environments, stage.envKey);

  return {
    id: stage.id,
    stageName: stage.stageName,
    envTarget,
    networkLookup: {
      envKey: stage.networkLookup.envKey ?? stage.envKey,
      vpcIdParameterName: stage.networkLookup.vpcIdParameterName!,
      privateSubnetIdsParameterName: stage.networkLookup.privateSubnetIdsParameterName!,
      vpcCidr: stage.networkLookup.vpcCidr!,
      availabilityZones: stage.networkLookup.availabilityZones!,
    },
    search: resolveSearchConfig(stage.search),
    requireManualApproval: stage.approvals?.requireManualApproval ?? false,
  };
}