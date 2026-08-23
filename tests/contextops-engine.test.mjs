import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContextPacket,
  calculateConfidence,
  getRoleScope,
  proposeExecution,
  routeTask,
  scoreIncident,
} from "../lib/contextops/engine.ts";
import { BUSINESS_UNITS } from "../lib/contextops/units.ts";

test("exposes exactly the ten customer-facing business Units", () => {
  assert.equal(BUSINESS_UNITS.length, 10);
  assert.deepEqual(
    BUSINESS_UNITS.map((unit) => unit.id),
    [
      "intake_triage",
      "customer_service",
      "sales_crm",
      "operations_scheduling",
      "finance_admin",
      "knowledge_documents",
      "marketing_content",
      "research_insights",
      "people_onboarding",
      "purchase_order",
    ],
  );
});

test("raises an incident inside a four-hour SLA window to P0", () => {
  const result = scoreIncident({
    slaHoursRemaining: 2,
    launchBlockedTomorrow: false,
    explicitCommitment: false,
    renewalRisk: false,
    internalWork: false,
  });

  assert.equal(result.priority, "P0");
  assert.match(result.reasons.join(" "), /four-hour SLA/i);
});

test("keeps movable internal work at P2 when no client rule applies", () => {
  const result = scoreIncident({
    slaHoursRemaining: null,
    launchBlockedTomorrow: false,
    explicitCommitment: false,
    renewalRisk: false,
    internalWork: true,
  });

  assert.equal(result.priority, "P2");
});

test("stops routing after five handoffs and escalates to human review", () => {
  const result = routeTask({ handoffCount: 5, nextUnitId: "sales_crm" });

  assert.deepEqual(result, {
    status: "human_review",
    handoffCount: 5,
    nextUnitId: null,
    reason: "Five-handoff limit reached",
  });
});

test("calculates confidence from measurable evidence rather than model opinion", () => {
  const result = calculateConfidence({
    evidenceCoverage: 1,
    sourceAuthority: 1,
    freshness: 0.8,
    sourceAgreement: 0.5,
    deterministicCoverage: 1,
    evalHistory: 0.9,
  });

  assert.equal(result.score, 0.885);
  assert.ok(result.reasons.includes("Evidence coverage complete"));
  assert.ok(result.reasons.includes("Sources disagree"));
});

test("filters context by tenant, permission, entity, active status, and newest version", () => {
  const packet = buildContextPacket(
    {
      taskId: "TASK-1",
      tenantId: "VERGE",
      entityId: "CL-BH",
      permissionGroups: ["leadership"],
    },
    [
      { id: "old", tenantId: "VERGE", entityId: "CL-BH", permissionGroup: "leadership", status: "archived", version: 2, authority: 1, updatedAt: "2026-01-01", text: "old SLA" },
      { id: "current", tenantId: "VERGE", entityId: "CL-BH", permissionGroup: "leadership", status: "active", version: 3, authority: 1, updatedAt: "2026-08-17", text: "current SLA" },
      { id: "cross-client", tenantId: "VERGE", entityId: "CL-EL", permissionGroup: "leadership", status: "active", version: 4, authority: 1, updatedAt: "2026-08-17", text: "other client" },
      { id: "private", tenantId: "VERGE", entityId: "CL-BH", permissionGroup: "finance", status: "active", version: 4, authority: 1, updatedAt: "2026-08-17", text: "private" },
    ],
  );

  assert.deepEqual(packet.evidence.map((item) => item.id), ["current"]);
  assert.equal(packet.rejectedCount, 3);
});

test("never performs an external write before approval", () => {
  const proposal = proposeExecution({
    action: "send_client_email",
    external: true,
    approved: false,
  });

  assert.deepEqual(proposal, {
    action: "send_client_email",
    status: "awaiting_approval",
    approvalRequired: true,
    externalWrite: false,
  });
});

test("limits portfolio scope for account and delivery roles", () => {
  assert.deepEqual(getRoleScope("General Manager"), { clientCount: 7, queueLimit: 5, label: "Portfolio-wide decision authority" });
  assert.deepEqual(getRoleScope("Account Manager"), { clientCount: 3, queueLimit: 3, label: "Assigned client accounts only" });
  assert.deepEqual(getRoleScope("Consultant"), { clientCount: 2, queueLimit: 2, label: "Assigned delivery work only" });
});
