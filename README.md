# SecondKey

**Autonomy until it matters.** The agent holds the first key; irreversible actions wait for yours.

SecondKey is a governed enterprise-agent demo for Verge Consulting: ten customer-facing business Units, one shared deterministic ContextOps core, and a real Google ADK + Gemini extraction runtime. Reversible work can advance automatically; consequential actions stop at a human approval boundary. Demo stays write-disabled and Live remains locked.

## Verify it yourself

The hosted frontend is split deliberately: [`/`](https://secondkey.vcdw-io.workers.dev/)
is the two-minute product cover and [`/app`](https://secondkey.vcdw-io.workers.dev/app)
is the interactive control room. The public Cloud Run service can be checked in
four commands:

```bash
curl -s https://secondkey-agent-689501174668.australia-southeast2.run.app/status
curl -s https://secondkey-agent-689501174668.australia-southeast2.run.app/fleet
curl -sX POST https://secondkey-agent-689501174668.australia-southeast2.run.app/fleet/run \
  -H "Content-Type: application/json" \
  -d '{"account_id":"CL-BH","role":"Delivery Manager"}'
curl -sX POST https://secondkey-agent-689501174668.australia-southeast2.run.app/triage \
  -H "Content-Type: application/json" \
  -d '{"email_ids":["EM-001","EM-023"]}'
```

The fleet command above was verified on revision `secondkey-agent-00006-mx7`.
It returned HTTP 200 after seven Vertex requests, delegated work through all three
agents, and kept external writes disabled:

```json
{"delegation":[{"agent":"draft_agent","tools":["list_queue","build_context_packet"]},{"agent":"internal_commit_agent","tools":["commit_internal_change"]},{"agent":"external_commitment_agent","tools":["list_queue","release_external_commitment","adk_request_confirmation"]}],"external_write":false}
```

The response carried `X-RateLimit-Limit: 10` and `X-RateLimit-Remaining: 9`.
Observed business tool calls stayed within each agent's constructor-supplied tool
set. `adk_request_confirmation` is the ADK-generated confirmation protocol call,
not a cross-tier business tool; it records that the external commitment remained
paused for a named human. The redacted evidence is
[`evidence/live-fleet-run-cloudrun.json`](evidence/live-fleet-run-cloudrun.json).

The verified triage response is stored at
[`evidence/live-triage-cloudrun.json`](evidence/live-triage-cloudrun.json). Its
decision-bearing fields are:

```json
{
  "external_write": false,
  "processed_count": 2,
  "results": [
    {
      "email_id": "EM-001",
      "outcome": "queued",
      "priority": "P0",
      "tool_call": {
        "name": "score_priority",
        "args": {
          "summary": "Five priority shipments are displaying Friday ETAs instead of Wednesday ETAs ahead of an executive preview scheduled for tomorrow at 4pm.",
          "intent": "Confirm ownership within two hours and verify credibility of Wednesday production launch given incorrect shipment ETAs on the dashboard ahead of executive preview.",
          "urgency_mentions": ["URGENT", "before tomorrow executive preview", "tomorrow at 4pm", "within two hours"]
        },
        "result": {
          "priority": "P0",
          "reasons": ["Enterprise two-hour SLA, executive preview within 32 hours, unresolved data and credential blockers."]
        }
      }
    },
    {
      "email_id": "EM-023",
      "outcome": "quarantine",
      "priority": null,
      "tool_call": null
    }
  ]
}
```

`tool_call.args` is Gemini's extraction. `tool_call.result` is the deterministic
server-owned decision returned by the tool. EM-023 is quarantined before the
model, so its `tool_call` is `null`.

After the same triage request on Cloud Run revision `secondkey-agent-00004-7vb`, Cloud
Trace returned two `contextops.audit.Intake___Triage` spans: EM-001/`QUEUED` and
EM-023/`QUARANTINE`, both with `external_write:false`. The redacted trace evidence
is committed at [`evidence/cloud-trace-after-flush.json`](evidence/cloud-trace-after-flush.json).

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
- A hosted, unit-tested authority-partitioned fleet: draft, reversible internal commit, and always-confirmed external commitment tiers with disjoint constructor tool sets. `POST /fleet/run` completed all three tiers on Vertex while preserving `external_write:false`; the external tier stopped at ADK's human-confirmation protocol.
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

The current verified total is **87 tests**: 36 in the root suite (31 core + 5
rendered HTTP checks) and 51 in `agent/`.

Validate the fixture pack independently:

```bash
cd fixtures/verge-demo-pack
node scripts/validate_pack.mjs
```

## Google ADK agent

The server-side agent uses Google ADK 2.0 and Gemini 3.7 Flash. Gemini extracts a summary,
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

- `GET /status` — runtime, state backend, model, registry count, telemetry mode.
- `GET /fleet` — the three constructed fleet tiers, exact tool sets, write reach and human-gate policy.
- `POST /fleet/run` — runs the separate `secondkey_fleet` coordinator and reports observed tool calls by agent. It shares the public cost window with `/triage` and has a 15-LLM-call ceiling per request. Hosted Vertex verification completed all three tiers in seven provider calls; the external tier returned ADK's generated confirmation request and made no external write.
- `GET /healthz` — local alias of `/status`; the same path is intercepted with 404 on the current Cloud Run route, for an unresolved platform-front-door reason.
- `POST /triage` — fixture email triage with deterministic safety gates; requires an explicit batch of 1–2 `email_ids` and is globally limited to 10 requests per 10 minutes by default.
- `GET /sessions/:id?user_id=<id>` — ADK session recovery.
- `GET /registry` — synchronized ten-Unit registry plus an explicitly enabled Cloud discovery count.
- `GET /audit.json` and `GET /audit.csv` — write-disabled compliance exports.

`GET /status` reports `model`, `model_backend`, and `model_location`; the hosted
proof is accepted only when these read `gemini-3.7-flash`, `vertex`, and
`global`, followed by a successful real triage and matching cloud evidence.

The active production triage path remains one ADK `LlmAgent` in a `Runner`, forced
to call `score_priority`; `/triage` was not changed for this fleet experiment.
`agent/src/server.ts` mounts the separate three-tier `SequentialAgent` at
`POST /fleet/run`. Developer API quota prevented the final local run, so acceptance
was performed on the deployed Vertex path. Revision `secondkey-agent-00006-mx7`
returned all three agents after seven provider calls. Their business calls stayed
within the disjoint `tools` arrays, and the external tier stopped at the ADK-generated
`adk_request_confirmation` step with `confirmed:false` and `external_write:false`.

### State and telemetry modes

Local defaults use the Gemini Developer API via `GEMINI_API_KEY`,
`CONTEXTOPS_STATE_BACKEND=memory`, and `CONTEXTOPS_TELEMETRY=console`.
Cloud Run sets `GOOGLE_GENAI_USE_VERTEXAI=true`, `GOOGLE_CLOUD_PROJECT`, and
`GOOGLE_CLOUD_LOCATION=global`; the ADK then uses the Cloud Run service
account's Application Default Credentials and no Gemini key is injected.

For persistent Vertex state, set
`CONTEXTOPS_STATE_BACKEND=vertex`, `GOOGLE_CLOUD_PROJECT`,
`GOOGLE_CLOUD_LOCATION`, and `VERTEX_AGENT_ENGINE_ID`, then run with Application
Default Credentials. ADK 2.0 does not accept the Gemini API key for Vertex Agent
Engine sessions or memory; the service fails closed instead of silently falling
back to memory.

Cloud Agent Registry discovery is independently prepared and defaults off. Set
`CONTEXTOPS_CLOUD_REGISTRY=true` only after that cloud resource is deployed and
verified; model project/location variables alone never enable it.

Set `CONTEXTOPS_TELEMETRY=gcp` only in a Google-authenticated runtime. The final
Cloud Run deployment verified the two audit spans above after request-end
`forceFlush()`. Set
`CONTEXTOPS_UI_ORIGIN=https://secondkey.vcdw-io.workers.dev` for cross-origin
status checks. Build the frontend with `NEXT_PUBLIC_AGENT_URL` set to the Cloud
Run service URL; otherwise it honestly shows `local endpoint`. The current
hosted frontend shows `ready · writes disabled` after a successful `/status`
probe. Its interactive Monday scenario is still the deterministic in-browser
demo; the badge is reachability evidence, not proof that each UI step calls Cloud Run.

`lib/contextops/execution.ts` intentionally has no imports. Both the frontend
and agent service consume the same simulated-call and idempotency-key logic
without pulling either build across its runtime boundary.

## Cloud Run deployment gate

The root `Dockerfile` packages the agent, shared authority rules, generated
portfolio, and required fixture data. Local preflight:

```bash
docker build -t secondkey-agent .
docker run --rm -p 8080:8080 --env-file agent/.env secondkey-agent
curl http://127.0.0.1:8080/status
```

Cloud deployment creates billable external resources. Use a dedicated runtime
service account instead of the Compute Engine default account. From the
repository root:

```bash
gcloud iam service-accounts create secondkey-runner \
  --display-name="SecondKey Cloud Run runtime"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:secondkey-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/aiplatform.user"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:secondkey-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudtrace.agent"

gcloud run deploy secondkey-agent \
  --source . \
  --region australia-southeast2 \
  --project YOUR_PROJECT_ID \
  --service-account secondkey-runner@YOUR_PROJECT_ID.iam.gserviceaccount.com \
  --allow-unauthenticated \
  --max-instances=1 \
  --set-env-vars GOOGLE_GENAI_USE_VERTEXAI=true,GOOGLE_CLOUD_PROJECT=YOUR_PROJECT_ID,GOOGLE_CLOUD_LOCATION=global,GEMINI_MODEL=gemini-3.7-flash,CONTEXTOPS_STATE_BACKEND=memory,CONTEXTOPS_TELEMETRY=gcp,CONTEXTOPS_UI_ORIGIN=https://secondkey.vcdw-io.workers.dev,CONTEXTOPS_TRIAGE_RATE_LIMIT=10,CONTEXTOPS_TRIAGE_RATE_WINDOW_MS=600000,CONTEXTOPS_FLEET_MAX_LLM_CALLS=15
```

Cloud Run targets an Australia region; Gemini inference uses the Vertex AI
`global` endpoint. The CLI command above retains the provider's exact region
identifier. This configuration does not claim Australian model processing or
data residency. Keep the service private until its invocation
policy is chosen, then verify `/status`, one real `/triage` request, and the
corresponding Vertex/Cloud trace before wiring `NEXT_PUBLIC_AGENT_URL`.

`--max-instances=1` limits scale, not request rate or spend. The submission makes
`/triage` and `/fleet/run` share a 10-request/10-minute single-instance window,
retains the two-id triage batch cap, and limits one fleet request to 15 LLM calls.
Those in-memory controls are not a production distributed gateway or hard budget.
Keep max instances at one, add quota/budget alerts, and remove public invocation
after judging unless it becomes an explicit product requirement.

For a private service, verify with an identity token rather than making the
cost-bearing triage endpoint public:

```bash
SERVICE_URL="$(gcloud run services describe secondkey-agent \
  --region australia-southeast2 \
  --project YOUR_PROJECT_ID \
  --format='value(status.url)')"
IDENTITY_TOKEN="$(gcloud auth print-identity-token)"

curl -H "Authorization: Bearer ${IDENTITY_TOKEN}" "${SERVICE_URL}/status"
curl -X POST \
  -H "Authorization: Bearer ${IDENTITY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"email_ids":["EM-001"]}' \
  "${SERVICE_URL}/triage"
```

## Safety boundary

Tracked files contain no credentials and the product makes no external writes. `agent/.env` is local-only and ignored. Demo mode always keeps `external_write: false`; Live connectors are documented but intentionally locked.

See [architecture](docs/architecture.md), [API/MCP matrix](docs/api-mcp-matrix.md), [product spec](docs/product-spec.md), and [hackathon submission checklist](docs/hackathon-submission.md).
