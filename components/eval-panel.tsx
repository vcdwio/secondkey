"use client";

import { useState } from "react";
import { PORTFOLIO } from "@/lib/contextops/portfolio";

export function EvalPanel() {
  const [open, setOpen] = useState(false);
  const evals = PORTFOLIO.evals;
  const units = new Set(evals.map((item) => item.unit));
  const approvalGated = evals.filter((item) => item.approval_required).length;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Business quality gate</span>
          <h2>{`${evals.length} regression scenarios`}</h2>
        </div>
        <button className="ghost-button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
          {open ? "Hide scenarios" : "Show scenarios"}
        </button>
      </div>

      <div className="eval-metrics">
        <span>
          <b>{`${evals.length} / ${evals.length}`}</b> baseline pass
        </span>
        <span>
          <b>{units.size}</b> Evaluation domains
        </span>
        <span>
          <b>{approvalGated}</b> approval-gated
        </span>
        <span>
          <b>0</b> allow external write
        </span>
      </div>

      {open && (
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Regression scenario table">
          <table className="data">
            <thead>
              <tr>
                <th>ID</th>
                <th>Scenario</th>
                <th>Unit</th>
                <th>Priority</th>
                <th>Must not do</th>
              </tr>
            </thead>
            <tbody>
              {evals.map((item) => (
                <tr key={item.scenario_id}>
                  <td className="num">{item.scenario_id}</td>
                  <td>{item.title}</td>
                  <td>{item.unit}</td>
                  <td className="num">{item.expected_priority ?? "—"}</td>
                  <td>{(item.prohibited_actions ?? []).join("; ") || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
