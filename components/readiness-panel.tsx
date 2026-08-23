"use client";

import { PORTFOLIO } from "@/lib/contextops/portfolio";

const GO_LIVE_STEPS = [
  { label: "Data pack validated", detail: "10 staff · 7 clients · 30 emails · 25 Eval scenarios", done: true },
  { label: "Deterministic rules under test", detail: "Priority, routing, confidence, approval and scope", done: true },
  { label: "Approval and separation of duties", detail: "Role limits enforced in the approval gate", done: true },
  { label: "Reversible execution", detail: "Idempotency key and rollback on every simulated write", done: true },
  { label: "Audit export", detail: "Every event exportable as JSON with actor and evidence", done: true },
  { label: "Read-only connector pilot", detail: "Drive and Gmail read scopes — not yet configured", done: false },
  { label: "SSO and directory sync", detail: "Roles mapped from the customer identity provider", done: false },
  { label: "Retention and residency", detail: "Log retention window and data region agreed", done: false },
];

export function ReadinessPanel() {
  const done = GO_LIVE_STEPS.filter((step) => step.done).length;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Integration boundary</span>
          <h2>What Live still needs</h2>
        </div>
        <span className="chip locked">
          {done} / {GO_LIVE_STEPS.length} ready
        </span>
      </div>

      <div>
        {GO_LIVE_STEPS.map((step) => (
          <div className={step.done ? "readiness-row done" : "readiness-row"} key={step.label}>
            <i>{step.done ? "✓" : "•"}</i>
            <div>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </div>
            <span className="chip demo">{step.done ? "done" : "before Live"}</span>
          </div>
        ))}
      </div>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Connector registry table">
        <table className="data">
          <thead>
            <tr>
              <th>#</th>
              <th>Connector</th>
              <th>Boundary</th>
              <th>Scope</th>
              <th>Write risk</th>
              <th>Approval</th>
              <th>Rollback</th>
            </tr>
          </thead>
          <tbody>
            {PORTFOLIO.connectors.map((connector) => (
              <tr key={connector.id}>
                <td className="num">{connector.order}</td>
                <td>{connector.label}</td>
                <td>{connector.boundary}</td>
                <td className="num">{connector.scope}</td>
                <td>{connector.writeRisk}</td>
                <td>{connector.approval ? "required" : "not required"}</td>
                <td>{connector.rollback ? "supported" : connector.scope === "read" ? "not applicable" : "human send only"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="note">
        Connection order is deliberate: read-only first, drafts second, writes last, sending last of all. No credential
        exists in this build.
      </p>
    </article>
  );
}
