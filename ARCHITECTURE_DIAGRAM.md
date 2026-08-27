# SecondKey — System Architecture

> The agent holds the first key. Irreversible actions wait for yours.

## Submission architecture

Solid arrows are executed in the hosted submission. Dashed arrows are implemented
and tested but disabled or not mounted. This distinction matters: SecondKey contains
a three-agent authority-partitioned fleet, but the hosted `/triage` route still runs
the single-purpose intake agent. `/fleet` proves the fleet definition and tool
partition; it does not prove live delegation.

```mermaid
flowchart TB
    WEB["Cloudflare Worker<br/>/ cover · /app control room"]
    DATA["Fictional Verge pack<br/>10 staff · 7 clients · 30 emails"]
    CORE["Deterministic ContextOps core<br/>priority · capacity · authority"]
    GATES["Pre-model gates<br/>identity · tenant · injection · duplicate"]
    TRIAGE["ACTIVE /triage<br/>ADK Runner + contextops_intake LlmAgent<br/>score_priority only"]
    VAI["Vertex AI<br/>gemini-3.7-flash · global · ADC"]
    AUDIT["Audit JSON / CSV + OTel spans<br/>external_write: false"]

    WEB --> CORE
    DATA --> CORE --> GATES
    GATES -->|queued only| TRIAGE --> VAI
    TRIAGE --> AUDIT

    subgraph FLEET["CONSTRUCTED + TESTED · not mounted in hosted Runner"]
      COORD["secondkey_fleet<br/>SequentialAgent"]
      DRAFT["draft_agent<br/>list_queue · build_context_packet<br/>humanGate: never"]
      INTERNAL["internal_commit_agent<br/>list_queue · commit_internal_change · rollback_changes<br/>humanGate: beyond role limits"]
      EXTERNAL["external_commitment_agent<br/>list_queue · release_external_commitment<br/>humanGate: always"]
      CONSTRUCT["Construction boundary<br/>disjoint tools + allowedFunctionNames"]
      POLICY["ContextOpsPolicyEngine<br/>ALLOW · DENY · CONFIRM before execution"]

      COORD --> DRAFT --> INTERNAL --> EXTERNAL
      CONSTRUCT --> DRAFT
      CONSTRUCT --> INTERNAL
      CONSTRUCT --> EXTERNAL
      DRAFT --> POLICY
      INTERNAL --> POLICY
      EXTERNAL --> POLICY
    end

    FLEET -.->|createFleet is test-only today| TRIAGE

    subgraph CLOUD["Hosted Google Cloud path"]
      CR["Cloud Run<br/>australia-southeast2 · public"]
      SA["secondkey-runner service account"]
      STATE["In-memory Session + Memory<br/>Vertex persistence wired, disabled"]
      REG["10-entry local registry<br/>Cloud discovery disabled"]
      TRACE["Cloud Trace exporter<br/>configured; final flush verification required"]
      CR --> SA --> VAI
      CR --> STATE
      CR --> REG
      CR --> TRACE
    end

    TRIAGE --> CR

    classDef live fill:#e6f4ea,stroke:#188038,color:#0d652d
    classDef deterministic fill:#fef7e0,stroke:#f9ab00,color:#8a5a12
    classDef prepared fill:#e8f0fe,stroke:#1a73e8,color:#174ea6,stroke-dasharray:5 5
    class WEB,DATA,GATES,TRIAGE,VAI,AUDIT,CR,SA,STATE,REG live
    class CORE,POLICY,CONSTRUCT deterministic
    class COORD,DRAFT,INTERNAL,EXTERNAL,TRACE prepared
```

Cloud Run executes in `australia-southeast2`; Gemini uses Vertex AI's `global`
location. SecondKey therefore makes no Australia-pinned inference or data-residency
claim. The current hosted UI shows `local endpoint` because it was built without
`NEXT_PUBLIC_AGENT_URL`; its demo remains functional but is not calling Cloud Run.

## Authority-partitioned fleet enforcement

The fleet has two independent enforcement layers. Construction controls what each
agent can reach. The policy engine controls what a reached tool call may do. `DENY`
means that path can never be authorized; `CONFIRM` means execution pauses for a named
human with sufficient authority.

```mermaid
sequenceDiagram
    autonumber
    participant C as secondkey_fleet
    participant D as draft_agent<br/>humanGate never
    participant I as internal_commit_agent<br/>humanGate beyond limits
    participant E as external_commitment_agent<br/>humanGate always
    participant P as ContextOpsPolicyEngine
    participant H as Named human
    participant X as Simulated execution

    Note over D,E: Construction boundary: disjoint tools + allowedFunctionNames
    C->>D: list_queue / build_context_packet
    D->>P: permission-scoped context request
    alt access group missing
        P-->>D: DENY — nobody can authorize cross-account retrieval
    else permitted
        P-->>D: ALLOW — draft only, no write tool exists
    end

    C->>I: list_queue / commit_internal_change / rollback_changes
    I->>P: reversible internal change<br/>externalCommunications pinned to 0
    alt malformed or external communication attempted
        P-->>I: DENY — use of this path is forbidden
    else within acting role limits
        P-->>I: ALLOW
        I->>X: simulate reversible calls
    else beyond acting role limits
        P-->>H: CONFIRM — escalate with exact reasons
        H-->>I: named approval or rejection
        I->>X: simulate only after approval
    end

    C->>E: list_queue / release_external_commitment
    E->>P: irreversible client commitment
    P-->>H: CONFIRM — always, including General Manager
    H-->>E: named approval or rejection
    E->>X: produce held-for-human-send draft<br/>external_write remains false
```

This fleet is real code with 12 targeted tests, but `createFleet()` is currently
referenced only by `agent/tests/fleet.test.ts`. Activating it requires mounting the
coordinator in the production `Runner` and demonstrating delegation and recovery;
until then the diagram must retain the dashed, not-mounted boundary.

## Active governed paths

### Hosted Gemini triage

1. Deterministic gates resolve identity, tenant, injection and duplicate status.
2. Only queued mail reaches `contextops_intake`.
3. Gemini extracts summary, intent and explicit urgency phrases.
4. ADK forces one `score_priority` call; the tool returns the already-computed
   deterministic priority.
5. The response and audit record keep `external_write: false`.

### Portfolio approval

The interactive control room runs a deterministic application workflow. It evaluates
hours, spend, client communications and cross-account reach, then displays an approval
packet and simulated calls with shared idempotency keys. That shared execution logic
lives in import-free `lib/contextops/execution.ts` so both web and agent builds use the
same definitions. This UI workflow is not an ADK long-running/resumable workflow.

## Hackathon evidence map

| Requirement | Current evidence | Honest boundary |
|---|---|---|
| Gemini 3.5+ | Hosted `/status` reports `gemini-3.7-flash`, `vertex`, `global`; `evidence/live-triage-cloudrun.json` records a real model tool call | Model extracts; deterministic code decides |
| Google Agent Framework | Production uses ADK `Runner`, `LlmAgent`, forced `FunctionTool`, in-memory Session/Memory services and `SecurityPlugin` | Three-tier `SequentialAgent` is constructed/tested but not mounted |
| Google Cloud | Public Cloud Run service in `australia-southeast2`; `/status`, `/fleet` and `/triage` are reachable | `/healthz` alone returns an unresolved Google-front 404 |
| Agent Registry | 10 generated local Unit contracts served by `/registry` | Cloud Agent Registry discovery disabled |
| Agent Runtime | Active ADK request runtime | No long-running, asynchronous or cross-restart recovery proof |
| Memory Bank | Vertex services selectable by configuration | Submission uses in-memory state; persistent path not enabled or live-verified |
| Agent Identity | Deterministic application roles and tenant gates | No Google Cloud agent identity or SSO |
| Agent Gateway | `ContextOpsPolicyEngine` performs pre-tool ALLOW/DENY/CONFIRM checks | No Google Agent Gateway service; hosted POST has no auth/rate limit |
| Model Armor | Deterministic pre-model injection and protected-file gates | Google Model Armor not integrated |
| Agent Observability | JSON/CSV audit and OTel span creation; forced flush implemented and tested | Cloud Trace landing must be re-verified after deployment |

## Verification baseline

- 83 automated tests: 36 root (31 core + 5 rendered HTTP) and 47 agent.
- No live connectors or external writes.
- No production identities or customer data; all email addresses use `.example`.
- Cloud discovery and Vertex persistence remain disabled.
- The public cost-bearing `/triage` route needs a rate limiter and bounded batches;
  `max-instances=1` is not a request or spend cap.
