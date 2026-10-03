# Front Desk

A tiny help desk. Customer emails become tickets; teammates reply, tag,
assign, and close them, and a badge counts down each ticket's SLA in business
hours.

## Requirements

- Node 24.15 or later (`nvm use` reads `.nvmrc`)
- That's it: no Docker, no database server, no API keys.

## Getting going

```sh
npm install
npm run dev
```

Open http://localhost:5173.

To have a new email arrive:

```sh
npm run mail:drop -- refund-request
```

Run `npm run mail:drop` with no arguments to list the fixtures.

## Scripts

| Script                        | What it does                                         |
| ----------------------------- | ---------------------------------------------------- |
| `npm run dev`                 | API on :4100 with the mailroom polling, web on :5173 |
| `npm test`                    | Vitest: the `api`, `web`, and `legacy` projects      |
| `npm run typecheck`           | TypeScript, every workspace                          |
| `npm run lint`                | ESLint                                               |
| `npm run generate`            | Rebuild the API types from `openapi.yaml`            |
| `npm run mail:drop -- <name>` | Copy a fixture from `fixtures/mail/` into `inbox/`   |

## Layout

```
apps/api            Express 5 API (TypeScript)
apps/web            React 19 app
packages/contract   openapi.yaml and the types generated from it
legacy              the 2019 mailroom (CommonJS)
vendor              third-party code we keep a copy of
inbox               incoming mail
fixtures/mail       sample mail for mail:drop
docs                architecture notes
```

See [docs/architecture.md](docs/architecture.md) for how the pieces fit.
