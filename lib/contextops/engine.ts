import type {
  ConfidenceSignals,
  ContextRequest,
  EvidenceRecord,
  IncidentSignals,
  Priority,
} from "./types.ts";

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

/* ------------------------------------------------------------------------ */
/* Authority, separation of duties and reversible execution                  */
/* ------------------------------------------------------------------------ */

export interface AuthorityProfile {
  staffId: string;
  name: string;
  role: string;
  maxHours: number;
  spendLimitAud: number;
  mayApproveExternalComms: boolean;
  mayApproveCrossAccount: boolean;
  scopeLabel: string;
  clientCount: number;
  queueLimit: number;
}

export const AUTHORITY_MATRIX: Record<string, AuthorityProfile> = {
  "General Manager": {
    staffId: "VC-001",
    name: "Olivia Mercer",
    role: "General Manager",
    maxHours: Number.POSITIVE_INFINITY,
    spendLimitAud: 100000,
    mayApproveExternalComms: true,
    mayApproveCrossAccount: true,
    scopeLabel: "Portfolio-wide decision authority",
    clientCount: 7,
    queueLimit: 8,
  },
  "Delivery Manager": {
    staffId: "VC-006",
    name: "Sofia Patel",
    role: "Delivery & Resource Manager",
    maxHours: 8,
    spendLimitAud: 5000,
    mayApproveExternalComms: false,
    mayApproveCrossAccount: true,
    scopeLabel: "Portfolio delivery and capacity",
    clientCount: 7,
    queueLimit: 8,
  },
  "Account Manager": {
    staffId: "VC-004",
    name: "Emma Collins",
    role: "Senior Account Manager",
    maxHours: 4,
    spendLimitAud: 5000,
    mayApproveExternalComms: true,
    mayApproveCrossAccount: false,
    scopeLabel: "Assigned client accounts only",
    clientCount: 3,
    queueLimit: 4,
  },
  Consultant: {
    staffId: "VC-007",
    name: "Marcus Reed",
    role: "Senior Consultant",
    maxHours: 0,
    spendLimitAud: 0,
    mayApproveExternalComms: false,
    mayApproveCrossAccount: false,
    scopeLabel: "Assigned delivery work only",
    clientCount: 2,
    queueLimit: 3,
  },
};

export interface DecisionScope {
  hoursAffected: number;
  spendAud: number;
  externalCommunications: number;
  accountsTouched: number;
}

export interface AuthorityVerdict {
  canApprove: boolean;
  blockedBy: string[];
  escalateTo: string;
  profile: AuthorityProfile;
}

/**
 * Separation of duties: the viewer's role is checked against the size of the
 * decision, not against a label. Anything a role cannot clear is escalated by
 * name rather than silently allowed.
 */
export function evaluateAuthority(role: string, scope: DecisionScope): AuthorityVerdict {
  const profile = AUTHORITY_MATRIX[role] ?? AUTHORITY_MATRIX.Consultant;
  const blockedBy: string[] = [];

  if (scope.hoursAffected > profile.maxHours) {
    blockedBy.push(
      profile.maxHours === 0
        ? "This role holds no resource-approval authority"
        : `${scope.hoursAffected}h exceeds the ${profile.maxHours}h limit for this role`,
    );
  }
  if (scope.spendAud > profile.spendLimitAud) {
    blockedBy.push(
      profile.spendLimitAud === 0
        ? "This role cannot commit spend"
        : `AUD ${scope.spendAud.toLocaleString()} exceeds the AUD ${profile.spendLimitAud.toLocaleString()} limit`,
    );
  }
  if (scope.externalCommunications > 0 && !profile.mayApproveExternalComms) {
    blockedBy.push("This role cannot release client communications");
  }
  if (scope.accountsTouched > 1 && !profile.mayApproveCrossAccount) {
    blockedBy.push(`Decision spans ${scope.accountsTouched} accounts; this role approves one account at a time`);
  }

  const escalateTo =
    Object.values(AUTHORITY_MATRIX).find(
      (candidate) =>
        scope.hoursAffected <= candidate.maxHours &&
        scope.spendAud <= candidate.spendLimitAud &&
        (scope.externalCommunications === 0 || candidate.mayApproveExternalComms) &&
        (scope.accountsTouched <= 1 || candidate.mayApproveCrossAccount),
    )?.role ?? "General Manager";

  return { canApprove: blockedBy.length === 0, blockedBy, escalateTo, profile };
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
