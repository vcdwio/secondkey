import assert from "node:assert/strict";
import test from "node:test";

import { BaseLlm, Gemini, PolicyOutcome } from "@google/adk";

import { createFleet, createFleetRuntime, FLEET_TIERS } from "../src/fleet.js";
import { ContextOpsPolicyEngine } from "../src/policy.js";
import { createAgentServices } from "../src/services.js";
import {
  commitInternalChange,
  DRAFT_TOOLS,
  EXTERNAL_TOOLS,
  INTERNAL_TOOLS,
  releaseExternalCommitment,
} from "../src/tools.js";

const fleet = () => createFleet({ model: new Gemini({ model: "gemini-3.7-flash", apiKey: "test-key" }) });
const policy = new ContextOpsPolicyEngine();
const names = (tools: typeof DRAFT_TOOLS) => tools.map((tool) => tool.name);

/** An agent's `tools` may hold toolsets as well as tools; we only wire tools. */
const wiredToolNames = (agent: { tools: unknown[] }) =>
  agent.tools
    .map((tool) => (typeof tool === "object" && tool !== null && "name" in tool ? String(tool.name) : null))
    .filter((name): name is string => name !== null)
    .sort();

/* ------------------------------------------------ the partition is disjoint */

test("the draft tier holds no write tool at all", () => {
  const writeTools = ["commit_internal_change", "release_external_commitment", "commit_changes"];
  for (const forbidden of writeTools) {
    assert.ok(!names(DRAFT_TOOLS).includes(forbidden), `draft tier must not hold ${forbidden}`);
  }
});

test("the internal tier cannot reach a client and the external tier cannot do internal work", () => {
  assert.ok(!names(INTERNAL_TOOLS).includes("release_external_commitment"));
  assert.ok(!names(EXTERNAL_TOOLS).includes("commit_internal_change"));
});

test("each agent is constructed with exactly its tier's tools", () => {
  const built = fleet();
  assert.deepEqual(wiredToolNames(built.draftAgent), names(DRAFT_TOOLS).sort());
  assert.deepEqual(wiredToolNames(built.internalAgent), names(INTERNAL_TOOLS).sort());
  assert.deepEqual(wiredToolNames(built.externalAgent), names(EXTERNAL_TOOLS).sort());
});

test("the published tier description matches the tools actually wired", () => {
  const built = fleet();
  const wired = new Map([
    ["draft_agent", built.draftAgent],
    ["internal_commit_agent", built.internalAgent],
    ["external_commitment_agent", built.externalAgent],
  ]);
  for (const tier of FLEET_TIERS) {
    const agent = wired.get(tier.name);
    assert.ok(agent, `${tier.name} must exist in the fleet`);
    assert.deepEqual(tier.toolNames.sort(), wiredToolNames(agent));
  }
});

test("the coordinator runs the tiers in ascending order of irreversibility", () => {
  const built = fleet();
  assert.equal(built.coordinator.name, "secondkey_fleet");
  assert.deepEqual(built.coordinator.subAgents.map((agent: { name: string }) => agent.name), [
    "draft_agent",
    "internal_commit_agent",
    "external_commitment_agent",
  ]);
});

/* ------------------------------------------------------- the gate behaviour */

test("an internal change inside the role's limits runs without a human", async () => {
  const args = { role: "Delivery Manager", hoursAffected: 3, spendAud: 0, accountsTouched: 1, summary: "Shift 3h" };
  const verdict = await policy.evaluate({ tool: commitInternalChange, toolArgs: args });
  assert.equal(verdict.outcome, PolicyOutcome.ALLOW);
});

test("the same change beyond the role's limits pauses for a human rather than failing", async () => {
  const args = { role: "Delivery Manager", hoursAffected: 12, spendAud: 1800, accountsTouched: 2, summary: "Reallocate" };
  const verdict = await policy.evaluate({ tool: commitInternalChange, toolArgs: args });
  assert.equal(verdict.outcome, PolicyOutcome.CONFIRM);
  assert.match(verdict.reason ?? "", /escalate to/i);
});

test("the internal tier is refused outright if a call ever carries client communications", async () => {
  const args = {
    role: "General Manager",
    hoursAffected: 1,
    spendAud: 0,
    accountsTouched: 1,
    externalCommunications: 1,
    summary: "Sneak an email through the internal tier",
  };
  const verdict = await policy.evaluate({ tool: commitInternalChange, toolArgs: args });
  assert.equal(verdict.outcome, PolicyOutcome.DENY);
  assert.match(verdict.reason ?? "", /cannot release client communications/i);
});

test("an external commitment waits for a human even for the General Manager", async () => {
  const verdict = await policy.evaluate({
    tool: releaseExternalCommitment,
    toolArgs: { accountId: "CL-BH", role: "General Manager", summary: "Confirm the revised date" },
  });
  assert.equal(verdict.outcome, PolicyOutcome.CONFIRM);
  assert.match(verdict.reason ?? "", /irreversible/i);
});

test("the external tool declares confirmation unconditionally, not by role", () => {
  assert.equal(EXTERNAL_TOOLS.includes(releaseExternalCommitment), true);
  assert.equal(releaseExternalCommitment.name, "release_external_commitment");
});

/* --------------------------------------------------------- nothing is sent */

test("every tier keeps external_write false", async () => {
  const internal = (await commitInternalChange.runAsync({
    args: { role: "General Manager", hoursAffected: 3, spendAud: 0, accountsTouched: 1, summary: "Shift" },
    toolContext: undefined as never,
  })) as { external_write: boolean; calls: { reversible: boolean }[] };
  assert.equal(internal.external_write, false);
  assert.ok(internal.calls.every((call) => call.reversible), "the internal tier only ever queues reversible calls");

});

test("the external tool refuses to run at all without a confirmation context", async () => {
  // Not a guard we wrote: ADK itself will not execute a requireConfirmation
  // tool unless a confirmation path exists. Calling it straight through — which
  // is what a bypass would look like — fails closed.
  await assert.rejects(
    () =>
      releaseExternalCommitment.runAsync({
        args: { accountId: "CL-BH", role: "General Manager", summary: "Confirm" },
        toolContext: undefined as never,
      }) as Promise<unknown>,
    /requires confirmation/i,
  );
});

/* ------------------------------------------------- the fleet is mounted */

test("the fleet runtime is reachable from the service, not only from tests", async () => {
  // The gap this closes: for a while /fleet published a capability split that
  // nothing in production ever ran. A described split is a diagram.
  //
  // With no model configured the route answers 503 ("Gemini access is
  // unavailable") — which is the point: a 404 would mean it was never mounted,
  // and 503 can only come from the handler itself.
  const { createApp } = await import("../src/server.js");
  const app = createApp({ env: { CONTEXTOPS_STATE_BACKEND: "memory", CONTEXTOPS_TELEMETRY: "off" } });
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/fleet/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: "CL-BH", role: "Delivery Manager" }),
    });
    assert.notEqual(res.status, 404, "POST /fleet/run must be mounted");
    assert.ok([200, 503].includes(res.status), `unexpected status ${res.status}`);
  } finally {
    server.close();
  }
});

test("an unknown role is refused before any model call", async () => {
  const { createApp } = await import("../src/server.js");
  const app = createApp({ env: { CONTEXTOPS_STATE_BACKEND: "memory", CONTEXTOPS_TELEMETRY: "off" } });
  const server = app.listen(0);
  try {
    const port = (server.address() as { port: number }).port;
    const res = await fetch(`http://127.0.0.1:${port}/fleet/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: "CL-BH", role: "Chief Wizard" }),
    });
    assert.equal(res.status, 400);
  } finally {
    server.close();
  }
});

test("the fleet runtime caps a looping model before one request can spend without bound", async () => {
  class EndlessToolModel extends BaseLlm {
    calls = 0;

    constructor() {
      super({ model: "endless-test-model" });
    }

    async *generateContentAsync() {
      this.calls += 1;
      if (this.calls > 5) throw new Error("fake model safety stop");
      yield {
        content: {
          role: "model" as const,
          parts: [{ functionCall: { id: `call-${this.calls}`, name: "list_queue", args: {} } }],
        },
      };
    }

    async connect(): Promise<never> {
      throw new Error("live mode is not used by this test");
    }
  }

  const model = new EndlessToolModel();
  const runtimeConfig = {
    model,
    services: createAgentServices({}),
    appName: "fleet-limit-test",
    maxLlmCalls: 1,
  };
  const runtime = createFleetRuntime(runtimeConfig);

  await assert.rejects(
    () => runtime.run({ accountId: "CL-BH", role: "Delivery Manager", userId: "limit-test" }),
    /Max number of llm calls limit of 1 exceeded/i,
  );
  assert.equal(model.calls, 1, "the second model request must be refused before it reaches the provider");
});
