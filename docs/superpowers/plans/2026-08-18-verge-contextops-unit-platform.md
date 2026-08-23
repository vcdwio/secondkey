# Verge ContextOps Unit Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deterministic, interactive Verge Consulting demo with exactly ten customer-facing business Units, one shared ContextOps core, and Demo/Live separation.

**Architecture:** A Vinext/React site renders a single operations control room from typed fixture adapters. Pure TypeScript domain functions build Context Packets, calculate priority and confidence, route work with a five-handoff ceiling, and enforce approval before simulated execution. UI state is local and reversible; supplied data remains read-only.

**Tech Stack:** Vinext, React 19, TypeScript, Tailwind CSS 4, Vitest, local JSON/CSV fixtures.

**Spec:** `docs/product-spec.md`

## Global Constraints

- Exactly ten customer-visible business Units.
- Shared core services do not count as Units.
- Demo and Live are separate; Live stays locked.
- All external writes are simulated and approval-gated.
- Supplied fixture data is read-only and remains fictional.
- No credentials or real customer data.

---

### Task 1: Domain contracts and deterministic engine

**Files:**
- Create: `lib/contextops/types.ts`
- Create: `lib/contextops/units.ts`
- Create: `lib/contextops/engine.ts`
- Test: `tests/contextops-engine.test.ts`

**Interfaces:**
- Consumes: fixture-derived `Incident`, `StaffCapacity`, and `EvidenceRecord` values.
- Produces: `BUSINESS_UNITS`, `buildContextPacket()`, `scoreIncident()`, `calculateConfidence()`, `routeTask()`, and `proposeExecution()`.

- [ ] Write tests showing the ten-Unit catalog, priority rules, five-handoff ceiling, evidence-based confidence, and external-write approval requirement.
- [ ] Run the focused test and verify failures are caused by missing modules.
- [ ] Implement the smallest pure functions required by the tests.
- [ ] Run the focused test and verify all cases pass.

### Task 2: Fixture adapter and flagship scenario

**Files:**
- Create: `lib/contextops/fixtures.ts`
- Create: `lib/contextops/demo.ts`
- Test: `tests/demo-scenario.test.ts`

**Interfaces:**
- Consumes: copied Verge data pack files under `fixtures/verge-demo-pack/`.
- Produces: `DEMO_INCIDENTS`, `DEMO_CAPACITY`, `FLAGSHIP_DECISION`, and `runFlagshipScenario()`.

- [ ] Write a failing test for the expected BlueHarbor, Elevate, Morrow, Peakline, and Ledgerwise priorities and 12-hour reallocation.
- [ ] Verify the test fails before the adapter exists.
- [ ] Implement a deterministic, typed fixture adapter and flagship runner.
- [ ] Verify the focused and domain suites pass.

### Task 3: First meaningful control-room slice

**Files:**
- Create: `components/contextops-control-room.tsx`
- Modify: `app/page.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: Unit catalog and flagship scenario summary.
- Produces: recognizable control-room shell with Daily Brief, incident queue, Unit catalog, and shared-core strip.

- [ ] Replace the starter skeleton with the product-specific control-room shell.
- [ ] Start the retained development server and force one successful render.
- [ ] Open the first meaningful preview in Codex.

### Task 4: Complete interactions and role scopes

**Files:**
- Modify: `components/contextops-control-room.tsx`
- Create: `components/unit-inspector.tsx`
- Create: `components/decision-workbench.tsx`
- Create: `components/audit-panel.tsx`

**Interfaces:**
- Consumes: pure domain functions and demo fixtures.
- Produces: Unit selection/run, role switching, pipeline run, approval/rejection, audit events, and reset.

- [ ] Add deterministic Unit input/output and connector inspection.
- [ ] Add flagship workflow progress and decision workbench.
- [ ] Add local approval, rejection, audit, role filtering, and reset behavior.
- [ ] Verify keyboard-visible controls and responsive layouts.

### Task 5: Architecture and connector documentation

**Files:**
- Create: `docs/architecture.md`
- Create: `docs/api-mcp-matrix.md`
- Create: `PROJECT_MEMO.md`
- Create: `PITFALLS.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: final Unit contracts and shared-core behavior.
- Produces: input/output diagrams, connector matrix, safety boundary, and run instructions.

- [ ] Document every Unit input/output and shared-core transition.
- [ ] Map Demo adapters and future APIs/MCPs without adding credentials.
- [ ] Record project decisions, limitations, and verification steps.

### Task 6: Cleanup and verification

**Files:**
- Delete: `app/_sites-preview/`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: completed site and tests.
- Produces: clean production build with no starter metadata or unused skeleton dependency.

- [ ] Remove starter preview files, metadata, assets, and unused dependency.
- [ ] Run tests, build, fixture validation, and HTTP smoke check.
- [ ] Inspect the final local page for blocking runtime or console errors.
