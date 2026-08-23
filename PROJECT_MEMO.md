# Project Memo

- Product: Verge AI - The Fortified Enterprise Fleet demo.
- Public surface: exactly ten business Units.
- Shared platform core: Trigger, Manager, Context Quality, Decision, Approval, Execution, Audit/Eval.
- Environment: Demo is functional; Live is intentionally locked.
- Source data: fictional Verge Consulting data pack supplied by the user.
- Safety: no external writes, no credentials, no real identities.
- Fixture validation: 58 archive entries; pack validator passed 10 staff, 7 clients, 30 emails and 25 Eval scenarios.
- Flagship decision: 12 proposed staff-hours, two P0 accounts, GM approval required.
- Local agent delivery verified; Cloud Run and Vertex persistence require explicit deployment authorization. Live connectors remain locked and unconfigured.

## Since 0.2.0

- The UI is generated from the data pack via `npm run data`; no priority, hour, cost or confidence figure is written by hand.
- The 12-hour capacity proposal is produced by `allocateCapacity()`; the scenario's `resource_changes` is now only an expected value in tests.
- Priorities come from `scoreIncident()` and are asserted against the validated pack in `tests/governance.test.mjs`.
- Authority is enforced: only the General Manager clears the 12-hour, AUD 1,800, two-account decision. Other roles submit and are audited.
- Approval produces 11 simulated calls with idempotency keys; nine roll back, two email sends stay behind a human step.
- Six navigable views, an editable ROI case, a go-live checklist, six runnable adversarial drills and a JSON audit export.
- Google ADK Runner now owns real Gemini extraction, while the shared deterministic core owns priority and policy.
- In-memory ADK sessions/memory work locally; Vertex mode requires ADC and fails closed on incomplete settings.
- Ten generated registry entries are synchronized across agent and UI; Cloud Registry is query-only until deployment.
- Approval reserves 12 derived staff-hours with optimistic versions; rollback releases them without overselling.
- OTel spans, JSON audit, safe CSV audit, and the six HTTP endpoints are implemented locally.
- Final verification: 32 root tests and 29 agent tests passed; both TypeScript checks, ESLint, fixture validation, rendered HTTP, production Agent HTTP, browser interactions, and the one-request real Gemini smoke passed.
- Production dependency audits report zero known vulnerabilities for both root and agent after narrow ADK transitive overrides.
- Browser QA passed at desktop and 390px mobile width with no horizontal overflow and no console warnings/errors.
- Docker and gcloud are not installed on the verification machine, so container execution and Cloud Run deployment remain honestly unverified.
