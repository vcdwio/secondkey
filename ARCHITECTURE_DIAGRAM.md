# SecondKey — System Architecture

> The agent holds the first key. Irreversible actions wait for yours.

## Submission architecture

Solid lines below are implemented and locally verified. The Google Cloud deployment is
partially live-verified: Cloud Run revisions are Ready, and a Cloud Build smoke run used
service-account ADC to call Vertex AI successfully. The Cloud Run public route is not
yet verified because Google's front end currently returns 404 before reaching the
container.

```mermaid
flowchart TB
    subgraph local["Implemented submission"]
        UI["SecondKey Control Room<br/>React operator views"]
        DATA["Fictional Verge Consulting pack<br/>10 staff · 7 clients · 30 emails"]
        CORE["Deterministic ContextOps core<br/>priority · context · capacity · authority"]
        APPROVAL{"Human approval boundary"}
        SIM["Simulated execution<br/>external_write: false"]
        AUDIT["JSON / CSV audit<br/>OpenTelemetry spans"]
        REG["Local Unit registry<br/>10 synchronized contracts"]

        DATA --> CORE
        CORE --> UI
        CORE --> APPROVAL
        APPROVAL --> SIM
        SIM --> AUDIT
        REG --> UI
    end

    subgraph agent["Google ADK triage runtime"]
        GATES["Pre-model deterministic gates<br/>identity · tenant · injection · duplicate"]
        RUN["ADK Runner<br/>one LlmAgent + SecurityPlugin"]
        TOOL["score_priority FunctionTool<br/>returns server-owned priority"]
        MEM["In-memory session + memory"]

        GATES -->|"queued only"| RUN
        RUN --> TOOL
        RUN --> MEM
    end

    DATA --> GATES
    TOOL --> AUDIT

    subgraph cloud["Google Cloud path — partially live-verified"]
        CR["Cloud Run target<br/>Australia region"]
        SA["Dedicated service account<br/>Application Default Credentials"]
        VAI["Vertex AI<br/>gemini-3.7-flash · global"]
        TRACE["Cloud Trace / Logging exporter"]
        PERSIST["Vertex Session Service + Memory Bank<br/>wired · disabled in submission"]
        DISC["Cloud Agent Registry discovery<br/>flagged off in submission"]

        CR --> SA --> VAI
        CR --> TRACE
        CR -.-> PERSIST
        CR -.-> DISC
    end

    RUN -.-> CR

    classDef verified fill:#e6f4ea,stroke:#188038,color:#0d652d
    classDef deterministic fill:#fef7e0,stroke:#f9ab00,color:#8a5a12
    classDef prepared fill:#e8f0fe,stroke:#1a73e8,color:#174ea6,stroke-dasharray:5 5
    class UI,DATA,APPROVAL,SIM,AUDIT,REG,GATES,RUN,TOOL,MEM verified
    class CORE deterministic
    class CR,SA,VAI,TRACE,PERSIST,DISC prepared
```

Public copy says **Australia region**; the deployment command in `README.md` retains
Google Cloud's exact provider region identifier because the CLI requires it. Gemini
model inference uses Vertex AI's `global` location, so SecondKey makes no Australian
data-residency or region-pinned inference claim.

## Two governed paths

### Real ADK triage path

```mermaid
sequenceDiagram
    autonumber
    participant M as Inbound email
    participant D as Deterministic gates
    participant A as ADK LlmAgent
    participant V as Gemini 3.7 Flash
    participant T as score_priority tool
    participant O as Audit

    M->>D: raw message
    D->>D: identity, tenant, injection, duplicate checks
    alt blocked or duplicate
        D->>O: reject, quarantine, or link duplicate
    else queued
        D->>A: sanitized envelope + server priority state
        A->>V: extract summary, intent, urgency phrases
        V->>T: required function call
        T-->>A: deterministic priority + reasons
        A->>O: traceable triage result
    end
```

Gemini cannot set identity, permission, priority, staffing, spend, or external action.
The only live model tool is `score_priority`; it reads the priority already computed by
server rules and returns it with `external_write: false`.

### Portfolio approval path

```mermaid
sequenceDiagram
    autonumber
    participant C as ContextOps core
    participant P as Policy check
    participant H as Human GM
    participant X as Simulated execution
    participant A as Audit

    C->>P: 12h, A$1,800, 2 emails, 2 accounts, acting role
    P->>P: evaluateAuthority()
    alt within role limits
        P->>X: prepare reversible calls
    else exceeds role limits
        P-->>H: blocking reasons + approval packet
        H->>P: approve or reject with note
        P->>X: prepare only after approval
    end
    X->>A: 11 simulated calls · 9 reversible · no external write
```

This approval workflow is implemented in the deterministic application core and UI.
It is not an ADK `requireConfirmation` or long-running resumability flow in the current
submission.

## Hackathon evidence map

| Requirement | Implemented evidence | Honest boundary |
|---|---|---|
| Gemini 3.5 or newer | `gemini-3.7-flash`; a successful Cloud Build smoke used ADC to call Vertex AI and exercised four triage cases | The same path through the Cloud Run URL is not yet verified |
| Google Agent Framework | ADK `Runner`, one `LlmAgent`, one `FunctionTool`, `SecurityPlugin` | No `SequentialAgent` or `LongRunningFunctionTool` |
| Google Cloud | Ready Cloud Run revisions in two Australia regions; successful Cloud Build-to-Vertex smoke (`e8a0c467-5940-4777-ba0a-7cf788a61444`) | Google-front 404 currently blocks hosted endpoint proof |
| Discovery & lifecycle | 10 generated local Unit contracts | Cloud discovery is behind `CONTEXTOPS_CLOUD_REGISTRY=false` |
| State and memory | ADK in-memory session and memory verified | Vertex persistence is wired but disabled and not live-verified |
| Security and governance | deterministic pre-model gates plus `ContextOpsPolicyEngine` tests | No Model Armor or cloud identity federation |
| Telemetry | audit spans plus JSON and formula-safe CSV | Cloud exporter is prepared, not yet evidenced online |

## Deliberate exclusions

- No live connectors or external writes.
- No production identities or customer data; every email uses a `.example` domain.
- No persistent state claim in this submission: `CONTEXTOPS_STATE_BACKEND=memory`.
- No Cloud Agent Registry claim: `CONTEXTOPS_CLOUD_REGISTRY=false`.
- No regional inference or data-residency claim: the model endpoint is `global`.
