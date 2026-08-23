# Verge ContextOps Unit Platform

A local, deterministic demo for Verge Consulting: ten customer-facing business Units, one shared ContextOps core, and separate Demo/Live environments.

## Included

- 10 independently runnable business Unit demos.
- Monday 08:05 cross-client capacity-crisis scenario, with every priority computed from the data pack.
- Deterministic priority, identity, permission, version, and approval rules.
- Evidence-backed Context Packet and explainable confidence, with the six weighted inputs shown on demand.
- Role-based approval authority: hours, spend, client communication and cross-account reach are checked before anyone can approve.
- Post-approval execution view: the exact calls that would be made, with idempotency keys and rollback.
- Six runnable adversarial drills (injection, cross-account, duplicate, unknown sender, unsupported claim, connector failure).
- Value case with editable assumptions, and a go-live checklist for Live.
- Full audit trail with actor and evidence on every event, exportable as JSON.
- Input/output map and API/MCP readiness matrix.
- Validated fictional Verge data pack: 10 staff, 7 clients, 30 emails, 25 Eval scenarios.

## Run locally

```bash
npm install --cache .npm-cache
npm run data   # regenerate the portfolio model from the data pack
npm run dev
```

`npm run data` reads only `fixtures/verge-demo-pack` and writes
`lib/contextops/generated/portfolio.json`. Change the pack, re-run it, and the
control room changes with it — nothing on screen is hand-written.

Use the exact local URL printed by the development server. If port 3000 is occupied, Vinext selects the next available port.

## Verify

```bash
npm test    # 22 tests: rules, authority, execution, rollback, ROI, rendered HTML
npm run lint
```

Validate the fixture pack independently:

```bash
cd fixtures/verge-demo-pack
node scripts/validate_pack.mjs
```

## Safety boundary

This repository contains no credentials and makes no external writes. Demo mode always keeps `external_write: false`. Live connectors are documented but intentionally locked.

See [architecture](docs/architecture.md), [API/MCP matrix](docs/api-mcp-matrix.md), and [product spec](docs/product-spec.md).
