# SecondKey — System Architecture

> The agent holds the first key. Irreversible actions wait for yours.

## Submission architecture

Solid arrows are executed in the hosted submission. Dashed styling marks capabilities
that are implemented but not fully verified. `/triage` remains the focused intake
path. The separate `/fleet/run` route executed all three authority tiers on Vertex in
revision `secondkey-agent-00006-mx7`, kept observed business calls inside each tier's
constructor tool set, and stopped the external tier at ADK's human-confirmation step.

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

    FLEET_ROUTE["ACTIVE /fleet/run<br/>ADK Runner · max 15 LLM calls/request"]

    subgraph FLEET["HOSTED + TESTED · three-tier Vertex run verified"]
      COORD["secondkey_fleet<br/>SequentialAgent"]
      DRAFT["draft_agent<br/>list_queue · build_context_packet<br/>humanGate: never"]
      INTERNAL["internal_commit_agent<br/>list_queue · commit_internal_change · rollback_changes<br/>humanGate: beyond role limits"]
      EXTERNAL["external_commitment_agent<br/>list_queue · release_external_commitment<br/>humanGate: always"]
      CONSTRUCT["Construction boundary<br/>disjoint constructor tool arrays"]
      POLICY["ContextOpsPolicyEngine<br/>ALLOW · DENY · CONFIRM before execution"]

      COORD --> DRAFT --> INTERNAL --> EXTERNAL
      CONSTRUCT --> DRAFT
      CONSTRUCT --> INTERNAL
      CONSTRUCT --> EXTERNAL
      DRAFT --> POLICY
      INTERNAL --> POLICY
      EXTERNAL --> POLICY
    end

    FLEET_ROUTE --> COORD

    subgraph CLOUD["Hosted Google Cloud path"]
      CR["Cloud Run<br/>australia-southeast2 · public"]
      SA["secondkey-runner service account"]
      STATE["In-memory Session + Memory<br/>Vertex persistence wired, disabled"]
      REG["10-entry local registry<br/>Cloud discovery disabled"]
      TRACE["Cloud Trace exporter<br/>forced flush · live spans verified"]
      CR --> SA --> VAI
      CR --> STATE
      CR --> REG
      CR --> TRACE
    end

    TRIAGE --> CR
    FLEET_ROUTE --> CR

    classDef live fill:#e6f4ea,stroke:#188038,color:#0d652d
    classDef deterministic fill:#fef7e0,stroke:#f9ab00,color:#8a5a12
    classDef prepared fill:#e8f0fe,stroke:#1a73e8,color:#174ea6,stroke-dasharray:5 5
    class WEB,DATA,GATES,TRIAGE,FLEET_ROUTE,VAI,AUDIT,CR,SA,STATE,REG live
    class CORE,POLICY,CONSTRUCT deterministic
    class TRACE live
    class COORD,DRAFT,INTERNAL,EXTERNAL live
```

Cloud Run executes in `australia-southeast2`; Gemini uses Vertex AI's `global`
location. SecondKey therefore makes no Australia-pinned inference or data-residency
claim. The current hosted UI was built with `NEXT_PUBLIC_AGENT_URL` and shows
`Google ADK runtime · ready · writes disabled` after a successful cross-origin
`/status` probe. Its Monday scenario remains the deterministic in-browser demo;
the badge verifies backend reachability, not that every UI step calls Cloud Run.

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

    Note over D,E: Construction boundary: disjoint constructor tool arrays
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

This fleet is real code with 15 targeted tests and a production route. Developer API
quota prevented the final local acceptance run, so it was verified on hosted Vertex.
Revision `secondkey-agent-00006-mx7` returned draft, internal and external agents in
seven provider calls. Observed business tools stayed inside their disjoint constructor
arrays. The external tier also emitted ADK's generated `adk_request_confirmation`
protocol call with `confirmed:false`; that is the human gate, not a cross-tier business
capability, and `external_write` remained false.

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
| Google Agent Framework | Production uses ADK `Runner`, `LlmAgent`, forced `FunctionTool`, in-memory Session/Memory services and `SecurityPlugin`; hosted `/fleet/run` completed a separate three-tier `SequentialAgent` execution | ADK generated an additional `adk_request_confirmation` protocol call for the external human gate; it is disclosed in the evidence |
| Google Cloud | Public Cloud Run revision `secondkey-agent-00006-mx7` in `australia-southeast2`; `/status`, `/fleet`, `/fleet/run` and `/triage` are verified | `/healthz` still returns an unresolved Google-front 404; persistent state remains disabled |
| Agent Registry | 10 generated local Unit contracts served by `/registry` | Cloud Agent Registry discovery disabled |
| Agent Runtime | Active ADK request runtime | No long-running, asynchronous or cross-restart recovery proof |
| Memory Bank | Vertex services selectable by configuration | Submission uses in-memory state; persistent path not enabled or live-verified |
| Agent Identity | Deterministic application roles and tenant gates | No Google Cloud agent identity or SSO |
| Agent Gateway | `ContextOpsPolicyEngine` performs pre-tool ALLOW/DENY/CONFIRM checks; both cost-bearing routes share a global in-memory rate window, triage has a two-id cap, and a fleet run has a 15-call ceiling | No Google Agent Gateway service or authentication; the rate guard depends on max instances 1 |
| Model Armor | Deterministic pre-model injection and protected-file gates | Google Model Armor not integrated |
| Agent Observability | JSON/CSV audit, OTel span creation and request-end forced flush; two `contextops.audit.Intake___Triage` spans verified in Cloud Trace | Current exporter is deprecated and must migrate to OTLP before 2026-10-30 |

## Verification baseline

- 88 automated tests: 36 root (31 core + 5 rendered HTTP) and 52 agent.
- No live connectors or external writes.
- No production identities or customer data; all email addresses use `.example`.
- Cloud discovery and Vertex persistence remain disabled.
- Public `/triage` requires 1–2 ids; `/triage` and `/fleet/run` share 60 requests per
  10-minute in-memory global window, and one fleet run is capped at 15 LLM calls.
  Max instances must stay at one. This is a demo guard, not production authentication
  or a hard billing cap.
