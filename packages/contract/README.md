# @front-desk/contract

`openapi.yaml` describes every endpoint the web app calls. Both `apps/api` and
`apps/web` import their request and response types from here.

`src/generated/schema.d.ts` is produced from `openapi.yaml`:

```sh
npm run generate
```

Change the YAML, then regenerate. The generated file is committed so that a
fresh clone typechecks without running anything first.
