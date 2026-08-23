"use client";

import { useState } from "react";
import { PORTFOLIO } from "@/lib/contextops/portfolio";

type Drill = (typeof PORTFOLIO.securityDrills)[number];

const VERDICT_CHIP: Record<string, string> = {
  blocked: "alert",
  grouped: "demo",
  clarify: "locked",
  abstain: "locked",
  degraded: "locked",
};

export function SecurityDrills({ onFire }: { onFire: (drill: Drill) => void }) {
  const [fired, setFired] = useState<string[]>([]);
  const [active, setActive] = useState<Drill | null>(null);

  function run(drill: Drill) {
    setActive(drill);
    setFired((list) => (list.includes(drill.id) ? list : [...list, drill.id]));
    onFire(drill);
  }

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Adversarial input · run it live</span>
          <h2>Try to break it</h2>
        </div>
        <span className="chip pass">
          {fired.length} / {PORTFOLIO.securityDrills.length} run
        </span>
      </div>

      <p className="note">
        These are the hostile and broken messages in the data pack. Fire one and watch where it stops.
      </p>

      <div className="drill-grid">
        {PORTFOLIO.securityDrills.map((drill) => (
          <button
            key={drill.id}
            className={fired.includes(drill.id) ? "drill-button fired" : "drill-button"}
            onClick={() => run(drill)}
          >
            <strong>{drill.label}</strong>
            <small>{drill.sourceId} · {drill.from}</small>
          </button>
        ))}
      </div>

      {active && (
        <div className="drill-result" role="status">
          <div className="verdict-line">
            <span className={`chip ${VERDICT_CHIP[active.verdict] ?? "demo"}`}>{active.verdict}</span>
            <strong>{active.label}</strong>
            <span className="note">expected action · {active.expected}</span>
          </div>
          <div className="drill-payload">{active.payload}</div>
          <p className="note">
            <strong>Rule applied:</strong> {active.rule}
          </p>
          <p className="note">
            <strong>Outcome:</strong> {active.outcome}
          </p>
        </div>
      )}
    </article>
  );
}
