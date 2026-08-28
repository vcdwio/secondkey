# SecondKey — Fortified Enterprise Fleet compliance audit

Verified 2026-08-28 against the official All Things Agentic Hackathon rules and the
current source/deployed endpoints. Status means evidence, not aspiration.

## 1. Mandatory requirements

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Gemini 3.5+ through Gemini API or Vertex AI | **Met** | Hosted `/status` reports `gemini-3.7-flash`, `model_backend:vertex`, `model_location:global`; `evidence/live-triage-cloudrun.json` records a real hosted tool call |
| 2 | At least one Google agent framework | **Met** | Active `/triage` constructs and invokes ADK `Runner`, `LlmAgent`, forced `FunctionTool`, Session/Memory services and `SecurityPlugin` in `agent/src/adk.ts` |
| 3 | At least one Google Cloud infrastructure service | **Met** | Public Cloud Run service responds at `/status`, `/fleet` and `/triage` in `australia-southeast2` |

These three baseline technology requirements are met. This does not by itself prove
the selected track's multi-agent judging criterion.

## 2. Seven named enterprise-agent capabilities

| Capability | Required status | Evidence and exact boundary |
|---|---|---|
| Agent Registry | **Implemented** (local application registry) | `agent/src/registry.ts` serves ten synchronized versioned Unit contracts at `/registry`; Google Cloud registry discovery is wired behind `CONTEXTOPS_CLOUD_REGISTRY=false` and is not enabled |
| Agent Runtime | **Implemented** (request-scoped only) | Cloud Run executes the ADK intake Runner; there is no long-running asynchronous workflow, durable approval pause or cross-restart recovery |
| Memory Bank | **Wired, not enabled** | `agent/src/services.ts` can select Vertex Session/Memory services, but hosted `/status` reports `state_backend:memory`; no persistent live proof |
| Agent Identity | **Not implemented** | Roles/tenant identity come from the fictional fixture and deterministic application checks; no Cloud agent identity, workforce federation, SSO or directory sync |
| Agent Gateway | **Not implemented** | `ContextOpsPolicyEngine` is an in-process pre-tool policy layer, not Google Agent Gateway; public POST is unauthenticated, though it now has a two-id cap and single-instance global rate window |
| Model Armor | **Not implemented** | `securityReasons()` deterministically blocks injection/protected-file requests before Gemini; Google Model Armor is not called |
| Agent Observability | **Implemented** | audit JSON/CSV, OTel spans and request-end flush are tested; the final revision produced two verified `contextops.audit.Intake___Triage` spans in Cloud Trace |

## 3. Selected-track reality check

The business workflow is complex enough for multiple specialized agents, and
`agent/src/fleet.ts` constructs three authority-partitioned agents with disjoint tools,
`allowedFunctionNames`, and an independent policy layer. Twelve tests prove that
construction and its DENY/CONFIRM behavior.

However, the hosted `Runner` is built in `agent/src/adk.ts` with one
`contextops_intake` `LlmAgent`. `createFleet()` is referenced only by
`agent/tests/fleet.test.ts`; `/fleet` publishes metadata but does not execute or route
the fleet. Therefore:

- **Live multi-agent delegation: not implemented.**
- **Failure-tolerant inter-agent routing/recovery: not implemented.**
- **“Unlikely Hero” criterion: weak.** The target operator is a consulting-firm
  General Manager, which is a standard corporate role.

This is the highest submission risk because the official Fortified criterion asks
whether the system intelligently delegates to specialized sub-agents. Do not use the
architecture diagram or `/fleet` response to imply that the live path already does so.

## 4. Submission-rule compliance

| Rule | Status | Action/evidence |
|---|---|---|
| Repository + reproducible spin-up | **Ready locally** | README contains install, test, deploy and three hosted verification commands; final clean-clone proof required after push |
| Architecture diagram | **Ready and honest** | `ARCHITECTURE_DIAGRAM.md` separates active, constructed/tested and disabled paths |
| Hosted project | **Ready** | `/` cover, `/app` control room and public Cloud Run endpoints verified |
| Video ≤4 minutes | **Pending user action** | Public YouTube/Vimeo, English or English subtitles; show unedited live execution and Google Cloud visual proof |
| Pre-existing work disclosure | **Present** | `DEVPOST_SUBMISSION.md` names the pre-existing deterministic ContextOps core and fictional data pack and separates submission-period work |
| Data-source disclosure | **Present** | fictional pack, no real identities/customers, `.example` email domains |

The official rules say projects must be newly created during the submission period and
also require disclosure of other pre-existing code/work. Because the deterministic
core is central, eligibility is a real judge-discretion risk, not something this audit
can certify away. The safest submission is full disclosure plus a concrete list of the
SecondKey/ADK/cloud work built during the period.

## 5. Highest-return actions before recording

1. **P0 — Mount and demonstrate the actual fleet.** Use a supported ADK workflow or
   coordinator that routes by required authority, prove the three agents execute, and
   add failure recovery. The existing `SequentialAgent` emits an ADK deprecation
   warning, so do not deepen that dependency without checking the supported migration.
2. **P0 — Finish protecting public `/triage`.** The two-id cap and server-side global
   rate window are implemented; add quota/budget alerts and remove public invoker after
   judging.
3. **P0 — Record an unedited agent call plus Cloud Run/Vertex/Trace proof within the
   first four minutes.** UI-only execution does not prove the hosted agent.
4. **P1 — Reframe the end user if honest product evidence supports it.** The current
   General Manager persona does not satisfy “outside standard corporate roles” well.
5. **P1 — Earn the low-risk +0.4 bonus.** Publish build content with the required
   hackathon-purpose disclosure and a social post with `#AllThingsAgenticHackathon`.
   Do not add another model solely for bonus points this late unless it materially
   improves the demonstrated workflow.
