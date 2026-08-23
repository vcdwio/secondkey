# Verge AI Final Build Design

## Goal

Finish the hackathon build as one verifiable enterprise-agent workflow: real Gemini extraction through Google ADK, deterministic decisions, concurrency-safe capacity, shared policy enforcement, durable-state adapters, discoverable Units, OpenTelemetry audit evidence, and a Cloud Run-ready service. External writes remain disabled.

## Chosen architecture

The Express agent becomes the server boundary around an official `@google/adk` 2.0 `Runner`. A Gemini-backed `LlmAgent` may extract only `summary`, `intent`, and explicit urgency phrases; the `score_priority` FunctionTool returns the priority already computed from fixture-backed deterministic context. `SecurityPlugin` invokes one ContextOps policy engine before every governed tool call.

The Runner receives a service bundle. Local mode uses ADK's `InMemorySessionService` and `InMemoryMemoryService`. Vertex mode uses `VertexAiSessionService` and `VertexAiMemoryBankService` when the required project, location, reasoning-engine ID, and Application Default Credentials are present; an incomplete Vertex configuration fails closed instead of silently falling back. ADK 2.0's Agent Engine client does not support Express API-key authentication, so Cloud Run uses its service identity.

Capacity reservation is a separate deterministic state machine with one version per staff member. A reservation succeeds only when the caller's version matches and sufficient hours remain. Releases restore hours and advance the version. The UI owns a local instance for the Demo environment; server execution remains `external_write: false`.

The ten-Unit registry is generated from `BUSINESS_UNITS`, committed as a deployable artifact inside `agent/`, and returned by `GET /registry`. When Google Cloud Agent Registry configuration exists, the service may also query the remote catalog; local entries remain the source of truth for the demo because the current TypeScript SDK exposes read/query methods, not publish methods.

Audit records are written once, rendered as OpenTelemetry spans, and exported from `GET /audit.json` and `GET /audit.csv`. Every record includes time, component, actor, role, message, evidence IDs, task ID, and policy outcome. CSV cells beginning with `=`, `+`, `-`, or `@` are prefixed to prevent spreadsheet formula execution.

## API surface

- `GET /healthz`: runtime mode, model, registry count, telemetry mode, and `external_write: false`.
- `POST /triage`: real ADK/Gemini triage for selected fixture emails; returns session ID and deterministic results.
- `GET /sessions/:id`: retrieves ADK session state for the requested/default demo user.
- `GET /registry`: returns exactly ten generated Unit registry entries and optional remote discovery status.
- `GET /audit.json`: structured audit envelope.
- `GET /audit.csv`: safe UTF-8 CSV with the required column order.

## Failure handling

- Injection, cross-account access, duplicates, and unknown identities are stopped before Gemini.
- Missing or malformed tool calls fail closed.
- Policy DENY returns a reason before tool execution.
- Incomplete Vertex configuration throws a configuration error.
- Missing Gemini key prevents triage but does not break health, registry, session, or audit endpoints.
- Cloud deployment is not claimed until a real `.run.app` health check succeeds.

## Verification

Use red-green TDD for reservation, services, policy, registry, telemetry, and HTTP endpoints. Completion requires root tests/build/lint/typecheck, agent tests/build/typecheck, fixture validation, real Gemini smoke, local HTTP checks, browser interaction checks, secret-ignore checks, and `git diff --check`.
