import type {
  ConfidenceSignals,
  ContextRequest,
  EvidenceRecord,
  IncidentSignals,
  Priority,
} from "./types.ts";

export {
  createCapacityReservationStore,
  getCapacityState,
  releaseReservation,
  reserveCapacity,
  resetCapacityReservations,
} from "./capacity.ts";
export {
  AUTHORITY_MATRIX,
  evaluateAuthority,
  type AuthorityProfile,
  type AuthorityVerdict,
  type DecisionScope,
} from "./authority.ts";

export function scoreIncident(signals: IncidentSignals): {
  priority: Priority;
  reasons: string[];
} {
  if (signals.slaHoursRemaining !== null && signals.slaHoursRemaining <= 4) {
    return { priority: "P0", reasons: ["Inside the four-hour SLA risk window"] };
  }
  if (signals.launchBlockedTomorrow) {
    return { priority: "P0", reasons: ["Tomorrow's committed launch is blocked"] };
  }
  if (signals.explicitCommitment || signals.renewalRisk) {
    return {
      priority: "P1",
      reasons: [signals.explicitCommitment ? "Explicit client commitment" : "Renewal risk"],
    };
  }
  if (signals.internalWork) {
    return { priority: "P2", reasons: ["Movable internal work yields to client incidents"] };
  }
  return { priority: "P2", reasons: ["No immediate SLA or commitment trigger"] };
}

export function routeTask({
  handoffCount,
  nextUnitId,
}: {
  handoffCount: number;
  nextUnitId: string;
}) {
  if (handoffCount >= 5) {
    return {
      status: "human_review" as const,
      handoffCount,
      nextUnitId: null,
      reason: "Five-handoff limit reached",
    };
  }
  return {
    status: "routed" as const,
    handoffCount: handoffCount + 1,
    nextUnitId,
    reason: "Route accepted",
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function calculateConfidence(signals: ConfidenceSignals) {
  const score =
    clamp(signals.evidenceCoverage) * 0.3 +
    clamp(signals.sourceAuthority) * 0.2 +
    clamp(signals.freshness) * 0.15 +
    clamp(signals.sourceAgreement) * 0.15 +
    clamp(signals.deterministicCoverage) * 0.1 +
    clamp(signals.evalHistory) * 0.1;

  const reasons: string[] = [];
  if (signals.evidenceCoverage === 1) reasons.push("Evidence coverage complete");
  if (signals.freshness < 0.8) reasons.push("Some evidence may be stale");
  if (signals.sourceAgreement < 0.75) reasons.push("Sources disagree");
  if (signals.deterministicCoverage === 1) reasons.push("Deterministic rules fully evaluated");

  return { score: Number(score.toFixed(3)), reasons };
}

export function buildContextPacket(
  request: ContextRequest,
  records: EvidenceRecord[],
) {
  const evidence = records
    .filter(
      (record) =>
        record.tenantId === request.tenantId &&
        record.entityId === request.entityId &&
        request.permissionGroups.includes(record.permissionGroup) &&
        record.status === "active",
    )
    .sort((a, b) => b.version - a.version || b.authority - a.authority);

  return {
    taskId: request.taskId,
    entityId: request.entityId,
    evidence,
    rejectedCount: records.length - evidence.length,
    allowedActions: ["draft_email", "create_task"],
  };
}

export function proposeExecution({
  action,
  external,
  approved,
}: {
  action: string;
  external: boolean;
  approved: boolean;
}) {
  const approvalRequired = external;
  const externalWrite = external && approved;

  return {
    action,
    status: external && !approved ? "awaiting_approval" : "ready",
    approvalRequired,
    externalWrite,
  };
}

export function getRoleScope(role: string) {
  if (role === "Account Manager") {
    return { clientCount: 3, queueLimit: 3, label: "Assigned client accounts only" };
  }
  if (role === "Consultant") {
    return { clientCount: 2, queueLimit: 2, label: "Assigned delivery work only" };
  }
  if (role === "Delivery Manager") {
    return { clientCount: 7, queueLimit: 5, label: "Portfolio delivery and capacity" };
  }
  return { clientCount: 7, queueLimit: 5, label: "Portfolio-wide decision authority" };
}

export type ExecutionStatus = "queued" | "simulated" | "rolled_back" | "held";

export interface ExecutionItem {
  id: string;
  kind: string;
  connector: string;
  target: string;
  summary: string;
  method: string;
  endpoint: string;
  reversible: boolean;
}

export interface ExecutionResult extends ExecutionItem {
  status: ExecutionStatus;
  externalWrite: false;
  idempotencyKey: string;
  detail: string;
}

/**
 * Demo execution never leaves the process. It produces the request that *would*
 * be sent, an idempotency key, and a reversible flag, so a reviewer can see the
 * exact blast radius before Live is ever unlocked.
 */
export function simulateExecution(
  items: ExecutionItem[],
  { taskId, approved }: { taskId: string; approved: boolean },
): ExecutionResult[] {
  return items.map((item, index) => ({
    ...item,
    externalWrite: false as const,
    idempotencyKey: `${taskId}-${item.id}-${String(index + 1).padStart(2, "0")}`,
    status: approved ? "simulated" : "held",
    detail: approved
      ? `Simulated ${item.method} ${item.endpoint} — payload prepared, nothing sent.`
      : "Held behind the approval gate.",
  }));
}

export function rollbackExecution(results: ExecutionResult[]): ExecutionResult[] {
  return results.map((result) => ({
    ...result,
    status: result.reversible ? "rolled_back" : result.status,
    detail: result.reversible
      ? "Rolled back with the stored idempotency key; state matches the pre-approval snapshot."
      : "Not reversible by design — this is why it stays behind a human send step.",
  }));
}

/* ------------------------------------------------------------------------ */
/* Deterministic capacity allocation                                         */
/* ------------------------------------------------------------------------ */

export interface CapacityDemand {
  id: string;
  priority: Priority;
  hoursNeeded: number;
  slaRemainingMinutes: number;
  requiredSkills: string[];
}

export interface CapacityStaff {
  id: string;
  skills: string[];
  availableHours: number;
}

export interface MovableCapacity {
  staffId: string;
  projectId: string;
  hours: number;
  switchingCostHours: number;
}

export interface CapacityAllocation {
  assignments: Array<{
    staffId: string;
    demandId: string;
    hours: number;
    skillMatch: number;
    rationale: string;
  }>;
  released: Array<{ staffId: string; fromProjectId: string; hours: number }>;
  unmet: Array<{ demandId: string; hoursShort: number; reason: string }>;
  totalSwitchingCostHours: number;
}

const PRIORITY_ORDER: Record<Priority, number> = { P0: 0, P1: 1, P2: 2 };
const CAPACITY_EPSILON = 1e-9;

function capacityHours(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundedHours(value: number) {
  return Number(value.toFixed(3));
}

function capacitySkillMatch(requiredSkills: string[], staffSkills: Set<string>) {
  const required = [...new Set(requiredSkills)];
  if (required.length === 0) return 1;
  const matched = required.filter((skill) => staffSkills.has(skill)).length;
  return Number((matched / required.length).toFixed(3));
}

/**
 * Allocates scarce hours with rules that are inspectable and repeatable:
 * priority, SLA, skill coverage, remaining capacity and finally staff ID.
 * Free hours are always consumed before a planned block is released.
 *
 * `movable` is an approval-filtered list: callers decide which planned blocks
 * may be released before invoking this function. The allocator never expands
 * that authority on its own.
 */
export function allocateCapacity(input: {
  demands: CapacityDemand[];
  staff: CapacityStaff[];
  movable: MovableCapacity[];
}): CapacityAllocation {
  const staffState = new Map(
    [...input.staff]
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((person) => [
        person.id,
        {
          id: person.id,
          skills: new Set(person.skills),
          freeHours: capacityHours(person.availableHours),
        },
      ]),
  );
  const blocks = input.movable
    .map((block, index) => ({
      ...block,
      index,
      remainingHours: capacityHours(block.hours),
      switchingCostHours: capacityHours(block.switchingCostHours),
      costCounted: false,
    }))
    .filter((block) => staffState.has(block.staffId) && block.remainingHours > CAPACITY_EPSILON);
  const demands = [...input.demands].sort(
    (a, b) =>
      PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
      a.slaRemainingMinutes - b.slaRemainingMinutes ||
      a.id.localeCompare(b.id),
  );

  const assignmentParts = new Map<
    string,
    {
      staffId: string;
      demandId: string;
      hours: number;
      freeHours: number;
      releasedHours: number;
      skillMatch: number;
    }
  >();
  const releases = new Map<string, { staffId: string; fromProjectId: string; hours: number }>();
  const unmet: CapacityAllocation["unmet"] = [];
  let switchingCost = 0;

  function recordAssignment(
    staffId: string,
    demandId: string,
    hours: number,
    skillMatch: number,
    source: "free" | "released",
  ) {
    const key = `${demandId}\u0000${staffId}`;
    const current = assignmentParts.get(key) ?? {
      staffId,
      demandId,
      hours: 0,
      freeHours: 0,
      releasedHours: 0,
      skillMatch,
    };
    current.hours += hours;
    if (source === "free") current.freeHours += hours;
    else current.releasedHours += hours;
    assignmentParts.set(key, current);
  }

  for (const demand of demands) {
    let hoursShort = capacityHours(demand.hoursNeeded);
    if (hoursShort <= CAPACITY_EPSILON) continue;

    while (hoursShort > CAPACITY_EPSILON) {
      const candidates = [...staffState.values()]
        .map((person) => ({
          person,
          skillMatch: capacitySkillMatch(demand.requiredSkills, person.skills),
        }))
        .filter(({ person, skillMatch }) => person.freeHours > CAPACITY_EPSILON && skillMatch > 0)
        .sort(
          (a, b) =>
            b.skillMatch - a.skillMatch ||
            b.person.freeHours - a.person.freeHours ||
            a.person.id.localeCompare(b.person.id),
        );
      const selected = candidates[0];
      if (!selected) break;
      const assigned = Math.min(hoursShort, selected.person.freeHours);
      selected.person.freeHours -= assigned;
      hoursShort -= assigned;
      recordAssignment(selected.person.id, demand.id, assigned, selected.skillMatch, "free");
    }

    while (hoursShort > CAPACITY_EPSILON) {
      const candidates = [...staffState.values()]
        .map((person) => ({
          person,
          skillMatch: capacitySkillMatch(demand.requiredSkills, person.skills),
          releasableHours: blocks
            .filter((block) => block.staffId === person.id)
            .reduce((total, block) => total + block.remainingHours, 0),
        }))
        .filter(({ releasableHours, skillMatch }) => releasableHours > CAPACITY_EPSILON && skillMatch > 0)
        .sort(
          (a, b) =>
            b.skillMatch - a.skillMatch ||
            b.releasableHours - a.releasableHours ||
            a.person.id.localeCompare(b.person.id),
        );
      const selected = candidates[0];
      if (!selected) break;

      const selectedBlocks = blocks
        .filter(
          (block) =>
            block.staffId === selected.person.id && block.remainingHours > CAPACITY_EPSILON,
        )
        .sort(
          (a, b) =>
            a.switchingCostHours - b.switchingCostHours ||
            a.projectId.localeCompare(b.projectId) ||
            a.index - b.index,
        );

      for (const block of selectedBlocks) {
        if (hoursShort <= CAPACITY_EPSILON) break;
        const released = Math.min(hoursShort, block.remainingHours);
        block.remainingHours -= released;
        hoursShort -= released;
        recordAssignment(selected.person.id, demand.id, released, selected.skillMatch, "released");

        const releaseKey = `${block.staffId}\u0000${block.projectId}`;
        const existingRelease = releases.get(releaseKey) ?? {
          staffId: block.staffId,
          fromProjectId: block.projectId,
          hours: 0,
        };
        existingRelease.hours += released;
        releases.set(releaseKey, existingRelease);

        if (!block.costCounted) {
          switchingCost += block.switchingCostHours;
          block.costCounted = true;
        }
      }
    }

    if (hoursShort > CAPACITY_EPSILON) {
      unmet.push({
        demandId: demand.id,
        hoursShort: roundedHours(hoursShort),
        reason: "No qualified capacity remains",
      });
    }
  }

  const assignments = [...assignmentParts.values()].map((item) => {
    const source =
      item.freeHours > CAPACITY_EPSILON && item.releasedHours > CAPACITY_EPSILON
        ? `${roundedHours(item.freeHours)}h free, then ${roundedHours(item.releasedHours)}h released`
        : item.releasedHours > CAPACITY_EPSILON
          ? `${roundedHours(item.releasedHours)}h released after free capacity was exhausted`
          : `${roundedHours(item.freeHours)}h from free capacity`;
    return {
      staffId: item.staffId,
      demandId: item.demandId,
      hours: roundedHours(item.hours),
      skillMatch: item.skillMatch,
      rationale: `${Math.round(item.skillMatch * 100)}% required-skill match; ${source}.`,
    };
  });

  return {
    assignments,
    released: [...releases.values()].map((item) => ({ ...item, hours: roundedHours(item.hours) })),
    unmet,
    totalSwitchingCostHours: Number(switchingCost.toFixed(1)),
  };
}
