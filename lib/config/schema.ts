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

  for (const [key, env] of Object.entries(config.environments)) {
    if (!env.name) throw new Error(`environments.${key}.name is required`);
    if (!env.account) throw new Error(`environments.${key}.account is required`);
    if (!env.region) throw new Error(`environments.${key}.region is required`);
  }

  for (const stage of config.stages) {
    if (!stage.id) throw new Error("each stage requires id");
    if (!stage.stageName) throw new Error(`stage ${stage.id}: stageName is required`);
    if (!stage.envKey) throw new Error(`stage ${stage.id}: envKey is required`);
    if (!config.environments[stage.envKey]) {
      throw new Error(`stage ${stage.id}: envKey '${stage.envKey}' not found in environments`);
    }
    if (!stage.networkLookup) {
      throw new Error(`stage ${stage.id}: networkLookup is required`);
    }
    if (!stage.search) {
      throw new Error(`stage ${stage.id}: search is required`);
    }
    if (stage.search.enabled) {
      if (!stage.search.capacity?.dataNodes) {
        throw new Error(`stage ${stage.id}: search.capacity.dataNodes is required`);
      }
      if (!stage.search.capacity?.dataNodeInstanceType) {
        throw new Error(`stage ${stage.id}: search.capacity.dataNodeInstanceType is required`);
      }
      if (!stage.search.ebs?.volumeSize && stage.search.ebs?.enabled) {
        throw new Error(`stage ${stage.id}: search.ebs.volumeSize is required when EBS is enabled`);
      }
    }
  }
}
