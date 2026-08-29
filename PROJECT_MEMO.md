# Project Memo

- Product: SecondKey — governed enterprise agents.
- Public surface: exactly ten business Units.
- Shared platform core: Trigger, Manager, Context Quality, Decision, Approval, Execution, Audit/Eval.
- Environment: Demo is functional; Live is intentionally locked.
- Source data: fictional Verge Consulting data pack supplied by the user.
- Safety: no external writes, no credentials, no real identities.
- Fixture validation: 58 archive entries; pack validator passed 10 staff, 7 clients, 30 emails and 25 Eval scenarios.
- Flagship decision: 12 proposed staff-hours, two P0 accounts, GM approval required.
- Local agent delivery and the hosted Cloud Run-to-Vertex ADC path are verified. Public `/status`, `/fleet` and `/triage` respond; `evidence/live-triage-cloudrun.json` records EM-001's real Gemini tool call and EM-023's pre-model quarantine. `/healthz` alone remains an unresolved Cloud Run-front 404, so `/status` is canonical. Vertex persistence remains prepared only. Live connectors remain locked and unconfigured.

## Since 0.2.0

- The UI is generated from the data pack via `npm run data`; no priority, hour, cost or confidence figure is written by hand.
- The 12-hour capacity proposal is produced by `allocateCapacity()`; the scenario's `resource_changes` is now only an expected value in tests.
- Priorities come from `scoreIncident()` and are asserted against the validated pack in `tests/governance.test.mjs`.
- Authority is enforced: only the General Manager clears the 12-hour, AUD 1,800, two-account decision. Other roles submit and are audited.
- Approval produces 11 simulated calls with idempotency keys; nine roll back, two email sends stay behind a human step.
- Six navigable views, an editable ROI case, a go-live checklist, six runnable adversarial drills and a JSON audit export.
- Google ADK Runner now owns real Gemini 3.7 Flash extraction, while the shared deterministic core owns priority and policy.
- In-memory ADK sessions/memory work locally; Vertex mode requires ADC and fails closed on incomplete settings.
- Ten generated registry entries are synchronized across agent and UI; Cloud Registry is query-only and explicitly disabled until deployment.
- Approval reserves 12 derived staff-hours with optimistic versions; rollback releases them without overselling.
- OTel spans, JSON audit, safe CSV audit, and the six HTTP endpoints are implemented locally.
- Before the SecondKey/Vertex change, 32 root tests and 29 agent tests passed with both TypeScript checks, ESLint, fixture validation, rendered HTTP, production Agent HTTP, browser interactions, and a Developer API smoke request. A later Google Cloud Build smoke verified Gemini 3.7 through Vertex AI ADC; the Cloud Run-hosted path still needs request evidence.
- Current local verification: 36 root tests and 51 agent tests pass (87 total), including the OpenTelemetry forced-flush, shared public-endpoint rate guard and fleet per-request LLM ceiling regressions, both TypeScript checks and ESLint. Earlier fixture, build and browser evidence remains recorded separately.
- The earlier fresh-clone audit covered the then-current 84-test baseline; the new 87-test fleet-mounted revision still requires post-push verification before making the same fresh-clone claim.
- Production dependency audits report zero known vulnerabilities for both root and agent after narrow ADK transitive overrides.
- Browser QA passed at desktop and 390px mobile width with no horizontal overflow and no console warnings/errors.
- The production container builds and starts, and Cloud Run revision `secondkey-agent-00004-7vb` is public in `australia-southeast2`. Hosted `/status`, `/fleet`, `/registry`, `/audit.*` and `/triage` are verified. The special `/healthz` path still returns a front-door 404. Request-end forced flush produced two verified `contextops.audit.Intake___Triage` spans in Cloud Trace; evidence is in `evidence/cloud-trace-after-flush.json`.
- The three-tier `secondkey_fleet` is constructed and covered by 15 targeted tests. `POST /fleet/run` now mounts it separately while production `/triage` remains unchanged. Original real local Gemini execution produced allowed draft and internal calls but no external-tier tool call; two instruction-only attempts also failed all-three acceptance and were reverted. The mounted endpoint is not complete live-delegation proof.
- The hosted control room is fully interactive and now displays `Google ADK runtime · ready · writes disabled` after a successful cross-origin `/status` probe. Its Monday scenario remains the deterministic browser demo; the status badge does not imply that each UI step calls Cloud Run.
- Security audit: no tracked `agent/.env`, no credential-like history match beyond one repeated explicit test placeholder, no production dependency vulnerabilities under `npm audit --omit=dev`; public `/triage` and `/fleet/run` remain unauthenticated and share 10 requests per 10-minute in-memory window. Triage requires 1–2 ids and fleet runs have a 15-LLM-call ceiling. Max instances must remain 1; this is not a hard billing cap.
