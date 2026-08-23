# Project Memo

- Product: Verge ContextOps Unit Platform demo.
- Public surface: exactly ten business Units.
- Shared platform core: Trigger, Manager, Context Quality, Decision, Approval, Execution, Audit/Eval.
- Environment: Demo is functional; Live is intentionally locked.
- Source data: fictional Verge Consulting data pack supplied by the user.
- Safety: no external writes, no credentials, no real identities.
- Fixture validation: 58 archive entries; pack validator passed 10 staff, 7 clients, 30 emails and 25 Eval scenarios.
- Flagship decision: 12 proposed staff-hours, two P0 accounts, GM approval required.
- Local delivery only; Live connectors remain locked and unconfigured.

## Since 0.2.0

- The UI is generated from the data pack via `npm run data`; no priority, hour, cost or confidence figure is written by hand.
- Priorities come from `scoreIncident()` and are asserted against the validated pack in `tests/governance.test.mjs`.
- Authority is enforced: only the General Manager clears the 12-hour, AUD 1,800, two-account decision. Other roles submit and are audited.
- Approval produces 11 simulated calls with idempotency keys; nine roll back, two email sends stay behind a human step.
- Six navigable views, an editable ROI case, a go-live checklist, six runnable adversarial drills and a JSON audit export.
- 22 tests, ESLint clean, zero WCAG 2.1 AA violations.
