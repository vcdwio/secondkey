# Hackathon Submission Checklist

## Current evidence status

| Requirement | Status | Evidence and boundary |
|---|---|---|
| Real Gemini workflow | Verified on hosted Cloud Run | `/status` reports `gemini-3.7-flash`, `vertex`, `global`; `evidence/live-triage-cloudrun.json` records a real `score_priority` call |
| Google ADK execution | Verified, single-agent active path | Production invokes ADK `Runner`, `LlmAgent`, forced `FunctionTool`, in-memory Session/Memory services and `SecurityPlugin` |
| Three-agent fleet | Mounted separately; full live delegation not verified | `/fleet/run` executes the coordinator, but the original local Gemini run emitted tool calls from only draft and internal; two prompt-only attempts still missed all-three acceptance |
| Deterministic business decisions | Implemented | priority, identity, authorization, capacity, spend and approval functions; the model only extracts |
| State and memory | Local in-memory verified; Vertex prepared | `CONTEXTOPS_STATE_BACKEND=memory`; no cross-restart or multi-week proof |
| Discovery and lifecycle | Local registry verified; Cloud query disabled | ten generated Unit entries; `CONTEXTOPS_CLOUD_REGISTRY=false` |
| Telemetry | Verified locally and in Cloud Trace | final revision produced two `contextops.audit.Intake___Triage` spans; redacted evidence committed |
| Hosted Cloud Run URL | Verified | revision `secondkey-agent-00005-h2f` serves 100% in `australia-southeast2`; `/status`, `/fleet`, `/registry`, `/audit.*` and `/triage` respond; `/fleet/run` is mounted but fails closed at its 15-call ceiling |
| `/healthz` | Known exception | local alias works; Cloud Run front door returns 404, so published checks use `/status` |
| Hosted frontend URL | Verified interactive demo + backend status probe | `/` cover and `/app` work; current build shows `ready · writes disabled` after cross-origin `/status`; the Monday scenario itself remains deterministic in-browser |
| Tests | Verified locally | 87 total: 36 root (31 core + 5 rendered HTTP), 51 agent |

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
   Vertex model evidence and the verified Cloud Trace spans.
7. **3:50–4:00 — Honest close.** 87 tests; fleet endpoint mounted but three-tier live
   delegation still unverified; persistent
   memory, cloud identity/gateway and Model Armor not implemented in the submission.

Do not present `/fleet` metadata or a partial `/fleet/run` response as proof of live
multi-agent delegation. The endpoint is mounted, but only an execution whose
`delegation` contains all three agents with their own tools meets that claim.

## Deployment proof to capture

- Cloud Run service name, `australia-southeast2`, current revision and `.run.app` URL.
- `GET /status` with `external_write:false`, `model_backend:"vertex"`, model and location.
- `GET /fleet` with the three agents and their exact tools/human gates, explicitly
  labelled as construction evidence; `/fleet/run` only as mounted-route evidence
  unless all three agents appear in the returned delegation.
- Real `/triage` response for EM-001 and EM-023.
- Matching `contextops.audit.Intake___Triage` spans for EM-001/QUEUED and
  EM-023/QUARANTINE from revision `secondkey-agent-00004-7vb`.
- Frontend `/` and `/app`; the deployed status badge shows `ready · writes disabled`
  after CORS and build-time endpoint wiring.
- Configuration screenshots must redact environment values and never show any key,
  token or credential.

## Public cost gate

`POST /triage` and `POST /fleet/run` are unauthenticated and invoke Vertex. Cloud Run is max instances 1,
concurrency 80, timeout 300 seconds. The server now requires 1–2 explicit ids and
allows 10 total cost-bearing requests per global 10-minute in-memory window, reducing
triage's default worst case from 18 model calls per request to two. A fleet request is
separately capped at 15 LLM calls. This depends on max instances 1 and is not a
distributed hard spend cap. Add quota/budget alerts and remove `allUsers` after
judging unless public invocation becomes a product requirement.

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
