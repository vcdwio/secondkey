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

export function evaluateAuthority(role: string, scope: DecisionScope): AuthorityVerdict {
  const profile = AUTHORITY_MATRIX[role] ?? AUTHORITY_MATRIX.Consultant!;
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
