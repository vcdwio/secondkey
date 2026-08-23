import assert from "node:assert/strict";
import test from "node:test";

import { runFlagshipScenario } from "../lib/contextops/demo.ts";

test("reproduces the validated Monday capacity-crisis decision", () => {
  const decision = runFlagshipScenario();

  assert.deepEqual(
    decision.priorities.filter((item) => ["CL-BH", "CL-EL", "CL-MH", "CL-PR", "CL-LP"].includes(item.clientId)),
    [
      { clientId: "CL-BH", priority: "P0" },
      { clientId: "CL-EL", priority: "P0" },
      { clientId: "CL-MH", priority: "P1" },
      { clientId: "CL-PR", priority: "P1" },
      { clientId: "CL-LP", priority: "P2" },
    ],
  );
  assert.equal(decision.reallocatedHours, 12);
  assert.equal(decision.approvalRequired, true);
  assert.equal(decision.externalWrite, false);
  assert.equal(decision.status, "awaiting_approval");
});
