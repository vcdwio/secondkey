import { Fragment } from "react";
import { PORTFOLIO } from "@/lib/contextops/portfolio";

const STAGES = [
  { step: "01 · Input", title: "Request + entity hints", detail: "Email · CRM · Form · Event" },
  { step: "02 · Context Packet", title: "Verified facts + evidence", detail: "Identity · permission · freshness" },
  { step: "03 · Unit output", title: "Draft + recommendation", detail: "Sources · confidence · risk" },
  { step: "04 · Governed action", title: "Approval + simulated write", detail: "Rollback · trace · Eval" },
];

export function IoMapCard() {
  return (
    <article className="panel io-card">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Unit contract</span>
          <h3>Input / Output map</h3>
        </div>
        <span className="chip demo">Typed</span>
      </div>
      <div className="io-flow">
        {STAGES.map((stage, index) => (
          <Fragment key={stage.step}>
            <div>
              <span>{stage.step}</span>
              <strong>{stage.title}</strong>
              <small>{stage.detail}</small>
            </div>
            {index < STAGES.length - 1 && <i>→</i>}
          </Fragment>
        ))}
      </div>
    </article>
  );
}

export function ConnectorSummaryCard({ onOpenReadiness }: { onOpenReadiness: () => void }) {
  const ready = PORTFOLIO.connectors.filter((connector) => !connector.approval).length;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Integration boundary</span>
          <h3>API / MCP readiness</h3>
        </div>
        <span className="chip locked">Live connectors locked</span>
      </div>
      <div className="table-wrap" tabIndex={0} role="region" aria-label="Connector readiness summary">
        <table className="data" style={{ minWidth: 0 }}>
          <tbody>
            {PORTFOLIO.connectors.slice(0, 4).map((connector) => (
              <tr key={connector.id}>
                <td>
                  <strong>{connector.boundary}</strong>
                </td>
                <td>{connector.label}</td>
                <td className="num">{connector.approval ? "Approval only" : "Demo adapters"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        {ready} read-only connectors come first, writes last. No credential exists in this build.
      </p>
      <button className="ghost-button" onClick={onOpenReadiness}>
        See the full go-live checklist
      </button>
    </article>
  );
}
