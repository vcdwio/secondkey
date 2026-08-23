# Verge AI - The Fortified Enterprise Fleet — Product Spec

## Product outcome

Build a local, fully interactive demo for Verge Consulting that presents exactly ten customer-facing business Units while sharing one ContextOps platform core. Every Unit must run independently in Demo mode and also participate in an end-to-end Monday capacity-crisis workflow.

## Public product structure

The ten visible business Units are:

1. Intake & Triage
2. Customer Service
3. Sales & CRM
4. Operations & Scheduling
5. Finance Admin
6. Knowledge & Documents
7. Marketing & Content
8. Research & Insights
9. People & Onboarding
10. Purchase & Order

Demo, Trigger, Manager, Context Quality, Evidence-backed Decision, Approval, Execution, and Business Quality Gate are shared platform services. They are not counted as public Units.

## Primary scenario

At 08:05 on Monday, seven client accounts create competing requests while Verge has only three suitable staff members with spare capacity. The platform must prioritize requests, identify SLA and commitment risk, assemble evidence, propose staff-hour reallocation, show downstream impact, draft client responses, and require approval before any simulated external write.

The correct flagship outcome must visibly keep BlueHarbor and Elevate at P0, Morrow Home and Peakline at P1, Ledgerwise at P2, show 12 proposed staff-hours of reallocation, and show that internal product work is paused to release capacity.

## Experience

The first screen is an operations control room, not an agent marketplace. It contains:

- a concise Daily Brief and risk summary;
- a queue of active client incidents;
- a capacity and allocation view;
- a visible ten-Unit catalog;
- a shared-core execution pipeline;
- an inspector showing input, output, evidence, confidence, approvals, and API/MCP connectors;
- Demo/Live environment control, with Live locked in this deliverable;
- role views for General Manager, Delivery Manager, Account Manager, and Consultant;
- an Audit/Eval surface with the supplied 25 regression scenarios.

## Interaction requirements

- Selecting a Unit updates its input/output contract and connector requirements.
- Running a Unit produces a deterministic demo result and adds an audit event.
- Running the flagship workflow advances through the shared core and produces the expected resource decision.
- Approval can be approved or rejected locally; no external system is called.
- Demo reset restores the original state.
- Role switching changes the visible decision scope without changing the underlying source records.
- Every proposed external write is visibly marked as simulated and approval-gated.

## Context and safety requirements

- Structured facts are read by exact identifiers, not semantic search.
- Knowledge retrieval filters tenant, permissions, entity, status, and version before relevance ranking.
- Decisions consume a compact Context Packet rather than the full data pack.
- Confidence is calculated from evidence coverage, source authority, freshness, agreement, deterministic-rule coverage, and Eval history.
- Archived policy content must not override active policy content.
- Cross-client data leakage, prompt injection, duplicate messages, connector failure, and missing-context cases must be represented in Demo mode.
- `external_write` remains `false` throughout the demo.
- No credentials, API keys, real people, or real customer data are included.

## Visual direction

Use a calm, high-trust consulting operations aesthetic: warm off-white canvas, charcoal text, restrained navy and copper accents, compact cards, clear status chips, and strong information hierarchy. Prefer one-screen comprehension over decorative dashboard density. Motion is limited to purposeful workflow progress and state transitions.

## Deliverables

- runnable local web demo in this project;
- supplied Verge data pack copied into local fixtures;
- input/output and shared-core architecture diagrams;
- API/MCP connector matrix with Demo and Live behavior;
- README, project memo, pitfalls, and verification instructions;
- automated tests for deterministic priority, confidence, routing limits, approval safety, and Unit contracts.
