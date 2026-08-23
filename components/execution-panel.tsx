"use client";

import type { ExecutionResult } from "@/lib/contextops/engine";

export function ExecutionPanel({
  results,
  approved,
  onRollback,
  rolledBack,
  capacityStatus,
  capacityLockVersion,
}: {
  results: ExecutionResult[];
  approved: boolean;
  onRollback: () => void;
  rolledBack: boolean;
  capacityStatus: "available" | "reserved" | "released" | "conflict";
  capacityLockVersion: number;
}) {
  const reversible = results.filter((item) => item.reversible).length;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">After approval</span>
          <h2>What actually happens</h2>
        </div>
        {approved && !rolledBack && (
          <button className="ghost-button" onClick={onRollback}>
            Roll back everything
          </button>
        )}
      </div>

      <p className="note">
        {approved
          ? `${results.length} changes prepared, ${reversible} of them reversible. Every call below was built and
             checked, then stopped at the environment boundary.`
          : `${results.length} changes are staged behind the approval gate. Nothing is prepared for sending until a
             person with authority decides.`}
      </p>

      <p className="run-notice" role="status">
        capacity {capacityStatus} · optimistic lock v{capacityLockVersion}
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {results.map((item) => (
          <div className="exec-row" key={item.id}>
            <span className={`status-pill ${item.status}`}>{item.status.replace("_", " ")}</span>
            <div>
              <strong>{item.summary}</strong>
              <code>
                {item.method} {item.endpoint} · {item.target} · key {item.idempotencyKey}
              </code>
            </div>
            {item.reversible ? (
              <span className="chip demo">reversible</span>
            ) : (
              <span className="irreversible">needs human send</span>
            )}
          </div>
        ))}
      </div>

      {rolledBack && (
        <p className="run-notice" role="status">
          Rolled back. Every reversible change is back to the 08:00 snapshot; the two client emails never left draft.
        </p>
      )}
    </article>
  );
}
