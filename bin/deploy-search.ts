#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { loadAppConfig, resolveStageConfig } from "../lib/config/loader";
import { SearchStage } from "../lib/stages/search-stage";

const app = new cdk.App();
const configPath = app.node.tryGetContext("config");

if (!configPath) {
  throw new Error("Missing CDK context key: config");
}

const config = loadAppConfig(configPath);

cdk.Tags.of(app).add("Project", config.project);
cdk.Tags.of(app).add("Application", config.application);

if (config.owner) {
  cdk.Tags.of(app).add("Owner", config.owner);
}

for (const [key, value] of Object.entries(config.tags ?? {})) {
  cdk.Tags.of(app).add(key, value);
}

for (const stageConfig of config.stages) {
  const resolved = resolveStageConfig(config, stageConfig);

  new SearchStage(app, stageConfig.id, {
    env: {
      account: resolved.envTarget.account,
      region: resolved.envTarget.region,
    },
    project: config.project,
    application: config.application,
    namePrefix: config.naming.namePrefix,
    ssmPrefix: config.naming.ssmPrefix,
    secretPrefix: config.naming.secretPrefix,
    resolved,
  });
}
