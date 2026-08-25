# Changelog

## Unreleased — Product identity

- Renamed the product to **SecondKey** with the promise **Autonomy until it matters.**
- Kept Verge Consulting as the fictional demo tenant and ContextOps as the shared internal operating architecture.
- Replaced the prewritten capacity answer with deterministic `allocateCapacity()` rules: priority, SLA, skill coverage, available hours, movable blocks and switching cost.
- Added four allocation tests, including 100 identical runs, the real 12-hour pack outcome and an honest reduced-staff shortfall.
- Added optimistic capacity reservations with per-staff versions, deterministic IDs, conflict/shortfall responses, release, reset, and 1,000 seeded concurrency checks.
- Replaced direct Gemini wiring with a Google ADK `Runner`, forced `FunctionTool`, Session/Memory services, and a pre-tool `SecurityPlugin` backed by the same authority matrix as the UI.
- Added a synchronized ten-Unit registry, explicitly enabled Cloud discovery adapter, OTel audit spans, safe JSON/CSV audit exports, and complete HTTP endpoints.
- Added Cloud Run container/source configuration, cross-origin frontend health wiring, and a no-claims submission/deployment checklist.
- Added dual Gemini authentication: local Developer API keys and keyless Vertex AI ADC on Cloud Run, with Gemini 3.7 Flash on the `global` model endpoint.
- Split the agent's production TypeScript build from tests and local smoke scripts, preserved the root ESM boundary in Docker, and added the ADK-required Cloud Trace exporter.
- Added three production-packaging regression tests, bringing the verified local total to 69.

## 0.2.0 — 2026-08-22 · Governed demo

The first build looked right but was mostly static. This one runs the rules.

### Data-driven, not hand-written
- `npm run data` derives `lib/contextops/generated/portfolio.json` from the fixture CSV/JSON pack — priorities, SLA clocks, capacity, confidence inputs, ROI volumes, execution plan and adversarial drills.
- All eight queue priorities are now computed by `scoreIncident()` from SLA clocks, project status and committed dates. A test asserts they still match the validated pack.
- Confidence is `calculateConfidence()` output with its six weighted inputs shown on demand — no claimed percentage anywhere.

### Decisions respond to the operator
- Selecting a client re-renders the decision: headline, allocation, evidence, exposure, downstream impact.
- Accounts that give up capacity say so (`Hannah Wu gives up 2h`), instead of showing "nothing moved".
- Confidence below 70% keeps the result a draft and asks for the missing sources by name.
- Six sidebar views now navigate: Daily Brief, Priority Queue, Waiting Approval, Value & ROI, Risk & Safety, Decision Trace.

### Authority and separation of duties
- `evaluateAuthority()` checks hours, spend, client communication and cross-account reach against the acting role.
- Only the General Manager can clear the flagship decision. Other roles get the reason and a Submit-to-GM path; the attempt is audited under their name.
- Approval requires a decision note to reject, and records the note in the trail.

### After approval
- `simulateExecution()` produces the 11 calls that would be made, each with method, endpoint, target and idempotency key, and each marked reversible or not.
- `rollbackExecution()` restores the nine reversible ones; the two client emails stay behind a human send step by design.

### Value and go-live
- Value & ROI view: hours returned, labour value and SLA exposure, built from pack volumes with the minute estimates editable in the UI.
- Go-live checklist and connector registry: read-only first, sends last, with what is still missing before Live.

### Safety you can run live
- Risk & Safety view fires the six adversarial inputs in the pack — prompt injection, cross-account request, duplicate, unknown sender, unsupported claim, connector failure — and shows the rule that stopped each one.
- The 25 Eval scenarios are browsable with their prohibited actions.

### Interface
- Type scale rebuilt from a 12px floor; body copy is 13–15px. The previous build ran 6–11px.
- Zero WCAG 2.1 AA violations across all seven surfaces (axe-core), down from 75 contrast failures.
- Dialogs close on Escape, trap Tab, and restore focus. Scrollable tables and code blocks are keyboard reachable.
- Role switch, environment control and navigation survive on mobile instead of being hidden below 820px.
- Audit trail is complete, scrollable and exportable as JSON with actor and evidence on every event.

### Tests
- 26 automated tests (was 12): governance coverage plus deterministic capacity allocation, reduced-staff shortfall, execution holds, rollback, idempotency, ROI arithmetic and drill coverage.
