import model from "./generated/portfolio.json" with { type: "json" };
import registry from "./generated/registry.json" with { type: "json" };
import { calculateConfidence, scoreIncident } from "./engine.ts";
import type { ConfidenceSignals, IncidentSignals, Priority } from "./types.ts";

/**
 * Every number the control room shows comes from here. The JSON is generated
 * from the Verge data pack by `npm run data` — nothing is typed in by hand.
 */
export const PORTFOLIO = model;
export const UNIT_REGISTRY = registry;
export type UnitRegistryEntry = (typeof registry)[number];

export type QueueItem = (typeof model.incidents)[number];

export interface ScoredItem {
  item: QueueItem;
  priority: Priority;
  priorityReasons: string[];
  confidence: number;
  confidenceReasons: string[];
}

export function scoreQueueItem(item: QueueItem): ScoredItem {
  const { priority, reasons } = scoreIncident(item.signals as IncidentSignals);
  const confidence = calculateConfidence(item.confidence as unknown as ConfidenceSignals);
  return {
    item,
    priority,
    priorityReasons: reasons,
    confidence: confidence.score,
    confidenceReasons: confidence.reasons,
  };
}

/** Queue order: severity first, then the tightest SLA clock. */
export const SCORED_QUEUE: ScoredItem[] = model.incidents
  .map(scoreQueueItem)
  .sort((a, b) => {
    if (a.priority !== b.priority) return a.priority.localeCompare(b.priority);
    const left = a.item.signals.slaHoursRemaining ?? 999;
    const right = b.item.signals.slaHoursRemaining ?? 999;
    return left - right;
  });

export const PORTFOLIO_CONFIDENCE = calculateConfidence(
  model.portfolioConfidence as unknown as ConfidenceSignals,
);

export const CONFIDENCE_WEIGHTS: Array<{ key: keyof ConfidenceSignals; label: string; weight: number }> = [
  { key: "evidenceCoverage", label: "Evidence coverage", weight: 0.3 },
  { key: "sourceAuthority", label: "Source authority", weight: 0.2 },
  { key: "freshness", label: "Freshness", weight: 0.15 },
  { key: "sourceAgreement", label: "Source agreement", weight: 0.15 },
  { key: "deterministicCoverage", label: "Deterministic rules", weight: 0.1 },
  { key: "evalHistory", label: "Eval history", weight: 0.1 },
];

/** Scope of the cross-client decision, used by the authority check. */
export const DECISION_SCOPE = {
  hoursAffected: PORTFOLIO.capacitySummary.proposedHours,
  spendAud: PORTFOLIO.approval.contractorCostAud,
  externalCommunications: PORTFOLIO.outputs.client_email_drafts.length,
  accountsTouched: new Set(
    PORTFOLIO.approval.reasons.length
      ? PORTFOLIO.outputs.client_email_drafts.map((draft) => draft.client_id)
      : [],
  ).size,
};

export function visibleQueue(queueLimit: number, clientCount: number): ScoredItem[] {
  const clientItems = SCORED_QUEUE.filter((entry) => entry.item.id !== "INTERNAL").slice(0, clientCount);
  const internal = SCORED_QUEUE.filter((entry) => entry.item.id === "INTERNAL");
  return [...clientItems, ...internal].slice(0, queueLimit);
}

export const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export const pct = (value: number) => `${Math.round(value * 100)}%`;
