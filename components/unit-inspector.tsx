"use client";

import { useDialog } from "@/components/use-dialog";
import { PORTFOLIO, pct } from "@/lib/contextops/portfolio";
import type { BusinessUnit } from "@/lib/contextops/types";

export interface UnitRunResult {
  runId: string;
  taskId: string;
  outcome: string;
  inputRefs: string[];
  evidenceCount: number;
  confidence: number;
  approvalRequired: boolean;
  externalWrite: false;
  blocked: string[];
}

export function UnitInspector({
  unit,
  open,
  result,
  onClose,
  onRun,
}: {
  unit: BusinessUnit;
  open: boolean;
  result?: UnitRunResult;
  onClose: () => void;
  onRun: () => void;
}) {
  const ref = useDialog(open, onClose);
  if (!open) return null;

  const scenarios = PORTFOLIO.evals.filter((item) => item.unit === unit.name);

  return (
    <div
      className="drawer-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <aside
        className="unit-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="unit-title"
        ref={ref as React.RefObject<HTMLElement>}
      >
        <header className="drawer-header">
          <div>
            <span className="eyebrow">Business Unit {String(unit.order).padStart(2, "0")}</span>
            <h2 id="unit-title">{unit.name}</h2>
            <p>{unit.chineseName}</p>
          </div>
          <button className="close-button" onClick={onClose} aria-label="Close Unit inspector">
            ×
          </button>
        </header>

        <div className="quality-band">
          <span>Target quality</span>
          <strong>{unit.qualityScore.toFixed(1)} / 10</strong>
          <i>
            <b style={{ width: `${unit.qualityScore * 10}%` }} />
          </i>
        </div>

        <p className="drawer-purpose">{unit.purpose}</p>

        <div className="contract-grid">
          <section>
            <span className="eyebrow">Input</span>
            {unit.input.map((item) => (
              <div className="contract-item" key={item}>
                <i>IN</i>
                <span>{item}</span>
              </div>
            ))}
          </section>
          <section>
            <span className="eyebrow">Output</span>
            {unit.output.map((item) => (
              <div className="contract-item" key={item}>
                <i>OUT</i>
                <span>{item}</span>
              </div>
            ))}
          </section>
        </div>

        <section className="drawer-section">
          <div className="drawer-section-title">
            <div>
              <span className="eyebrow">API / MCP</span>
              <strong>Connector requirements</strong>
            </div>
            <span className="chip locked">Live locked</span>
          </div>
          <div className="connector-tags">
            {unit.connectors.map((connector) => (
              <span key={connector}>
                {connector}
                <em>planned</em>
              </span>
            ))}
          </div>
          <p className="note">
            The demo adapter returns validated fictional records. No token, API key or network call is used.
          </p>
        </section>

        <section className="drawer-section">
          <div className="drawer-section-title">
            <div>
              <span className="eyebrow">Regression coverage</span>
              <strong>
                {scenarios.length} of {PORTFOLIO.evals.length} scenarios exercise this Unit
              </strong>
            </div>
          </div>
          {scenarios.length > 0 ? (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Unit regression coverage table">
              <table className="data">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Scenario</th>
                    <th>Must not do</th>
                  </tr>
                </thead>
                <tbody>
                  {scenarios.map((item) => (
                    <tr key={item.scenario_id}>
                      <td className="num">{item.scenario_id}</td>
                      <td>{item.title}</td>
                      <td>{(item.prohibited_actions ?? []).join("; ") || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="note">Covered indirectly through the portfolio scenarios.</p>
          )}
        </section>

        <section className="unit-route">
          <span>Trigger</span>
          <i>→</i>
          <span>Context Packet</span>
          <i>→</i>
          <strong>{unit.shortName}</strong>
          <i>→</i>
          <span>Approval</span>
          <i>→</i>
          <span>Audit</span>
        </section>

        {result ? (
          <section className="unit-result" role="status">
            <div>
              <span className="eyebrow">Latest demo run</span>
              <strong>{result.runId}</strong>
            </div>
            <p>{result.outcome}</p>
            <code>
              {[
                `task_id: ${result.taskId}`,
                `input_refs: ${result.inputRefs.join(", ") || "portfolio packet"}`,
                `evidence_used: ${result.evidenceCount}`,
                `confidence: ${pct(result.confidence)}`,
                `approval_required: ${result.approvalRequired}`,
                `external_write: ${result.externalWrite}`,
                result.blocked.length ? `blocked: ${result.blocked.join("; ")}` : null,
              ]
                .filter(Boolean)
                .join("\n")}
            </code>
          </section>
        ) : (
          <section className="empty-result">
            <span>No run yet</span>
            <p>Run this Unit against a sample request from the Verge data pack.</p>
          </section>
        )}

        <footer className="drawer-footer">
          <button className="ghost-button" onClick={onClose}>
            Close
          </button>
          <button className="run-button" onClick={onRun}>
            <span className="run-dot" /> Run Unit demo
          </button>
        </footer>
      </aside>
    </div>
  );
}
