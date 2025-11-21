# @front-desk/contract

`openapi.yaml` describes every endpoint the desk app calls. `apps/api` imports
its request and response types from here.

`src/generated/schema.d.ts` is produced from `openapi.yaml`:

```sh
npm run generate
```

Change the YAML, then regenerate. The generated file is committed so that a
fresh clone typechecks without running anything first.
