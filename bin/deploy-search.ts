#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { loadAppConfig, resolveStageConfig } from "../lib/config/loader";
import { SearchStack } from "../lib/stacks/search-stack";

const app = new cdk.App();

const configPath = app.node.tryGetContext("config");
if (!configPath) {
  throw new Error("Missing CDK context key: config");
}

const config = loadAppConfig(configPath);

for (const stageConfig of config.stages) {
  const resolved = resolveStageConfig(config, stageConfig);

  new SearchStack(app, `${stageConfig.id}Search`, {
    env: {
      account: resolved.envTarget.account,
      region: resolved.envTarget.region,
    },
    project: config.project,
    application: config.application,
    namePrefix: config.naming.namePrefix,
    ssmPrefix: config.naming.ssmPrefix,
    secretPrefix: config.naming.secretPrefix,
    envTarget: resolved.envTarget,
    networkLookup: resolved.networkLookup,
    search: resolved.search,
  });
}