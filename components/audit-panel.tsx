"use client";

import type { AuditEvent } from "@/lib/contextops/types";

export function AuditPanel({
  events,
  onExport,
  compact = false,
}: {
  events: AuditEvent[];
  onExport: () => void;
  compact?: boolean;
}) {
  const shown = compact ? events.slice(0, 6) : events;

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Audit trail · {events.length} events</span>
          <h2>Who did what, and on which evidence</h2>
        </div>
        <button className="ghost-button" onClick={onExport}>
          Export JSON
        </button>
      </div>

      <div className="audit-events">
        {shown.map((event) => (
          <div className="audit-event" key={event.id}>
            <span className={`event-dot ${event.status}`} />
            <time>{event.time}</time>
            <p>
              <strong>{event.component}</strong>
              {event.message}
              {event.actor && <em> — {event.actor}</em>}
            </p>
          </div>
        ))}
      </div>

      {compact && events.length > shown.length && (
        <p className="note">{events.length - shown.length} earlier events in the Decision trace view.</p>
      )}
    </article>
  );
}
