import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { allocateCapacity } from "../lib/contextops/engine.ts";

const pack = new URL("../fixtures/verge-demo-pack/", import.meta.url);

function csv(file) {
  const [header, ...lines] = readFileSync(new URL(`data/${file}`, pack), "utf8")
    .trim()
    .split(/\r?\n/);
  const keys = header.split(",");
  return lines.map((line) =>
    Object.fromEntries(keys.map((key, index) => [key, line.split(",")[index] ?? ""])),
  );
}

function flagshipInput(staffIds = ["VC-007", "VC-008", "VC-009", "VC-010"]) {
  const allowed = new Set(staffIds);
  const staff = csv("staff.csv")
    .filter((row) => allowed.has(row.staff_id))
    .map((row) => ({
      id: row.staff_id,
      skills: row.skills.split("|"),
      // This decision allocates incremental incident hours. Ordinary free hours
      // are already committed to the work represented by the capacity ledger.
      availableHours: 0,
    }));
  const movable = csv("staff_capacity.csv")
    .filter((row) => allowed.has(row.staff_id))
    .map((row) => ({
      staffId: row.staff_id,
      projectId: row.planned_project_id,
      hours: Number(row.planned_hours),
      switchingCostHours: Number(row.switching_cost_hours),
    }));

  return {
    demands: [
      {
        id: "PJ-BH-01",
        priority: "P0",
        hoursNeeded: 7,
        slaRemainingMinutes: 97,
        requiredSkills: [
          "operations",
          "data_analysis",
          "process_design",
          "market_research",
          "quantitative_analysis",
        ],
      },
      {
        id: "PJ-EL-01",
        priority: "P0",
        hoursNeeded: 5,
        slaRemainingMinutes: 170,
        requiredSkills: [
          "process_mapping",
          "training_operations",
          "scheduling",
          "vendor_coordination",
          "training_logistics",
        ],
      },
    ],
    staff,
    movable,
  };
}

test("reproduces the pack's 12-hour flagship capacity movement deterministically", () => {
  const expected = JSON.parse(
    readFileSync(new URL("scenarios/flagship_monday_capacity_crisis.json", pack), "utf8"),
  );
  const expectedByStaff = Object.fromEntries(
    expected.resource_changes.map((item) => [item.staff_id, item.hours]),
  );
  const first = allocateCapacity(flagshipInput());

  assert.equal(first.released.reduce((sum, item) => sum + item.hours, 0), 12);
  assert.deepEqual(
    Object.fromEntries(first.assignments.map((item) => [item.staffId, item.hours])),
    expectedByStaff,
  );
  assert.equal(first.totalSwitchingCostHours, 2.3);
  assert.deepEqual(first.unmet, []);
  assert.ok(first.assignments.every((item) => item.rationale.length > 20));

  for (let run = 0; run < 100; run += 1) {
    assert.deepEqual(allocateCapacity(flagshipInput()), first);
  }
});

test("reports the exact shortfall when only half the flagship staff is available", () => {
  const result = allocateCapacity(flagshipInput(["VC-007", "VC-010"]));

  assert.deepEqual(result.unmet, [
    { demandId: "PJ-BH-01", hoursShort: 3, reason: "No qualified capacity remains" },
    { demandId: "PJ-EL-01", hoursShort: 2, reason: "No qualified capacity remains" },
  ]);
});

test("orders P0 to P2, breaks ties by SLA, and uses free hours before movable blocks", () => {
  const result = allocateCapacity({
    demands: [
      { id: "routine", priority: "P2", hoursNeeded: 1, slaRemainingMinutes: 10, requiredSkills: ["ops"] },
      { id: "later", priority: "P1", hoursNeeded: 1, slaRemainingMinutes: 90, requiredSkills: ["ops"] },
      { id: "urgent", priority: "P1", hoursNeeded: 1, slaRemainingMinutes: 30, requiredSkills: ["ops"] },
      { id: "critical", priority: "P0", hoursNeeded: 1, slaRemainingMinutes: 120, requiredSkills: ["ops"] },
    ],
    staff: [
      { id: "A", skills: ["ops"], availableHours: 2 },
      { id: "B", skills: ["ops"], availableHours: 0 },
    ],
    movable: [
      { staffId: "B", projectId: "internal", hours: 2, switchingCostHours: 0.5 },
    ],
  });

  assert.deepEqual(
    result.assignments.map(({ staffId, demandId, hours }) => ({ staffId, demandId, hours })),
    [
      { staffId: "A", demandId: "critical", hours: 1 },
      { staffId: "A", demandId: "urgent", hours: 1 },
      { staffId: "B", demandId: "later", hours: 1 },
      { staffId: "B", demandId: "routine", hours: 1 },
    ],
  );
  assert.equal(result.released.length, 1);
});

test("the generated Portfolio exposes the algorithm result rather than replaying the expected fixture", () => {
  const portfolio = JSON.parse(
    readFileSync(new URL("../lib/contextops/generated/portfolio.json", import.meta.url), "utf8"),
  );

  assert.equal(portfolio.capacitySummary.allocationMethod, "deterministic_priority_sla_skill_capacity");
  assert.equal(portfolio.capacitySummary.proposedHours, 12);
  assert.equal(portfolio.capacitySummary.switchingCostHours, 2.3);
  assert.deepEqual(portfolio.capacitySummary.unmet, []);
  assert.deepEqual(
    portfolio.incidents
      .flatMap((incident) => incident.allocation)
      .map((item) => item.staffId)
      .sort(),
    ["VC-007", "VC-008", "VC-009", "VC-010"],
  );
});
