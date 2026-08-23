# Hackathon Submission Checklist

## Current evidence status

| Requirement | Status | Evidence |
|---|---|---|
| Real Gemini workflow | Developer API path previously smoke-tested; Gemini 3.7 Vertex path awaiting deployed request | `agent/scripts/smoke.ts`; queued mail must call `score_priority` |
| Google ADK execution | Implemented | `Runner`, `LlmAgent`, `FunctionTool`, `SecurityPlugin` |
| Deterministic business decisions | Implemented | priority, identity, authorization, capacity, spend and approval functions |
| State and memory | Local verified; Vertex prepared | ADK in-memory services; Vertex selection requires ADC |
| Discovery and lifecycle | Local registry verified; Cloud query prepared | ten generated Unit entries; optional `AgentRegistry.listAgents()` |
| Telemetry | Local verified; Cloud exporter prepared | OTel spans plus JSON and formula-safe CSV; Cloud trace still needs deployed proof |
| Hosted Cloud Run URL | Not yet created | deploy from repository root with `--source .` |
| Hosted frontend URL | Existing hosting must be re-verified after final build | set `NEXT_PUBLIC_AGENT_URL` after Cloud Run exists |
| Vertex persistence across restart | Not yet verified | requires project, Agent Engine ID and ADC |
| Cloud screenshots and logs | Not yet captured | capture only after real deployment |
| Local container execution | Configuration complete; runtime unavailable | verification machine has no `docker` command |
| Cloud CLI preflight | Not available locally | verification machine has no `gcloud` command |

The intended hosted split is explicit: Cloud Run executes in
`australia-southeast1`, while Gemini 3.7 Flash inference uses the Vertex AI
`global` endpoint through the runtime service account's ADC. No Australian
model-processing or data-residency claim is made.

## Four-minute demo

1. **0:00–0:35 — Problem and boundary.** Show the seven-account Monday queue, ten Units, shared core, and `external_write: false`.
2. **0:35–1:15 — Real intake.** Run EM-001 through Gemini/ADK; show the `score_priority` tool call and deterministic P0 result. Then show EM-023 quarantine, EM-025 duplicate, and EM-030 cross-account rejection.
3. **1:15–2:05 — Decision quality.** Open BlueHarbor evidence/confidence and explain that the 12-hour allocation is calculated from priority, SLA, skills, available capacity, and switching cost.
4. **2:05–2:50 — Governance and concurrency.** Switch to Consultant to show denial, then General Manager approval. Show `capacity reserved · optimistic lock v2`, simulated calls, idempotency keys, and rollback to v3.
5. **2:50–3:25 — Enterprise fleet.** Open a Unit drawer and show version, contracts, connectors, approval requirement, and cross-department discovery.
6. **3:25–4:00 — Proof.** Show session recovery, `/registry`, OTel trace fields, `/audit.csv`, Cloud Run URL/health, and the test summary. End on the locked Live environment.

## Deployment proof to capture

- Cloud Run service page with service name, region, revision, and `.run.app` URL.
- `GET /healthz` returning HTTP 200 and `external_write: false`.
- One real `/triage` response and the matching OTel/Cloud trace with actor, role, evidence, task, and policy outcome.
- A matching Vertex AI request/audit entry for the same triage timestamp; if it is absent, do not claim the Vertex execution path is verified.
- `/sessions/:id` before and after a restart when Vertex state is enabled.
- `/registry` showing ten local entries and the honest Cloud discovery count.
- Frontend Agent status showing `ready · writes disabled`.
- Cloud configuration screenshots must redact environment values and never show the API key.

## Final submission fields

- Project name: **SecondKey**
- One-sentence value: Agents act on everything reversible and stop at a human for everything that is not, without giving the model authority over priority, permission, money, or staffing.
- Repository URL: pending public/private submission choice.
- Hosted frontend URL: pending final verification.
- Cloud Run agent URL: pending authorization and deployment.
- Demo video URL: pending recording after cloud proof exists.
- Architecture diagram: `docs/architecture.md`.
- Test and safety proof: root/agent test output, fixture validator, audit exports, and four adversarial fixture outcomes.
