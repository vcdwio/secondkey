# Fortified Fleet Final Build Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete T3–T8 readiness with Google ADK, concurrency safety, policy, state, registry, telemetry, UI evidence, and reproducible Cloud Run deployment.

**Architecture:** An ADK `Runner` powers real Gemini extraction behind deterministic tools and policies. Pure local state machines protect capacity; generated registry data keeps the frontend and agent synchronized; one sanitized audit store feeds OTel, JSON, and CSV.

**Tech Stack:** Node.js 24.13+, TypeScript 5.9, `@google/adk` 2.0, `@google/genai` 2.15, Express 5, OpenTelemetry, Vinext/React 19.

**Spec:** `docs/superpowers/specs/2026-08-23-fortified-fleet-final-design.md`

## Global Constraints

- Gemini extracts and drafts only; deterministic functions decide priority, permission, money, and scheduling.
- `external_write` is always `false`.
- UI and agent numbers come from fixtures, generated artifacts, or function results.
- Never print, commit, or copy `GEMINI_API_KEY` or Vertex credentials.
- Do not deploy or create cloud resources without explicit authorization.

---

### Task 1: Optimistic capacity reservation

**Files:**
- Create: `lib/contextops/capacity.ts`
- Modify: `lib/contextops/engine.ts`
- Create: `tests/concurrency.test.mjs`

**Interfaces:**
- Produces: `createCapacityReservationStore(initial)`, `reserveCapacity(input)`, `releaseReservation(id)`, `getCapacityState(staffId)`, and `resetCapacityReservations(initial)`.

- [ ] Write failing tests for one winner/one version conflict, retry, insufficient hours, 1,000 seeded interleavings, and release.
- [ ] Run `node --test tests/concurrency.test.mjs`; verify failure is missing API.
- [ ] Implement per-staff versions and deterministic reservation IDs.
- [ ] Run the focused test; verify every invariant passes.

### Task 2: ADK services and Policy Gateway

**Files:**
- Modify: `agent/package.json`
- Create: `agent/src/services.ts`
- Create: `agent/src/policy.ts`
- Create: `agent/src/adk.ts`
- Modify: `agent/src/triage.ts`
- Create: `agent/tests/services.test.ts`
- Create: `agent/tests/policy.test.ts`

**Interfaces:**
- Produces: `createAgentServices(env)`, `ContextOpsPolicyEngine`, `createAdkTriageRuntime(config)`, and `requestScorePriority(email, envelope, sessionId)`; Vertex state uses Cloud ADC because ADK 2.0 rejects Express API keys for Agent Engine state.

- [ ] Write failing service-selection and policy tests using real ADK classes and tools.
- [ ] Install exact ADK/OpenTelemetry/Zod dependencies with the project cache.
- [ ] Implement local/Vertex service selection; reject partial Vertex configuration.
- [ ] Implement authority and access-group DENY rules with `PolicyOutcome`.
- [ ] Implement the ADK Runner, forced FunctionTool call, and deterministic result state.
- [ ] Run agent tests and typecheck.

### Task 3: Registry and audit telemetry

**Files:**
- Create: `scripts/build-agent-registry.mjs`
- Create: `agent/src/generated/registry.json`
- Create: `agent/src/registry.ts`
- Create: `agent/src/telemetry.ts`
- Create: `agent/tests/registry.test.ts`
- Create: `agent/tests/telemetry.test.ts`

**Interfaces:**
- Produces: `REGISTRY_ENTRIES`, `createRegistryService(env)`, `AuditStore.record()`, `toJson()`, `toSafeCsv()`, and `initializeTelemetry(env)`.

- [ ] Write failing tests that compare ten generated entries with `BUSINESS_UNITS`.
- [ ] Write failing tests for exact CSV headers and formula-injection protection.
- [ ] Generate the registry artifact from Unit definitions.
- [ ] Implement local registry and optional remote query adapter.
- [ ] Implement OTel span recording and safe audit serialization.
- [ ] Run focused tests and mutation-check authorization, empty evidence, and hostile CSV cells.

### Task 4: HTTP integration

**Files:**
- Modify: `agent/src/server.ts`
- Modify: `agent/scripts/smoke.ts`
- Create: `agent/tests/server.test.ts`

**Interfaces:**
- Consumes: ADK runtime, services, registry, and audit store.
- Produces: `/healthz`, `/triage`, `/sessions/:id`, `/registry`, `/audit.json`, `/audit.csv`.

- [ ] Write failing HTTP tests with an injected local tool requester; no network mocks above the Gemini boundary.
- [ ] Refactor `createApp(dependencies?)` for testable runtime injection.
- [ ] Add all endpoints, size limits, stable errors, and `external_write: false`.
- [ ] Move smoke to the ADK runtime and verify the four required fixture cases.
- [ ] Run agent tests, build, and real Gemini smoke.

### Task 5: UI evidence

**Files:**
- Modify: `components/contextops-control-room.tsx`
- Modify: `components/execution-panel.tsx`
- Modify: `components/unit-inspector.tsx`
- Modify: `lib/contextops/portfolio.ts`
- Modify: `app/globals.css`
- Modify: `tests/rendered-html.test.mjs`

**Interfaces:**
- Displays: `capacity reserved · optimistic lock v{n}` and `registry v1.0.0 · cross-department discoverable`.

- [ ] Write a failing rendered-HTML test for initial lock and registry evidence.
- [ ] Bind the Demo approval/reset actions to a local reservation store.
- [ ] Display generated registry metadata in every Unit drawer.
- [ ] Show Agent runtime readiness without unlocking Live or external writes.
- [ ] Run rendered tests and root typecheck.

### Task 6: Cloud Run and submission readiness

**Files:**
- Create: `Dockerfile.agent`
- Create: `.gcloudignore`
- Modify: `README.md`
- Modify: `docs/architecture.md`
- Create: `docs/hackathon-submission.md`
- Modify: `PROJECT_MEMO.md`
- Modify: `PITFALLS.md`
- Modify: `CHANGELOG.md`

**Interfaces:**
- Produces: reproducible local/cloud commands, architecture evidence, four-minute demo checklist, and exact deployment proof checklist.

- [ ] Add a root-context Docker build that packages agent plus required fixtures/generated data.
- [ ] Document local, Vertex, and Cloud Run environment variables without values.
- [ ] Document hosted URL/repository/diagram/video/submission requirements and honest unverified cloud steps.
- [ ] Run secret/path scans and container/buildpack preflight where locally available.

### Task 7: Final verification and deployment gate

- [ ] Run root `npm test`, lint, and `tsc --noEmit`.
- [ ] Run agent tests, typecheck, build, and real Gemini smoke.
- [ ] Run fixture validation and `git diff --check`.
- [ ] Start both local services; verify health, triage, sessions, registry, JSON audit, CSV audit, and frontend HTTP 200.
- [ ] Use browser QA for approval/reservation, registry drawer, reset, and responsive layout.
- [ ] Verify `agent/.env` is ignored and untracked.
- [ ] Request explicit authorization for Cloud Run deployment; after approval, deploy and verify the `.run.app/healthz` response.
