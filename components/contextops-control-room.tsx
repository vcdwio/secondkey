"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApprovalWorkbench, type ApprovalState } from "@/components/approval-workbench";
import { AuditPanel } from "@/components/audit-panel";
import { ConnectorSummaryCard, IoMapCard } from "@/components/blueprint-cards";
import { EvalPanel } from "@/components/eval-panel";
import { ExecutionPanel } from "@/components/execution-panel";
import { ReadinessPanel } from "@/components/readiness-panel";
import { RoiPanel } from "@/components/roi-panel";
import { SecurityDrills } from "@/components/security-drills";
import { UnitInspector, type UnitRunResult } from "@/components/unit-inspector";
import {
  AUTHORITY_MATRIX,
  evaluateAuthority,
  rollbackExecution,
  simulateExecution,
  type ExecutionResult,
} from "@/lib/contextops/engine";
import { createCapacityReservationStore } from "@/lib/contextops/capacity";
import {
  AUD,
  CONFIDENCE_WEIGHTS,
  DECISION_SCOPE,
  PORTFOLIO,
  PORTFOLIO_CONFIDENCE,
  type QueueItem,
  UNIT_REGISTRY,
  pct,
  visibleQueue,
} from "@/lib/contextops/portfolio";
import { BUSINESS_UNITS } from "@/lib/contextops/units";
import type { AuditEvent, BusinessUnitId, ConfidenceSignals } from "@/lib/contextops/types";

const CORE_STEPS = ["Trigger", "Manager", "Context Quality", "Decision", "Approval", "Execution", "Audit / Eval"];
const AGENT_URL = process.env.NEXT_PUBLIC_AGENT_URL?.replace(/\/$/, "");

const CAPACITY_SEEDS = PORTFOLIO.incidents.flatMap((incident) =>
  incident.allocation.map((allocation) => ({
    staffId: allocation.staffId,
    availableHours: allocation.hours,
  })),
);

const VIEWS = [
  { id: "brief", label: "Daily Brief" },
  { id: "queue", label: "Priority Queue" },
  { id: "approval", label: "Waiting Approval" },
  { id: "value", label: "Value & ROI" },
  { id: "risk", label: "Risk & Safety" },
  { id: "trace", label: "Decision Trace" },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

const SEED_EVENTS: AuditEvent[] = [
  {
    id: "EV-1",
    time: "08:05",
    component: "Trigger",
    message: `${PORTFOLIO.source.emails} messages accepted, duplicates grouped into ${PORTFOLIO.incidents.length} units of work.`,
    status: "passed",
    actor: "platform service",
    evidence: ["emails.csv"],
  },
  {
    id: "EV-2",
    time: "08:05",
    component: "Security",
    message: "EM-023 quarantined as prompt injection; EM-030 denied as a cross-account request.",
    status: "passed",
    actor: "platform service",
    evidence: ["EM-023", "EM-030"],
  },
  {
    id: "EV-3",
    time: "08:06",
    component: "Context",
    message: "Active SLA policy v3 selected; archived v2 rejected.",
    status: "passed",
    actor: "platform service",
    evidence: ["VC_Priority_and_SLA_Policy_v3"],
  },
  {
    id: "EV-4",
    time: "08:06",
    component: "Approval",
    message: `${PORTFOLIO.capacitySummary.proposedHours}h reallocation and ${PORTFOLIO.outputs.client_email_drafts.length} client emails held for ${PORTFOLIO.approval.ownerName}.`,
    status: "pending",
    actor: "policy gate",
    evidence: [PORTFOLIO.approval.id],
  },
];

const AUDIT_TIME_FORMAT = new Intl.DateTimeFormat("en-AU", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Australia/Brisbane",
});

/**
 * New audit entries continue the scenario clock, not the viewer's wall clock.
 *
 * The seeded trail runs 08:05 → 08:06. Stamping live events with the local time
 * put a 13:42 above them and made the trail read as broken — and the value
 * changed with the viewer's timezone. Running the scenario clock forward in
 * real seconds keeps one coherent timeline and is the same for every viewer.
 */
function scenarioTimeLabel(mountedAt: number) {
  const elapsed = mountedAt ? Date.now() - mountedAt : 0;
  return AUDIT_TIME_FORMAT.format(new Date(new Date(PORTFOLIO.scenarioTime).getTime() + elapsed));
}

export function ContextOpsControlRoom() {
  const mountedAtRef = useRef(0);
  const [view, setView] = useState<ViewId>("brief");
  const [role, setRole] = useState("General Manager");
  const [selectedId, setSelectedId] = useState(PORTFOLIO.incidents[0].id);
  const [selectedUnit, setSelectedUnit] = useState<BusinessUnitId>("operations_scheduling");
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalState, setApprovalState] = useState<ApprovalState>("pending");
  const [scenarioRun, setScenarioRun] = useState(false);
  const [showConfidence, setShowConfidence] = useState(false);
  const [unitResults, setUnitResults] = useState<Partial<Record<BusinessUnitId, UnitRunResult>>>({});
  const [execution, setExecution] = useState<ExecutionResult[]>(() =>
    simulateExecution(PORTFOLIO.executionPlan, { taskId: PORTFOLIO.taskId, approved: false }),
  );
  const [rolledBack, setRolledBack] = useState(false);
  const capacityStore = useRef(createCapacityReservationStore(CAPACITY_SEEDS));
  const capacityReservations = useRef<string[]>([]);
  const [capacityLock, setCapacityLock] = useState<{
    status: "available" | "reserved" | "released" | "conflict";
    version: number;
  }>({ status: "available", version: 1 });
  const [events, setEvents] = useState<AuditEvent[]>(SEED_EVENTS);
  const [agentRuntime, setAgentRuntime] = useState(
    AGENT_URL ? "Google ADK runtime · checking" : "Google ADK runtime · local endpoint",
  );

  const profile = AUTHORITY_MATRIX[role] ?? AUTHORITY_MATRIX.Consultant;
  const verdict = evaluateAuthority(role, DECISION_SCOPE);
  const queue = useMemo(() => visibleQueue(profile.queueLimit, profile.clientCount), [profile]);
  const selected = queue.find((entry) => entry.item.id === selectedId) ?? queue[0];
  const activeUnit = BUSINESS_UNITS.find((unit) => unit.id === selectedUnit) ?? BUSINESS_UNITS[0];
  const activeRegistry = UNIT_REGISTRY.find((entry) => entry.id === activeUnit.id) ?? UNIT_REGISTRY[0];
  const capacityLockLabel = `capacity ${capacityLock.status} · optimistic lock v${capacityLock.version}`;
  const registryLabel = `Registry v${activeRegistry.version} · cross-department discoverable`;

  useEffect(() => {
    if (!AGENT_URL) return;
    const controller = new AbortController();
    fetch(`${AGENT_URL}/healthz`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Agent health unavailable");
        const body = await response.json() as { status?: string; external_write?: boolean };
        if (body.status !== "ok" || body.external_write !== false) {
          throw new Error("Agent health boundary invalid");
        }
        setAgentRuntime("Google ADK runtime · ready · writes disabled");
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setAgentRuntime("Google ADK runtime · unavailable · workflow held");
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    mountedAtRef.current = Date.now();
  }, []);

  const addEvent = useCallback(
    (event: Omit<AuditEvent, "id" | "time">) => {
      setEvents((list) => [
        { ...event, id: `EV-${list.length + 1}`, time: scenarioTimeLabel(mountedAtRef.current) },
        ...list,
      ]);
    },
    [],
  );

  function selectIncident(id: string) {
    setSelectedId(id);
    setShowConfidence(false);
  }

  function runScenario() {
    setScenarioRun(true);
    setApprovalState("pending");
    addEvent({
      component: "Manager",
      message: `Flagship scenario completed ${PORTFOLIO.trace.length} governed steps; status ${PORTFOLIO.traceStatus.replace("_", " ")}.`,
      status: "pending",
      actor: "platform service",
      evidence: [PORTFOLIO.taskId],
    });
  }

  function runUnit() {
    const scenarios = PORTFOLIO.evals.filter((item) => item.unit === activeUnit.name);
    const inputRefs = scenarios.flatMap((item) => item.input_refs).slice(0, 4);
    const approvalRequired = scenarios.some((item) => item.approval_required);
    const blocked = scenarios.flatMap((item) => item.prohibited_actions ?? []).slice(0, 2);
    const result: UnitRunResult = {
      runId: `DEMO-${activeUnit.id.toUpperCase()}-${String(activeUnit.order).padStart(3, "0")}`,
      taskId: `${PORTFOLIO.taskId}-U${String(activeUnit.order).padStart(2, "0")}`,
      outcome: activeUnit.outcome,
      inputRefs,
      evidenceCount: inputRefs.length || PORTFOLIO.packet.verified_facts.length,
      confidence: scenarios.length ? Math.min(0.95, 0.6 + scenarios.length * 0.08) : PORTFOLIO_CONFIDENCE.score,
      approvalRequired,
      externalWrite: false,
      blocked,
    };
    setUnitResults((results) => ({ ...results, [activeUnit.id]: result }));
    addEvent({
      component: activeUnit.shortName,
      message: `${activeUnit.name} demo run on ${inputRefs.length || "portfolio"} pack records; external_write=false.`,
      status: "passed",
      actor: `${profile.name} · ${role}`,
      evidence: inputRefs,
    });
  }

  function approveDecision(comment: string) {
    const reservationIds: string[] = [];
    const versions: number[] = [];
    for (const seed of CAPACITY_SEEDS) {
      const current = capacityStore.current.getCapacityState(seed.staffId);
      const reservation = capacityStore.current.reserveCapacity({
        staffId: seed.staffId,
        hours: seed.availableHours,
        taskId: PORTFOLIO.taskId,
        version: current.version,
      });
      if (!reservation.ok) {
        for (const reservationId of reservationIds) {
          capacityStore.current.releaseReservation(reservationId);
        }
        setCapacityLock({ status: "conflict", version: reservation.currentVersion });
        addEvent({
          component: "Capacity Lock",
          message: `Approval stopped: ${reservation.reason}; capacity was not oversold.`,
          status: "blocked",
          actor: `${profile.name} · ${role}`,
          evidence: [PORTFOLIO.taskId],
        });
        return;
      }
      reservationIds.push(reservation.reservationId);
      versions.push(reservation.newVersion);
    }
    capacityReservations.current = reservationIds;
    setCapacityLock({ status: "reserved", version: Math.max(...versions, 2) });
    setApprovalState("approved");
    setRolledBack(false);
    setExecution(simulateExecution(PORTFOLIO.executionPlan, { taskId: PORTFOLIO.taskId, approved: true }));
    addEvent({
      component: "Approval",
      message: `Approved ${PORTFOLIO.executionPlan.length} changes and reserved ${PORTFOLIO.capacitySummary.proposedHours}h with optimistic locks${comment.trim() ? ` — "${comment.trim()}"` : ""}. Simulated only; external_write stayed false.`,
      status: "passed",
      actor: `${profile.name} · ${role}`,
      evidence: [PORTFOLIO.approval.id],
    });
    setView("approval");
  }

  function rejectDecision(comment: string) {
    setApprovalState("rejected");
    setExecution(simulateExecution(PORTFOLIO.executionPlan, { taskId: PORTFOLIO.taskId, approved: false }));
    addEvent({
      component: "Approval",
      message: `Rejected and returned to the Manager — "${comment.trim()}"`,
      status: "blocked",
      actor: `${profile.name} · ${role}`,
      evidence: [PORTFOLIO.approval.id],
    });
  }

  function submitForApproval(comment: string, escalateTo: string) {
    addEvent({
      component: "Approval",
      message: `${role} cannot clear this decision (${verdict.blockedBy[0]}). Submitted to ${escalateTo}${comment.trim() ? ` — "${comment.trim()}"` : ""}.`,
      status: "blocked",
      actor: `${profile.name} · ${role}`,
      evidence: [PORTFOLIO.approval.id],
    });
    setApprovalOpen(false);
  }

  function rollback() {
    for (const reservationId of capacityReservations.current) {
      capacityStore.current.releaseReservation(reservationId);
    }
    capacityReservations.current = [];
    setCapacityLock({ status: "released", version: 3 });
    setExecution((results) => rollbackExecution(results));
    setRolledBack(true);
    addEvent({
      component: "Execution",
      message: "Rollback completed with stored idempotency keys; state matches the 08:00 snapshot.",
      status: "passed",
      actor: `${profile.name} · ${role}`,
      evidence: [PORTFOLIO.taskId],
    });
  }

  function resetDemo() {
    capacityStore.current.reset(CAPACITY_SEEDS);
    capacityReservations.current = [];
    setCapacityLock({ status: "available", version: 1 });
    setView("brief");
    setRole("General Manager");
    setSelectedId(PORTFOLIO.incidents[0].id);
    setSelectedUnit("operations_scheduling");
    setInspectorOpen(false);
    setApprovalOpen(false);
    setApprovalState("pending");
    setScenarioRun(false);
    setShowConfidence(false);
    setUnitResults({});
    setExecution(simulateExecution(PORTFOLIO.executionPlan, { taskId: PORTFOLIO.taskId, approved: false }));
    setRolledBack(false);
    setEvents(SEED_EVENTS);
  }

  function exportAudit() {
    const payload = {
      task_id: PORTFOLIO.taskId,
      environment: "demo",
      external_write: false,
      exported_by: `${profile.name} · ${role}`,
      events,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `secondkey-audit-${PORTFOLIO.taskId}.json`;
    link.click();
    URL.revokeObjectURL(url);
    addEvent({
      component: "Audit",
      message: `Exported ${events.length} audit events as JSON.`,
      status: "passed",
      actor: `${profile.name} · ${role}`,
    });
  }

  const navCounts: Record<ViewId, string> = {
    brief: String(queue.length),
    queue: String(queue.length),
    approval: approvalState === "pending" ? "1" : "0",
    value: `${Number(PORTFOLIO.roi.hoursSavedPerDay.toFixed(1))}h`,
    risk: String(PORTFOLIO.securityDrills.length),
    trace: String(PORTFOLIO.trace.length),
  };

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">
            S
          </div>
          <div>
            <strong>SecondKey</strong>
            <span>Governed Enterprise Agents</span>
          </div>
        </div>

        <nav className="primary-nav" aria-label="Primary navigation">
          {VIEWS.map((entry) => (
            <button
              className={view === entry.id ? "nav-item active" : "nav-item"}
              key={entry.id}
              aria-current={view === entry.id ? "page" : undefined}
              onClick={() => setView(entry.id)}
            >
              <span>{entry.label}</span>
              <em>{navCounts[entry.id]}</em>
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />

        <div className="environment-card">
          <div className="eyebrow">Environment</div>
          <div className="environment-switch" aria-label="Environment selection">
            <button className="selected">Demo</button>
            <button disabled title="Live connectors are not configured">
              Live · locked
            </button>
          </div>
          <p>External writes disabled</p>
          <p>{capacityLockLabel}</p>
          <p>{agentRuntime}</p>
        </div>

        <label className="role-picker">
          <span>View as</span>
          <select
            value={role}
            onChange={(event) => {
              const next = event.target.value;
              setRole(next);
              setSelectedId(PORTFOLIO.incidents[0].id);
              addEvent({
                component: "Access",
                message: `View switched to ${next}: ${AUTHORITY_MATRIX[next]?.scopeLabel ?? ""}.`,
                status: "passed",
                actor: `${AUTHORITY_MATRIX[next]?.name ?? next} · ${next}`,
              });
            }}
          >
            {Object.keys(AUTHORITY_MATRIX).map((entry) => (
              <option key={entry}>{entry}</option>
            ))}
          </select>
          <small>
            {profile.name} · {profile.scopeLabel}
          </small>
        </label>

      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <div className="eyebrow">Autonomy until it matters.</div>
            <h1>{VIEW_TITLES[view]}</h1>
            <p>The agent holds the first key. Irreversible actions wait for yours.</p>
            <p>
              Verge Consulting · {role} · {profile.clientCount} accounts in scope
            </p>
          </div>
          <div className="topbar-actions">
            <button className="ghost-button" onClick={resetDemo}>
              Reset
            </button>
            <button className="run-button" onClick={runScenario}>
              <span className="run-dot" /> Run Monday scenario
            </button>
          </div>
        </header>

        {view === "brief" && (
          <>
            <section className="metrics" aria-label="Portfolio summary">
              <article>
                <span>Immediate risk</span>
                <strong>
                  {queue.filter((entry) => entry.priority === "P0").length} <small>P0</small>
                </strong>
                <p>Computed from SLA clocks and committed dates</p>
              </article>
              <article>
                <span>Available capacity</span>
                <strong>
                  {PORTFOLIO.capacitySummary.availableStaff} <small>people</small>
                </strong>
                <p>{PORTFOLIO.capacitySummary.totalAvailableHours}h across matching skills</p>
              </article>
              <article>
                <span>Proposed move</span>
                <strong>
                  {PORTFOLIO.capacitySummary.proposedHours}
                  <small>h</small>
                </strong>
                <p>{PORTFOLIO.capacitySummary.switchingCostHours}h switching cost included</p>
              </article>
              <article>
                <span>Approval gate</span>
                <strong>
                  1 <small>{verdict.canApprove ? "you" : verdict.escalateTo === "General Manager" ? "GM" : "up"}</small>
                </strong>
                <p>{AUD.format(DECISION_SCOPE.spendAud)} spend + client communication</p>
              </article>
            </section>

            <section className="command-grid">
              <QueuePanel queue={queue} selectedId={selected.item.id} onSelect={selectIncident} profile={profile} />
              <DecisionPanel
                entry={selected}
                showConfidence={showConfidence}
                onToggleConfidence={() => setShowConfidence((value) => !value)}
                onOpenApproval={() => setApprovalOpen(true)}
                scenarioRun={scenarioRun}
                canApprove={verdict.canApprove}
                escalateTo={verdict.escalateTo}
              />
            </section>

            <section className="core-strip" aria-label="Shared ContextOps core">
              <div className="core-label">
                <span className="eyebrow">Shared platform core</span>
                <strong>One governed path for every Unit</strong>
              </div>
              <div className="core-flow">
                {CORE_STEPS.map((step, index) => (
                  <div className={scenarioRun ? "core-step passed" : "core-step"} key={step}>
                    <span>{index + 1}</span>
                    <strong>{step}</strong>
                    {index < CORE_STEPS.length - 1 && <i>→</i>}
                  </div>
                ))}
              </div>
              <div className="safety-state">
                <span />
                external_write: false
              </div>
            </section>

            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Business capability</span>
                  <h2>10 deployable Units</h2>
                </div>
                <span className="chip demo">All demo</span>
              </div>
              <div className="unit-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(196px, 1fr))" }}>
                {BUSINESS_UNITS.map((unit) => (
                  <button
                    className={unit.id === selectedUnit ? "unit-card selected" : "unit-card"}
                    key={unit.id}
                    onClick={() => {
                      setSelectedUnit(unit.id);
                      setInspectorOpen(true);
                    }}
                  >
                    <span className="unit-number">{String(unit.order).padStart(2, "0")}</span>
                    <span style={{ minWidth: 0 }}>
                      <strong>{unit.name}</strong>
                      <small>{unit.chineseName}</small>
                    </span>
                  </button>
                ))}
              </div>
              <div className="unit-peek">
                <div>
                  <span className="eyebrow">Selected Unit</span>
                  <strong>{activeUnit.name}</strong>
                </div>
                <p>{activeUnit.outcome}</p>
                <span className="chip pass">{registryLabel}</span>
                <button className="ghost-button" onClick={() => setInspectorOpen(true)}>
                  Open contract
                </button>
              </div>
            </article>

            <section className="blueprint-grid" aria-label="Platform blueprint">
              <IoMapCard />
              <ConnectorSummaryCard onOpenReadiness={() => setView("value")} />
              <EvalPanel />
            </section>

            <AuditPanel events={events} onExport={exportAudit} compact />
          </>
        )}

        {view === "queue" && <QueueTable queue={queue} onSelect={(id) => { selectIncident(id); setView("brief"); }} />}

        {view === "approval" && (
          <>
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Approval {PORTFOLIO.approval.id}</span>
                  <h2>Cross-client resource decision</h2>
                </div>
                <span className={`chip ${approvalState === "approved" ? "pass" : approvalState === "rejected" ? "alert" : "locked"}`}>
                  {approvalState}
                </span>
              </div>
              <p className="request-line">
                {PORTFOLIO.capacitySummary.proposedHours} staff hours across{" "}
                {DECISION_SCOPE.accountsTouched} accounts, {AUD.format(DECISION_SCOPE.spendAud)} contractor spend and{" "}
                {DECISION_SCOPE.externalCommunications} client emails. Owner: {PORTFOLIO.approval.ownerName}.
              </p>
              <div className={verdict.canApprove ? "authority-box" : "authority-box blocked"}>
                <strong>
                  {verdict.canApprove
                    ? `You (${role}) can clear this decision`
                    : `You (${role}) cannot clear this decision`}
                </strong>
                {!verdict.canApprove && (
                  <ul>
                    {verdict.blockedBy.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="decision-footer">
                <span className="note">
                  {PORTFOLIO.outputs.client_email_drafts.length} drafts written and held · {PORTFOLIO.trace.length} step
                  trace attached
                </span>
                <button className="approval-button" onClick={() => setApprovalOpen(true)}>
                  {verdict.canApprove ? "Open approval packet" : `Review and submit to ${verdict.escalateTo}`}
                </button>
              </div>
            </article>
            <ExecutionPanel
              results={execution}
              approved={approvalState === "approved"}
              onRollback={rollback}
              rolledBack={rolledBack}
              capacityStatus={capacityLock.status}
              capacityLockVersion={capacityLock.version}
            />
          </>
        )}

        {view === "value" && (
          <>
            <RoiPanel />
            <ReadinessPanel />
          </>
        )}

        {view === "risk" && (
          <>
            <SecurityDrills
              onFire={(drill) =>
                addEvent({
                  component: "Security",
                  message: `${drill.label} drill (${drill.sourceId}) → ${drill.verdict}. ${drill.outcome}`,
                  status: drill.verdict === "grouped" ? "passed" : "blocked",
                  actor: "platform service",
                  evidence: [drill.sourceId],
                })
              }
            />
            <EvalPanel />
          </>
        )}

        {view === "trace" && (
          <>
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Decision trace · {PORTFOLIO.taskId}</span>
                  <h2>Every step, and what it used</h2>
                </div>
                <span className="chip locked">{PORTFOLIO.traceStatus.replace("_", " ")}</span>
              </div>
              <div className="trace-list">
                {PORTFOLIO.trace.map((step) => (
                  <div className="trace-step" key={step.step}>
                    <span>{step.step}</span>
                    <div>
                      <strong>{step.component}</strong>
                      <p>{step.result}</p>
                    </div>
                  </div>
                ))}
              </div>
            </article>
            <article className="panel">
              <div className="panel-heading">
                <div>
                  <span className="eyebrow">Compact Context Packet</span>
                  <h2>What the decision was allowed to see</h2>
                </div>
                <span className="chip demo">
                  {PORTFOLIO.packet.verified_facts.length} facts · {PORTFOLIO.packet.conflicts.length} conflicts
                </span>
              </div>
              <pre className="packet" tabIndex={0} role="region" aria-label="Priority queue table">{JSON.stringify(PORTFOLIO.packet, null, 2)}</pre>
            </article>
            <AuditPanel events={events} onExport={exportAudit} />
          </>
        )}
      </section>

      <UnitInspector
        unit={activeUnit}
        registry={activeRegistry}
        open={inspectorOpen}
        result={unitResults[activeUnit.id]}
        onClose={() => setInspectorOpen(false)}
        onRun={runUnit}
      />
      {/* Rendered only while open so the packet always reopens on a clean tab and note. */}
      {approvalOpen && (
        <ApprovalWorkbench
          open={approvalOpen}
          state={approvalState}
          role={role}
          onClose={() => setApprovalOpen(false)}
          onApprove={(comment) => {
            approveDecision(comment);
            setApprovalOpen(false);
          }}
          onReject={(comment) => {
            rejectDecision(comment);
            setApprovalOpen(false);
          }}
          onSubmit={submitForApproval}
        />
      )}
    </main>
  );
}

const VIEW_TITLES: Record<ViewId, string> = {
  brief: "Seven clients. Three available people. One decision.",
  queue: "Every request, and why it sits where it sits",
  approval: "One decision is waiting on a person",
  value: "What the machine actually saved",
  risk: "The attacks it is supposed to survive",
  trace: "The whole decision, retraceable",
};


/**
 * Urgency, shown as time rather than as another colour.
 *
 * Priority (P0/P1/P2) is the *derived* label — impact crossed with urgency,
 * decided by scoreIncident(). It cannot order two items inside the same band:
 * four P1 rows all read "Explicit client commitment" and look interchangeable.
 * The clock restores that ordering from data the queue already holds, which is
 * how enterprise queues are normally read — the label says how bad, the clock
 * says how soon.
 */
/**
 * Shared demo clock.
 *
 * One interval for the whole queue rather than one per row. It starts at zero
 * so the server render and the first client render agree, then counts real
 * seconds off the scenario's SLA figures — the countdown a viewer watches is
 * genuinely running, not a still frame of a number.
 */
function useElapsedHours() {
  const [elapsedHours, setElapsedHours] = useState(0);
  useEffect(() => {
    const startedAt = Date.now();
    const id = window.setInterval(() => {
      setElapsedHours((Date.now() - startedAt) / 3_600_000);
    }, 1000);
    return () => window.clearInterval(id);
  }, []);
  return elapsedHours;
}

const pad2 = (value: number) => String(Math.floor(value)).padStart(2, "0");

const DUE_THIS_WEEK = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Australia/Brisbane",
});

/** Past a week a weekday alone is ambiguous — "Fri" could be either Friday. */
const DUE_LATER = new Intl.DateTimeFormat("en-AU", {
  day: "numeric",
  month: "short",
  timeZone: "Australia/Brisbane",
});

/**
 * Near deadlines get a ticking countdown, distant ones get a calendar anchor.
 *
 * 1.6h and 273h in the same column differ by a factor of 170 — as raw hours the
 * near one loses its urgency and the far one is a number nobody can picture.
 * Under two days the clock creates pressure; beyond that a weekday and time is
 * what a person actually plans against. Jira and PagerDuty both split here.
 */
function formatClock(hoursRemaining: number, scenarioTime: string) {
  if (hoursRemaining <= 0) return { value: "breached", label: "SLA", tone: "critical" };

  if (hoursRemaining < 24) {
    const seconds = Math.floor(hoursRemaining * 3600);
    return {
      value: `${Math.floor(seconds / 3600)}:${pad2((seconds % 3600) / 60)}:${pad2(seconds % 60)}`,
      label: "SLA left",
      tone: hoursRemaining <= 2 ? "critical" : "",
    };
  }

  if (hoursRemaining < 48) {
    return {
      value: `${Math.floor(hoursRemaining / 24)}d ${Math.round(hoursRemaining % 24)}h`,
      label: "SLA left",
      tone: "",
    };
  }

  const due = new Date(new Date(scenarioTime).getTime() + hoursRemaining * 3_600_000);
  const formatter = hoursRemaining < 24 * 6 ? DUE_THIS_WEEK : DUE_LATER;
  return { value: formatter.format(due), label: "due", tone: "far" };
}

function IncidentClock({ item, elapsedHours }: { item: QueueItem; elapsedHours: number }) {
  const sla = item.signals.slaHoursRemaining;
  const due = item.project?.deadlineInHours ?? null;
  const base = typeof sla === "number" ? sla : typeof due === "number" ? due : null;

  if (base === null) {
    return (
      <span className="incident-clock muted">
        <strong>—</strong>
        <small>no clock</small>
      </span>
    );
  }

  const clock = formatClock(base - elapsedHours, PORTFOLIO.scenarioTime);
  return (
    <span className={clock.tone ? `incident-clock ${clock.tone}` : "incident-clock"}>
      <strong>{clock.value}</strong>
      <small>{clock.label}</small>
    </span>
  );
}

function QueuePanel({
  queue,
  selectedId,
  onSelect,
  profile,
}: {
  queue: ReturnType<typeof visibleQueue>;
  selectedId: string;
  onSelect: (id: string) => void;
  profile: (typeof AUTHORITY_MATRIX)[string];
}) {
  const elapsedHours = useElapsedHours();
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Priority queue · {profile.clientCount} accounts in scope</span>
          <h2>What changed overnight</h2>
        </div>
        <span className="chip demo">{queue.length} visible</span>
      </div>
      <div className="incident-list">
        {queue.map((entry) => (
          <button
            className={entry.item.id === selectedId ? "incident active" : "incident"}
            key={entry.item.id}
            onClick={() => onSelect(entry.item.id)}
          >
            <span className={`priority ${entry.priority}`}>{entry.priority}</span>
            <span className="incident-copy">
              <strong>{entry.item.clientName}</strong>
              <small>{entry.priorityReasons[0]}</small>
            </span>
            <IncidentClock item={entry.item} elapsedHours={elapsedHours} />
            <span className="chevron">›</span>
          </button>
        ))}
      </div>
      {profile.clientCount < PORTFOLIO.clients.length && (
        <p className="scope-note">
          {PORTFOLIO.clients.length - profile.clientCount} accounts are hidden from this role. The records still exist;
          this view simply has no permission to read them.
        </p>
      )}
    </article>
  );
}

function DecisionPanel({
  entry,
  showConfidence,
  onToggleConfidence,
  onOpenApproval,
  scenarioRun,
  canApprove,
  escalateTo,
}: {
  entry: ReturnType<typeof visibleQueue>[number];
  showConfidence: boolean;
  onToggleConfidence: () => void;
  onOpenApproval: () => void;
  scenarioRun: boolean;
  canApprove: boolean;
  escalateTo: string;
}) {
  const { item, priority, priorityReasons, confidence, confidenceReasons } = entry;
  const signals = item.confidence as unknown as ConfidenceSignals;
  const lowConfidence = confidence < 0.7;
  const hasAllocation = item.allocation.length > 0;

  return (
    <article className="panel">
      <div className="decision-banner">
        <div>
          <span className="eyebrow">
            {item.clientName} · {item.tier} · {item.project?.name ?? "no active project"}
          </span>
          <h2>{headline(item, priority, hasAllocation)}</h2>
        </div>
        <button
          className={lowConfidence ? "confidence-button low" : "confidence-button"}
          onClick={onToggleConfidence}
          aria-expanded={showConfidence}
        >
          {pct(confidence)} confidence
        </button>
      </div>

      {showConfidence && (
        <div className="confidence-detail">
          {CONFIDENCE_WEIGHTS.map((weight) => (
            <div className="confidence-row" key={weight.key}>
              <span>{weight.label}</span>
              <i>× {weight.weight}</i>
              <b>{pct(Number(signals[weight.key]))}</b>
            </div>
          ))}
          <div className="confidence-total">
            {item.confidence.counts.facts} verified facts from {item.confidence.counts.sources} sources ·{" "}
            {item.confidence.counts.conflicts} conflicts · newest evidence{" "}
            {item.confidence.counts.newestEvidenceAgeHours}h old
            {confidenceReasons.length > 0 && ` · ${confidenceReasons.join("; ")}`}
          </div>
        </div>
      )}

      <p className="request-line">{item.request}</p>

      <div className="evidence-line">
        <span>Why {priority}:</span>
        {priorityReasons.map((reason) => (
          <code key={reason}>{reason}</code>
        ))}
        {item.signals.slaHoursRemaining !== null && (
          <code>SLA {item.signals.slaHoursRemaining}h left of {item.slaHours}h</code>
        )}
        {item.project && <code>due in {item.project.deadlineInHours}h</code>}
      </div>

      {hasAllocation ? (
        <div className="allocation-rows">
          {item.allocation.map((row) => (
            <div className="allocation-row" key={`${row.staffId}-${row.fromProject}`}>
              <span className="avatar">{row.initials}</span>
              <div>
                <strong>{row.name}</strong>
                <small>
                  {row.role} · from {row.fromProjectName} · {row.skills.join(", ")}
                </small>
              </div>
              <b>{row.hours}h</b>
            </div>
          ))}
        </div>
      ) : item.released.length > 0 ? (
        <div className="allocation-rows">
          {item.released.map((row) => (
            <div className="allocation-row" key={`${row.staffId}-${row.toProject}`}>
              <span className="avatar teal">{row.initials}</span>
              <div>
                <strong>{`${row.name} gives up ${row.hours}h`}</strong>
                <small>{`to ${row.toProjectName} · ${row.role}`}</small>
              </div>
              <b>{`-${row.hours}h`}</b>
            </div>
          ))}
        </div>
      ) : (
        <div className="allocation-rows">
          <div className="allocation-row">
            <span className="avatar teal">—</span>
            <div>
              <strong>No capacity moved for this account</strong>
              <small>
                {`${priority} work keeps its existing owner ${item.accountManager}. Prepared: ${item.tasks.length} task${item.tasks.length === 1 ? "" : "s"}, ${item.drafts.length} draft${item.drafts.length === 1 ? "" : "s"}.`}
              </small>
            </div>
            <b>0h</b>
          </div>
        </div>
      )}

      {lowConfidence && (
        <p className="missing-note">
          Confidence below the 70% threshold, so this stays a draft and the system asks for sources rather than acting.
          {item.confidence.missingInformation.length > 0 &&
            ` Missing: ${item.confidence.missingInformation.join("; ")}.`}
        </p>
      )}

      <div className="impact-box">
        <div>
          <span>Downstream impact</span>
          <strong>
            {hasAllocation
              ? `Pauses ${item.allocation[0].fromProjectName} · resumes with ${PORTFOLIO.capacitySummary.switchingCostHours}h switching cost`
              : item.id === "INTERNAL"
                ? "Prototype review moves one business day"
                : item.released.length > 0
                  ? `${item.released[0].name} returns at 13:00; analysis is delayed, not cancelled`
                  : `No change to other accounts; ${item.openTickets} open ticket${item.openTickets === 1 ? "" : "s"}`}
          </strong>
        </div>
        <div>
          <span>Account exposure</span>
          <strong>
            {item.annualValueAud > 0
              ? `${AUD.format(item.annualValueAud)} / year · health ${item.healthScore} · renews in ${item.renewalInDays}d`
              : "Internal work — no client exposure"}
          </strong>
        </div>
      </div>

      <div className="decision-footer">
        <div className="evidence-line">
          {item.confidence.evidence.slice(0, 2).map((fact) => (
            <code key={fact.sources.join()}>{fact.sources.join(" · ")}</code>
          ))}
          {item.evalScenarios.length > 0 && <code>{item.evalScenarios.join(" · ")}</code>}
        </div>
        <button className={canApprove ? "approval-button" : "approval-button blocked"} onClick={onOpenApproval}>
          {canApprove ? "Review approval packet" : `Submit to ${escalateTo}`}
        </button>
      </div>

      {scenarioRun && (
        <div className="run-notice" role="status">
          Scenario assembled · {PORTFOLIO.trace.length} core checks passed · {PORTFOLIO.traceStatus.replace("_", " ")}
        </div>
      )}
    </article>
  );
}

function headline(item: (typeof PORTFOLIO.incidents)[number], priority: string, hasAllocation: boolean) {
  if (item.id === "INTERNAL") return `Internal work releases ${item.releasedHours}h, and says so out loud.`;
  if (hasAllocation) return `Protect the ${priority} commitment without hiding the trade-off.`;
  if (item.released.length > 0) return `This account pays for the ${"P0"} rescue — ${item.releasedHours}h later today.`;
  if (priority === "P2") return "Nothing moves for this account today.";
  return `Prepare the ${priority} response, but do not spend capacity on it yet.`;
}

function QueueTable({
  queue,
  onSelect,
}: {
  queue: ReturnType<typeof visibleQueue>;
  onSelect: (id: string) => void;
}) {
  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Priority queue · computed, not assigned</span>
          <h2>{queue.length} units of work</h2>
        </div>
        <span className="chip demo">rules run on every row</span>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Context packet JSON">
        <table className="data">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Account</th>
              <th>Rule that fired</th>
              <th>SLA left</th>
              <th>Due in</th>
              <th>Confidence</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {queue.map((entry) => (
              <tr key={entry.item.id} className="selectable" onClick={() => onSelect(entry.item.id)}>
                <td>
                  <span className={`priority ${entry.priority}`} style={{ display: "inline-block", padding: "4px 8px" }}>
                    {entry.priority}
                  </span>
                </td>
                <td>
                  <strong>{entry.item.clientName}</strong>
                  <br />
                  <span className="note">{entry.item.request}</span>
                </td>
                <td>{entry.priorityReasons.join("; ")}</td>
                <td className="num">
                  {entry.item.signals.slaHoursRemaining === null ? "—" : `${entry.item.signals.slaHoursRemaining}h`}
                </td>
                <td className="num">{entry.item.project ? `${entry.item.project.deadlineInHours}h` : "—"}</td>
                <td className="num">{pct(entry.confidence)}</td>
                <td className="num">{entry.item.proposedHours}h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        Priority comes from scoreIncident() reading SLA clocks, project status and committed dates in the data pack.
        Change the pack and this table changes with it.
      </p>
    </article>
  );
}
