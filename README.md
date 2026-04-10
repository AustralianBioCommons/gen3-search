# gen3-search

Reusable, public-safe CDK module for OpenSearch deployment.

## Deploy

```bash
npm ci
npx cdk synth -c config=./config/example.public.json
npx cdk deploy --all -c config=./config/example.public.json
```
