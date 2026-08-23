"use client";

import { useState } from "react";
import { AUD, PORTFOLIO } from "@/lib/contextops/portfolio";

/**
 * The value case, with its assumptions exposed and editable. A buyer who does
 * not believe the minutes can change them here and watch the number move.
 */
export function RoiPanel() {
  const roi = PORTFOLIO.roi;
  const [rate, setRate] = useState(roi.assumptions.blendedHourlyRateAud);
  const [triageMinutes, setTriageMinutes] = useState(roi.assumptions.triageMinutesPerRequest);

  const triageHours = (roi.volumes.inboundRequests * triageMinutes) / 60;
  const otherHours = roi.lines
    .filter((line) => line.unit !== "requests")
    .reduce((total, line) => total + line.hours, 0);
  const perDay = triageHours + otherHours;
  const perWeek = perDay * roi.assumptions.workingDaysPerWeek;
  const labour = Math.round(perWeek * rate);

  return (
    <article className="panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Value case · Monday as a typical day</span>
          <h2>What this Monday saved</h2>
        </div>
        <span className="chip demo">assumptions editable</span>
      </div>

      <div className="roi-grid">
        <div className="roi-tile">
          <span>Hours returned / day</span>
          <strong>{perDay.toFixed(1)}</strong>
          <small>across {PORTFOLIO.source.staff} staff</small>
        </div>
        <div className="roi-tile">
          <span>Hours / week</span>
          <strong>{perWeek.toFixed(0)}</strong>
          <small>{roi.assumptions.workingDaysPerWeek} working days</small>
        </div>
        <div className="roi-tile">
          <span>Labour value / week</span>
          <strong>{AUD.format(labour)}</strong>
          <small>at {AUD.format(rate)}/h blended</small>
        </div>
        <div className="roi-tile">
          <span>SLA breaches avoided</span>
          <strong>{roi.volumes.slaBreachesAvoided}</strong>
          <small>{AUD.format(roi.slaValueAud)} exposure</small>
        </div>
      </div>

      <div className="table-wrap" tabIndex={0} role="region" aria-label="Work removed table">
        <table className="data">
          <thead>
            <tr>
              <th>Work removed</th>
              <th>Volume</th>
              <th>Minutes each</th>
              <th>Hours</th>
            </tr>
          </thead>
          <tbody>
            {roi.lines.map((line) => {
              const minutes = line.unit === "requests" ? triageMinutes : line.minutesEach;
              return (
                <tr key={line.label}>
                  <td>{line.label}</td>
                  <td className="num">
                    {line.volume} {line.unit}
                  </td>
                  <td className="num">{minutes}</td>
                  <td className="num">{((line.volume * minutes) / 60).toFixed(2)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="assumption-row">
        <label htmlFor="roi-rate">Blended rate AUD/h</label>
        <input
          id="roi-rate"
          type="number"
          value={rate}
          min={50}
          max={600}
          onChange={(event) => setRate(Number(event.target.value) || 0)}
        />
        <label htmlFor="roi-triage">Minutes per triaged request</label>
        <input
          id="roi-triage"
          type="number"
          value={triageMinutes}
          min={1}
          max={60}
          onChange={(event) => setTriageMinutes(Number(event.target.value) || 0)}
        />
      </div>

      <p className="note">{roi.note}</p>
    </article>
  );
}
