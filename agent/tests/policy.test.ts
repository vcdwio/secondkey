import assert from "node:assert/strict";
import test from "node:test";

import { FunctionTool, PolicyOutcome, SecurityPlugin, State } from "@google/adk";
import { z } from "zod";

import { ContextOpsPolicyEngine, executeWithSecurityPlugin } from "../src/policy.js";

const commitTool = new FunctionTool({
  name: "commit_changes",
  description: "Prepare governed change requests without external writes",
  parameters: z.object({
    role: z.string(),
    hoursAffected: z.number(),
    spendAud: z.number(),
    externalCommunications: z.number(),
    accountsTouched: z.number(),
  }),
  execute: () => ({ prepared: true, external_write: false }),
});
test("Consultant flagship commit is denied with all four authority limits", async () => {
  const policy = new ContextOpsPolicyEngine();
  const result = await policy.evaluate({
    tool: commitTool,
    toolArgs: {
      role: "Consultant",
      hoursAffected: 12,
      spendAud: 1800,
      externalCommunications: 2,
      accountsTouched: 2,
    },
  });

  assert.equal(result.outcome, PolicyOutcome.DENY);
  assert.match(result.reason ?? "", /resource-approval authority/i);
  assert.match(result.reason ?? "", /cannot commit spend/i);
  assert.match(result.reason ?? "", /cannot release client communications/i);
  assert.match(result.reason ?? "", /spans 2 accounts/i);
});

test("General Manager can prepare the same governed commit", async () => {
  const result = await new ContextOpsPolicyEngine().evaluate({
    tool: commitTool,
    toolArgs: {
      role: "General Manager",
      hoursAffected: 12,
      spendAud: 1800,
      externalCommunications: 2,
      accountsTouched: 2,
    },
  });
  assert.deepEqual(result, { outcome: PolicyOutcome.ALLOW, reason: "Authority and tenant checks passed" });
});

test("Ledgerwise permission cannot retrieve the Morrow context packet", async () => {
  const packetTool = new FunctionTool({
    name: "build_context_packet",
    description: "Build a permission-filtered packet",
    parameters: z.object({ accessGroup: z.string(), permissionGroups: z.array(z.string()) }),
    execute: () => ({ packet: true }),
  });
  const result = await new ContextOpsPolicyEngine().evaluate({
    tool: packetTool,
    toolArgs: { accessGroup: "acct_morrow", permissionGroups: ["acct_ledgerwise"] },
  });
  assert.equal(result.outcome, PolicyOutcome.DENY);
  assert.match(result.reason ?? "", /acct_morrow/);
});

test("SecurityPlugin denial happens before the tool execute function", async () => {
  let executions = 0;
  const tool = new FunctionTool({
    name: "commit_changes",
    description: "A tool that must be gated",
    parameters: z.object({ role: z.string(), hoursAffected: z.number(), spendAud: z.number(), externalCommunications: z.number(), accountsTouched: z.number() }),
    execute: () => {
      executions += 1;
      return { prepared: true };
    },
  });
  const result = await executeWithSecurityPlugin({
    plugin: new SecurityPlugin({ policyEngine: new ContextOpsPolicyEngine() }),
    tool,
    toolArgs: { role: "Consultant", hoursAffected: 12, spendAud: 1800, externalCommunications: 2, accountsTouched: 2 },
    state: new State(),
  });

  assert.equal(executions, 0);
  assert.match(JSON.stringify(result), /rejected by policy engine/i);
});
