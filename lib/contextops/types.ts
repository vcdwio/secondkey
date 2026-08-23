export type Priority = "P0" | "P1" | "P2";

export type BusinessUnitId =
  | "intake_triage"
  | "customer_service"
  | "sales_crm"
  | "operations_scheduling"
  | "finance_admin"
  | "knowledge_documents"
  | "marketing_content"
  | "research_insights"
  | "people_onboarding"
  | "purchase_order";

export interface BusinessUnit {
  id: BusinessUnitId;
  order: number;
  name: string;
  chineseName: string;
  shortName: string;
  purpose: string;
  outcome: string;
  input: string[];
  output: string[];
  connectors: string[];
  accent: string;
  qualityScore: number;
}

export interface IncidentSignals {
  slaHoursRemaining: number | null;
  launchBlockedTomorrow: boolean;
  explicitCommitment: boolean;
  renewalRisk: boolean;
  internalWork: boolean;
}

export interface EvidenceRecord {
  id: string;
  tenantId: string;
  entityId: string;
  permissionGroup: string;
  status: "active" | "archived" | "draft";
  version: number;
  authority: number;
  updatedAt: string;
  text: string;
}

export interface ContextRequest {
  taskId: string;
  tenantId: string;
  entityId: string;
  permissionGroups: string[];
}

export interface ConfidenceSignals {
  evidenceCoverage: number;
  sourceAuthority: number;
  freshness: number;
  sourceAgreement: number;
  deterministicCoverage: number;
  evalHistory: number;
}

export interface AuditEvent {
  id: string;
  time: string;
  component: string;
  message: string;
  status: "passed" | "pending" | "blocked";
  /** Who caused the event. Every entry an auditor reads names a person or a service. */
  actor?: string;
  /** Identifiers the event relied on, so a reviewer can retrace it. */
  evidence?: string[];
  taskId?: string;
}
