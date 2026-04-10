import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { BaseNamingProps, ResolvedStageConfig } from "../types";
import { SearchStack } from "../stacks/search-stack";

export interface SearchStageProps extends cdk.StageProps, BaseNamingProps {
  resolved: ResolvedStageConfig;
}

export class SearchStage extends cdk.Stage {
  constructor(scope: Construct, id: string, props: SearchStageProps) {
    super(scope, id, props);

    if (!props.resolved.search.enabled) {
      return;
    }

    const search = new SearchStack(this, "Search", {
      env: {
        account: props.resolved.envTarget.account,
        region: props.resolved.envTarget.region,
      },
      project: props.project,
      application: props.application,
      namePrefix: props.namePrefix,
      ssmPrefix: props.ssmPrefix,
      secretPrefix: props.secretPrefix,
      envTarget: props.resolved.envTarget,
      networkLookup: props.resolved.networkLookup,
      search: props.resolved.search,
    });

    cdk.Tags.of(search).add("Project", props.project);
    cdk.Tags.of(search).add("Application", props.application);
    cdk.Tags.of(search).add("Environment", props.resolved.envTarget.name);
  }
}
