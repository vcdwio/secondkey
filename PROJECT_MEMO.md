# Project Memo

- Product: SecondKey — governed enterprise agents.
- Public surface: exactly ten business Units.
- Shared platform core: Trigger, Manager, Context Quality, Decision, Approval, Execution, Audit/Eval.
- Environment: Demo is functional; Live is intentionally locked.
- Source data: fictional Verge Consulting data pack supplied by the user.
- Safety: no external writes, no credentials, no real identities.
- Fixture validation: 58 archive entries; pack validator passed 10 staff, 7 clients, 30 emails and 25 Eval scenarios.
- Flagship decision: 12 proposed staff-hours, two P0 accounts, GM approval required.
- Local agent delivery verified. Cloud Run revisions are deployed and Ready. Vertex AI ADC was verified by a successful Google Cloud Build smoke using the submitted ADK path; Cloud Run-to-Vertex remains unverified because Google's public route returns 404 before the container. Vertex persistence remains prepared only. Live connectors remain locked and unconfigured.

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
- Current local verification: 35 root tests and 34 agent tests pass (69 total), with both TypeScript checks, ESLint, fixture validation, production builds, rendered HTTP, production health, and desktop/mobile browser QA.
- Production dependency audits report zero known vulnerabilities for both root and agent after narrow ADK transitive overrides.
- Browser QA passed at desktop and 390px mobile width with no horizontal overflow and no console warnings/errors.
- The production container builds and starts, and Cloud Run revisions are Ready in two Australia regions. The generated `run.app` endpoints still return a Google-front 404 before reaching the container, so hosted `/healthz`, `/triage`, and Cloud Run-to-Vertex evidence remain unverified. Vertex AI itself was verified separately by Cloud Build smoke `e8a0c467-5940-4777-ba0a-7cf788a61444`.
