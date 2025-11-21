# Front Desk

A tiny help desk. Customer emails become tickets; teammates reply, tag,
assign, and close them, and every ticket has an SLA clock in business hours.

## Requirements

- Node 24.11 or later (`nvm use` reads `.nvmrc`)
- That's it: no Docker, no database server, no API keys.

## Getting going

```sh
npm install
npm run dev
```

The API listens on http://localhost:4100.

To have a new email arrive:

```sh
npm run mail:drop -- refund-request
```

Run `npm run mail:drop` with no arguments to list the fixtures.

## Scripts

| Script                        | What it does                                         |
| ----------------------------- | ---------------------------------------------------- |
| `npm run dev`                 | API on :4100 with the mailroom polling               |
| `npm test`                    | Vitest: the `api` project                            |
| `npm run typecheck`           | TypeScript, every workspace                          |
| `npm run lint`                | ESLint                                               |
| `npm run generate`            | Rebuild the API types from `openapi.yaml`            |
| `npm run mail:drop -- <name>` | Copy a fixture from `fixtures/mail/` into `inbox/`   |

## Layout

```
apps/api            Express 5 API (TypeScript)
packages/contract   openapi.yaml and the types generated from it
legacy              the 2019 mailroom (CommonJS)
vendor              third-party code we keep a copy of
inbox               incoming mail
fixtures/mail       sample mail for mail:drop
docs                architecture notes
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.
