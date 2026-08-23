# Verge AI - The Fortified Enterprise Fleet

A fortified enterprise operations demo for Verge Consulting: ten customer-facing business Units, one shared deterministic ContextOps core, and a real Google ADK + Gemini extraction runtime. Demo stays write-disabled; Live remains locked.

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
- Google ADK `Runner`, `FunctionTool`, `SecurityPlugin`, Session Service, Memory Service, Agent Registry query adapter, and OpenTelemetry audit spans.
- Optimistic capacity reservations: approval moves the visible state from lock v1 to reserved v2; rollback releases it at v3.
- Input/output map and API/MCP readiness matrix.
- Validated fictional Verge data pack: 10 staff, 7 clients, 30 emails, 25 Eval scenarios.

## Run locally

```bash
npm install --cache .npm-cache
npm run data   # regenerate the portfolio model from the data pack
npm run dev
```

`npm run data` reads only `fixtures/verge-demo-pack` and writes
`lib/contextops/generated/portfolio.json` plus synchronized frontend/agent
registry artifacts. Change the pack or Unit definitions, re-run it, and both
surfaces update from the same source.

Use the exact local URL printed by the development server. If port 3000 is occupied, Vinext selects the next available port.

## Verify

```bash
npm test
npm run lint
npx tsc --noEmit
```

Validate the fixture pack independently:

```bash
cd fixtures/verge-demo-pack
node scripts/validate_pack.mjs
```

## Google ADK agent

The server-side agent uses Google ADK 2.0 and Gemini. Gemini extracts a summary,
intent and explicit urgency phrases, then must call `score_priority`; identity,
cross-account access, duplicate detection, quarantine, authorization, money,
staffing and priority remain deterministic decisions.

```bash
cd agent
npm install --cache ../.npm-cache
npm test
npm run typecheck
cp .env.example .env
# Put GEMINI_API_KEY only in agent/.env. Never commit, paste, or screenshot it.
npm run smoke
npm run build
npm start
```

`npm run smoke` makes one real Gemini request through the ADK Runner and checks
the four required acceptance cases without printing the key.

Agent endpoints:

- `GET /healthz` — runtime, state backend, model, registry count, telemetry mode.
- `POST /triage` — fixture email triage with deterministic safety gates.
- `GET /sessions/:id?user_id=<id>` — ADK session recovery.
- `GET /registry` — synchronized ten-Unit registry plus optional Cloud discovery count.
- `GET /audit.json` and `GET /audit.csv` — write-disabled compliance exports.

### State and telemetry modes

Local defaults are `CONTEXTOPS_STATE_BACKEND=memory` and
`CONTEXTOPS_TELEMETRY=console`. For persistent Vertex state, set
`CONTEXTOPS_STATE_BACKEND=vertex`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, and `VERTEX_AGENT_ENGINE_ID`, then run with Application
Default Credentials. ADK 2.0 does not accept the Gemini API key for Vertex Agent
Engine sessions or memory; the service fails closed instead of silently falling
back to memory.

Set `CONTEXTOPS_TELEMETRY=gcp` only in a Google-authenticated runtime. Set
`CONTEXTOPS_UI_ORIGIN` to the exact hosted frontend origin for cross-origin
health checks. Build the frontend with `NEXT_PUBLIC_AGENT_URL` set to the Cloud
Run service URL; otherwise it honestly shows `local endpoint`.

## Cloud Run deployment gate

The root `Dockerfile` packages the agent, shared authority rules, generated
portfolio, and required fixture data. Local preflight:

```bash
docker build -t contextops-agent .
docker run --rm -p 8080:8080 --env-file agent/.env contextops-agent
curl http://127.0.0.1:8080/healthz
```

Cloud deployment creates billable external resources, so it is intentionally
not run without explicit authorization. After approval, from the repository
root:

```bash
gcloud run deploy contextops-agent \
  --source . \
  --region australia-southeast1 \
  --project YOUR_PROJECT_ID \
  --set-env-vars CONTEXTOPS_STATE_BACKEND=memory,CONTEXTOPS_TELEMETRY=gcp \
  --set-secrets GEMINI_API_KEY=gemini-api-key:latest
```

Do not put the key directly in the command. Verify the returned `.run.app` URL
with `/healthz` before wiring `NEXT_PUBLIC_AGENT_URL`.

## Safety boundary

Tracked files contain no credentials and the product makes no external writes. `agent/.env` is local-only and ignored. Demo mode always keeps `external_write: false`; Live connectors are documented but intentionally locked.

See [architecture](docs/architecture.md), [API/MCP matrix](docs/api-mcp-matrix.md), [product spec](docs/product-spec.md), and [hackathon submission checklist](docs/hackathon-submission.md).
