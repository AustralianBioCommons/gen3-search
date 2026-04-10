import { AppConfig } from "../types";

export function validateConfig(config: AppConfig): void {
  if (!config.project) throw new Error("project is required");
  if (!config.application) throw new Error("application is required");

  if (!config.naming?.namePrefix) throw new Error("naming.namePrefix is required");
  if (!config.naming?.ssmPrefix) throw new Error("naming.ssmPrefix is required");
  if (!config.naming?.secretPrefix) throw new Error("naming.secretPrefix is required");

  if (!config.environments || Object.keys(config.environments).length === 0) {
    throw new Error("environments is required");
  }

  if (!Array.isArray(config.stages) || config.stages.length === 0) {
    throw new Error("at least one stage is required");
  }

  for (const stage of config.stages) {
    if (!stage.id) throw new Error("each stage requires id");
    if (!stage.stageName) throw new Error(`stage ${stage.id}: stageName is required`);
    if (!stage.envKey) throw new Error(`stage ${stage.id}: envKey is required`);

    if (!config.environments[stage.envKey]) {
      throw new Error(`stage ${stage.id}: envKey '${stage.envKey}' not found in environments`);
    }

    if (!stage.networkLookup?.vpcIdParameterName) {
      throw new Error(`stage ${stage.id}: networkLookup.vpcIdParameterName is required`);
    }
    if (!stage.networkLookup?.privateSubnetIdsParameterName) {
      throw new Error(`stage ${stage.id}: networkLookup.privateSubnetIdsParameterName is required`);
    }
    if (!stage.networkLookup?.vpcCidr) {
      throw new Error(`stage ${stage.id}: networkLookup.vpcCidr is required`);
    }
    if (!stage.networkLookup?.availabilityZones || stage.networkLookup.availabilityZones.length === 0) {
      throw new Error(`stage ${stage.id}: networkLookup.availabilityZones is required`);
    }

    if (!stage.search) {
      throw new Error(`stage ${stage.id}: search is required`);
    }

    if (stage.search.enabled) {
      if (!stage.search.domainName) {
        throw new Error(`stage ${stage.id}: search.domainName is required`);
      }
      if (!stage.search.engineVersion) {
        throw new Error(`stage ${stage.id}: search.engineVersion is required`);
      }
      if (!stage.search.capacity) {
        throw new Error(`stage ${stage.id}: search.capacity is required`);
      }
      if (!stage.search.ebs) {
        throw new Error(`stage ${stage.id}: search.ebs is required`);
      }
    }
  }
}