# Hackathon Submission Checklist

## Current evidence status

| Requirement | Status | Evidence and boundary |
|---|---|---|
| Real Gemini workflow | Verified on hosted Cloud Run | `/status` reports `gemini-3.7-flash`, `vertex`, `global`; `evidence/live-triage-cloudrun.json` records a real `score_priority` call |
| Google ADK execution | Verified, single-agent active path | Production invokes ADK `Runner`, `LlmAgent`, forced `FunctionTool`, in-memory Session/Memory services and `SecurityPlugin` |
| Three-agent fleet | Constructed and unit-tested; not active in `/triage` | `/fleet` exposes the three disjoint tool sets; `createFleet()` is currently referenced only by tests |
| Deterministic business decisions | Implemented | priority, identity, authorization, capacity, spend and approval functions; the model only extracts |
| State and memory | Local in-memory verified; Vertex prepared | `CONTEXTOPS_STATE_BACKEND=memory`; no cross-restart or multi-week proof |
| Discovery and lifecycle | Local registry verified; Cloud query disabled | ten generated Unit entries; `CONTEXTOPS_CLOUD_REGISTRY=false` |
| Telemetry | Local spans and forced flush verified | Cloud exporter enabled; Cloud Trace landing must be re-verified after final deployment |
| Hosted Cloud Run URL | Verified | public service in `australia-southeast2`; `/status`, `/fleet`, `/registry`, `/audit.*` and `/triage` respond |
| `/healthz` | Known exception | local alias works; Cloud Run front door returns 404, so published checks use `/status` |
| Hosted frontend URL | Verified interactive demo | `/` cover and `/app` control room work; current build says `local endpoint` and does not depend on Cloud Run |
| Tests | Verified locally | 83 total: 36 root (31 core + 5 rendered HTTP), 47 agent |

Cloud Run executes in `australia-southeast2`, while Gemini 3.7 Flash inference uses
Vertex AI's `global` endpoint through runtime service-account ADC. No Australian
model-processing or data-residency claim is made.

## Submission-rule gate

- The demo video must be public on YouTube or Vimeo, no longer than four minutes,
  English or English-subtitled, and show an unedited live execution plus visual proof
  that the backend runs on Google Cloud.
- The public repository must contain reproducible setup instructions and a clear
  architecture diagram.
- Devpost must disclose that the deterministic ContextOps core and fictional data pack
  existed before the submission period. The data pack contains no real people or
  customers and all email addresses use `.example`.
- Eligibility still rests with the judges because the official rule says the Project
  must be newly created during the submission period while also requiring disclosure
  of incorporated pre-existing work. Do not describe the pre-existing core/data as
  newly built.

## Four-minute demo

1. **0:00–0:30 — Problem and boundary.** Seven-account Monday queue; model extracts,
   deterministic code decides; `external_write: false`.
2. **0:30–1:15 — Unedited real agent execution.** Run the two-email curl live. Show
   EM-001's Gemini-extracted `args`, deterministic P0 `result`, and EM-023's null tool
   call because quarantine happened before Gemini.
3. **1:15–2:05 — Decision quality.** Run the Monday scenario, open confidence inputs,
   and show the computed 12-hour allocation and honest shortfall behavior.
4. **2:05–2:50 — Governance.** Switch to Consultant for four denial reasons; switch to
   General Manager; open the approval packet and explain DENY versus CONFIRM.
5. **2:50–3:25 — Security and audit.** Fire prompt injection; show the exact blocking
   rule, decision trace, idempotency keys and rollback.
6. **3:25–3:50 — Google Cloud proof.** Show Cloud Run service/region/URL, `/status`,
   Vertex model evidence and a matching Cloud Trace span if available.
7. **3:50–4:00 — Honest close.** 83 tests; fleet constructed but not mounted; persistent
   memory, cloud identity/gateway and Model Armor not implemented in the submission.

Do not present `/fleet` JSON as proof of live multi-agent delegation. If the fleet is
not mounted before recording, say exactly that and frame it as the primary next step.

## Deployment proof to capture

- Cloud Run service name, `australia-southeast2`, current revision and `.run.app` URL.
- `GET /status` with `external_write:false`, `model_backend:"vertex"`, model and location.
- `GET /fleet` with the three agents and their exact tools/human gates, explicitly
  labelled as construction evidence.
- Real `/triage` response for EM-001 and EM-023.
- Matching `contextops.audit.*` Cloud Trace span after the final flush deployment; if
  absent, use the documented downgrade and do not claim cloud observability.
- Frontend `/` and `/app`; status badge should show either truthful `local endpoint` or
  `ready · writes disabled` after CORS and build-time endpoint wiring.
- Configuration screenshots must redact environment values and never show any key,
  token or credential.

## Public cost gate

`POST /triage` is unauthenticated and invokes Vertex. The current Cloud Run settings
are max instances 1, concurrency 80, timeout 300 seconds. One request without
`email_ids` processes the 30-message pack and can make 18 model calls. Max instances
therefore limits scale but does not cap requests or spend. Before leaving the endpoint
public for judging, add a server-side rate limiter, cap batches to two ids, and create
quota/budget alerts; after judging, remove `allUsers` unless public invocation is a
product requirement.

## Final submission fields

- Project name: **SecondKey**
- Track: **The Fortified Enterprise Fleet**
- One-sentence value: Agents act on everything reversible and stop at a human for
  everything irreversible, without giving the model authority over priority,
  permission, money or staffing.
- Repository: `https://github.com/vcdwio/secondkey`
- Hosted frontend: `https://secondkey.vcdw-io.workers.dev/`
- Hosted control room: `https://secondkey.vcdw-io.workers.dev/app`
- Cloud Run agent: `https://secondkey-agent-689501174668.australia-southeast2.run.app`
- Architecture diagram: `ARCHITECTURE_DIAGRAM.md`
- Video URL: pending recording and public YouTube/Vimeo upload.
- Bonus: public build content +0.2; social post with
  `#AllThingsAgenticHackathon` +0.2; each additional integrated Google model +0.2 up
  to +0.6. No bonus is earned merely by planning it.
