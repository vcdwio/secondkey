import assert from "node:assert/strict";
import test from "node:test";

import {
  AUTHORITY_MATRIX,
  evaluateAuthority,
  rollbackExecution,
  simulateExecution,
} from "../lib/contextops/engine.ts";
import {
  DECISION_SCOPE,
  PORTFOLIO,
  PORTFOLIO_CONFIDENCE,
  SCORED_QUEUE,
} from "../lib/contextops/portfolio.ts";

test("derives every queue priority from the data pack, matching the validated scenario", () => {
  for (const entry of SCORED_QUEUE) {
    assert.equal(
      entry.priority,
      entry.item.expectedPriority,
      `${entry.item.id} scored ${entry.priority}, pack expects ${entry.item.expectedPriority}`,
    );
    assert.ok(entry.priorityReasons.length > 0, `${entry.item.id} has no stated reason`);
  }
});

test("computes portfolio confidence from counted evidence, not a claimed number", () => {
  const counts = PORTFOLIO.portfolioConfidence.counts;
  assert.equal(counts.facts, PORTFOLIO.packet.verified_facts.length);
  assert.equal(counts.conflicts, PORTFOLIO.packet.conflicts.length);
  assert.ok(PORTFOLIO_CONFIDENCE.score > 0.5 && PORTFOLIO_CONFIDENCE.score < 1);
});

test("only the General Manager can clear the flagship cross-client decision", () => {
  assert.equal(evaluateAuthority("General Manager", DECISION_SCOPE).canApprove, true);

  for (const role of ["Delivery Manager", "Account Manager", "Consultant"]) {
    const verdict = evaluateAuthority(role, DECISION_SCOPE);
    assert.equal(verdict.canApprove, false, `${role} must not be able to approve`);
    assert.ok(verdict.blockedBy.length > 0, `${role} must be told why`);
    assert.equal(verdict.escalateTo, "General Manager");
  }
});

test("a role may clear a decision that fits inside its own limits", () => {
  const small = { hoursAffected: 3, spendAud: 0, externalCommunications: 0, accountsTouched: 1 };
  assert.equal(evaluateAuthority("Delivery Manager", small).canApprove, true);
  assert.equal(evaluateAuthority("Consultant", small).canApprove, false);
});

test("role scope never exceeds the accounts that role is allowed to see", () => {
  assert.equal(AUTHORITY_MATRIX["Account Manager"].clientCount < PORTFOLIO.clients.length, true);
  assert.equal(AUTHORITY_MATRIX["General Manager"].clientCount, PORTFOLIO.clients.length);
});

test("execution stays held until approval and never writes externally", () => {
  const held = simulateExecution(PORTFOLIO.executionPlan, { taskId: "T1", approved: false });
  assert.ok(held.length > 0);
  for (const item of held) {
    assert.equal(item.status, "held");
    assert.equal(item.externalWrite, false);
  }

  const approved = simulateExecution(PORTFOLIO.executionPlan, { taskId: "T1", approved: true });
  for (const item of approved) {
    assert.equal(item.status, "simulated");
    assert.equal(item.externalWrite, false);
    assert.match(item.idempotencyKey, /^T1-/);
  }
});

test("rollback reverses everything reversible and admits what it cannot reverse", () => {
  const approved = simulateExecution(PORTFOLIO.executionPlan, { taskId: "T1", approved: true });
  const rolled = rollbackExecution(approved);

  for (const item of rolled) {
    assert.equal(item.status, item.reversible ? "rolled_back" : "simulated");
    assert.equal(item.externalWrite, false);
  }
  assert.ok(rolled.some((item) => !item.reversible), "email sends must stay irreversible by design");
});

test("every idempotency key is unique so a retry cannot double-apply", () => {
  const keys = simulateExecution(PORTFOLIO.executionPlan, { taskId: "T1", approved: true }).map(
    (item) => item.idempotencyKey,
  );
  assert.equal(new Set(keys).size, keys.length);
});

test("the ROI case is built from pack volumes, not from a claimed figure", () => {
  assert.equal(PORTFOLIO.roi.volumes.draftsPrepared, PORTFOLIO.outputs.client_email_drafts.length + PORTFOLIO.outputs.crm_drafts.length);
  assert.equal(PORTFOLIO.roi.volumes.tasksPrepared, PORTFOLIO.outputs.internal_tasks.length);
  const sum = PORTFOLIO.roi.lines.reduce((total, line) => total + line.hours, 0);
  assert.equal(Math.round(sum * 100) / 100, PORTFOLIO.roi.hoursSavedPerDay);
});

test("every adversarial drill in the pack has a stated rule and a blocked-or-held outcome", () => {
  assert.ok(PORTFOLIO.securityDrills.length >= 5);
  for (const drill of PORTFOLIO.securityDrills) {
    assert.ok(drill.rule.length > 10, `${drill.id} has no rule`);
    assert.ok(["blocked", "grouped", "clarify", "abstain", "degraded"].includes(drill.verdict));
  }
});
