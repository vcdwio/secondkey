"use client";

import { useState } from "react";
import { useDialog } from "@/components/use-dialog";
import { evaluateAuthority } from "@/lib/contextops/engine";
import { AUD, DECISION_SCOPE, PORTFOLIO, PORTFOLIO_CONFIDENCE, pct } from "@/lib/contextops/portfolio";

export type ApprovalState = "pending" | "approved" | "rejected";

const TABS = [
  { id: "authority", label: "Authority" },
  { id: "why", label: "Why approval" },
  { id: "drafts", label: "Unsent drafts" },
  { id: "trace", label: "Decision trace" },
  { id: "packet", label: "Context Packet" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ApprovalWorkbench({
  open,
  state,
  role,
  onClose,
  onApprove,
  onReject,
  onSubmit,
}: {
  open: boolean;
  state: ApprovalState;
  role: string;
  onClose: () => void;
  onApprove: (comment: string) => void;
  onReject: (comment: string) => void;
  onSubmit: (comment: string, escalateTo: string) => void;
}) {
  const [tab, setTab] = useState<TabId>("authority");
  const [comment, setComment] = useState("");
  const ref = useDialog(open, onClose);
  const verdict = evaluateAuthority(role, DECISION_SCOPE);

  const approval = PORTFOLIO.approval;

  if (!open) return null;

  const packet = {
    task_id: PORTFOLIO.taskId,
    decision: `Reallocate ${PORTFOLIO.capacitySummary.proposedHours} staff hours`,
    accounts: PORTFOLIO.outputs.client_email_drafts.map((draft) => draft.client_id),
    contractor_cost_aud: approval.contractorCostAud,
    approval_required: approval.requiresApproval,
    approver: `${approval.ownerName} · ${approval.ownerRole}`,
    confidence: PORTFOLIO_CONFIDENCE.score,
    external_write: false,
    allowed_actions: PORTFOLIO.packet.allowed_actions,
    forbidden_actions: PORTFOLIO.packet.forbidden_actions,
    missing_information: PORTFOLIO.packet.missing_information,
    conflicts_resolved: PORTFOLIO.packet.conflicts,
  };

  const canAct = state === "pending";
  const rejectDisabled = state !== "pending" || comment.trim().length < 4;

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="decision-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        ref={ref as React.RefObject<HTMLElement>}
      >
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Approval {approval.id} · {PORTFOLIO.taskId}</span>
            <h2 id="approval-title">Cross-client resource decision</h2>
            <p>
              Decision owner · {approval.ownerName}, {approval.ownerRole} · limit{" "}
              {AUD.format(approval.ownerLimitAud)}
            </p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close approval">
            ×
          </button>
        </header>

        <div className={`approval-state ${state}`}>
          <span>
            {state === "pending"
              ? "Awaiting decision"
              : state === "approved"
                ? "Approved · changes simulated in the Demo Sandbox"
                : "Rejected · returned to the Manager for replanning"}
          </span>
          <strong>external_write: false — no external system was contacted</strong>
        </div>

        <div className="tabs" role="tablist" aria-label="Approval detail">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              role="tab"
              aria-selected={tab === entry.id}
              className={tab === entry.id ? "tab active" : "tab"}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
              {entry.id === "drafts" ? ` · ${PORTFOLIO.outputs.client_email_drafts.length}` : ""}
              {entry.id === "trace" ? ` · ${PORTFOLIO.trace.length}` : ""}
            </button>
          ))}
        </div>

        <div className="tab-body">
          {tab === "authority" && (
            <>
              <div className={verdict.canApprove ? "authority-box" : "authority-box blocked"}>
                <strong>
                  {verdict.canApprove
                    ? `${verdict.profile.name} (${role}) can clear this decision`
                    : `${verdict.profile.name} (${role}) cannot clear this decision`}
                </strong>
                {verdict.canApprove ? (
                  <p className="note">
                    Within limits: {DECISION_SCOPE.hoursAffected}h of {verdict.profile.maxHours === Infinity ? "unlimited" : `${verdict.profile.maxHours}h`},{" "}
                    {AUD.format(DECISION_SCOPE.spendAud)} of {AUD.format(verdict.profile.spendLimitAud)}, client
                    communication permitted.
                  </p>
                ) : (
                  <ul>
                    {verdict.blockedBy.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                )}
                {!verdict.canApprove && (
                  <p className="note">
                    Escalates to <strong>{verdict.escalateTo}</strong> · {approval.ownerName}. The request can be
                    submitted from here; it cannot be self-approved.
                  </p>
                )}
              </div>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Authority checks table">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>This decision</th>
                      <th>Role limit</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Staff hours moved</td>
                      <td className="num">{DECISION_SCOPE.hoursAffected}h</td>
                      <td className="num">
                        {verdict.profile.maxHours === Infinity ? "unlimited" : `${verdict.profile.maxHours}h`}
                      </td>
                      <td>{DECISION_SCOPE.hoursAffected <= verdict.profile.maxHours ? "Within limit" : "Blocked"}</td>
                    </tr>
                    <tr>
                      <td>Contractor spend</td>
                      <td className="num">{AUD.format(DECISION_SCOPE.spendAud)}</td>
                      <td className="num">{AUD.format(verdict.profile.spendLimitAud)}</td>
                      <td>{DECISION_SCOPE.spendAud <= verdict.profile.spendLimitAud ? "Within limit" : "Blocked"}</td>
                    </tr>
                    <tr>
                      <td>Client communications released</td>
                      <td className="num">{DECISION_SCOPE.externalCommunications}</td>
                      <td>{verdict.profile.mayApproveExternalComms ? "Permitted" : "Not permitted"}</td>
                      <td>
                        {DECISION_SCOPE.externalCommunications === 0 || verdict.profile.mayApproveExternalComms
                          ? "Within limit"
                          : "Blocked"}
                      </td>
                    </tr>
                    <tr>
                      <td>Accounts touched</td>
                      <td className="num">{DECISION_SCOPE.accountsTouched}</td>
                      <td>{verdict.profile.mayApproveCrossAccount ? "Cross-account" : "Single account"}</td>
                      <td>
                        {DECISION_SCOPE.accountsTouched <= 1 || verdict.profile.mayApproveCrossAccount
                          ? "Within limit"
                          : "Blocked"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="note">
                Separation of duties: the approver never executes. Execution runs under the platform service identity
                with the approver&apos;s decision id attached to every simulated call.
              </p>
            </>
          )}

          {tab === "why" && (
            <>
              <ul className="reason-list">
                {approval.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
                <li>
                  Downstream: {PORTFOLIO.outputs.proposed_calendar_changes.length} calendar changes and{" "}
                  {PORTFOLIO.outputs.internal_tasks.length} internal tasks depend on this decision.
                </li>
              </ul>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="People and hours table">
                <table className="data">
                  <thead>
                    <tr>
                      <th>Person</th>
                      <th>From</th>
                      <th>To</th>
                      <th>Hours</th>
                      <th>Why this person</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PORTFOLIO.incidents
                      .flatMap((item) => item.allocation)
                      .map((row) => (
                        <tr key={`${row.staffId}-${row.fromProject}`}>
                          <td>{row.name}</td>
                          <td>{row.fromProjectName}</td>
                          <td>{row.role}</td>
                          <td className="num">{row.hours}h</td>
                          <td>{row.skills.join(" · ")}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="note">
                Switching cost {PORTFOLIO.capacitySummary.switchingCostHours}h is already included. Movable capacity
                available today: {PORTFOLIO.capacitySummary.movableHours}h.
              </p>
            </>
          )}

          {tab === "drafts" && (
            <>
              <p className="note">
                Written and held. Nothing below has been sent, and nothing can be sent from Demo.
              </p>
              {PORTFOLIO.outputs.client_email_drafts.map((draft) => (
                <article className="draft-card" key={draft.client_id}>
                  <div className="draft-meta">
                    <span>To · {draft.to}</span>
                    <span className="chip locked">{draft.send_status.replace("_", " ")}</span>
                  </div>
                  <h4>{draft.subject}</h4>
                  <p>{draft.body}</p>
                </article>
              ))}
              {PORTFOLIO.outputs.crm_drafts.map((draft) => (
                <article className="draft-card" key={`${draft.client_id}-${draft.field}`}>
                  <div className="draft-meta">
                    <span>CRM · {draft.client_id}</span>
                    <span className="chip locked">draft only</span>
                  </div>
                  <h4>
                    {draft.field}: {draft.current} → {draft.proposed}
                  </h4>
                  <p>Applied only after approval, and only as a simulated write in this environment.</p>
                </article>
              ))}
            </>
          )}

          {tab === "trace" && (
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
          )}

          {tab === "packet" && (
            <>
              <p className="note">
                The decision consumed this packet, not the full data pack: {PORTFOLIO.packet.verified_facts.length}{" "}
                verified facts from {PORTFOLIO.portfolioConfidence.counts.sources} sources, confidence{" "}
                {pct(PORTFOLIO_CONFIDENCE.score)}.
              </p>
              <pre className="packet" tabIndex={0} role="region" aria-label="Context packet JSON">{JSON.stringify(packet, null, 2)}</pre>
            </>
          )}
        </div>

        <div className="approval-actions">
          <div className="comment-field">
            <label htmlFor="approval-comment">
              Decision note {state === "pending" ? "(required to reject)" : ""}
            </label>
            <textarea
              id="approval-comment"
              value={comment}
              placeholder="Recorded in the audit trail against your name and role."
              onChange={(event) => setComment(event.target.value)}
              disabled={state !== "pending"}
            />
          </div>
          <button className="reject-button" onClick={() => onReject(comment)} disabled={rejectDisabled}>
            Reject and return
          </button>
          <button
            className="approve-button"
            onClick={() => (verdict.canApprove ? onApprove(comment) : onSubmit(comment, verdict.escalateTo))}
            disabled={!canAct}
          >
            {verdict.canApprove ? "Approve simulated changes" : `Submit to ${verdict.escalateTo}`}
          </button>
        </div>
      </section>
    </div>
  );
}
