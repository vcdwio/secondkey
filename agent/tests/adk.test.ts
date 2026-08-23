import assert from "node:assert/strict";
import test from "node:test";

import { Runner, State } from "@google/adk";

import { createAdkTriageRuntime, createScorePriorityTool } from "../src/adk.js";
import { createAgentServices } from "../src/services.js";

test("triage runtime is an official ADK Runner with local state services", () => {
  const runtime = createAdkTriageRuntime({
    apiKey: "test-only-placeholder",
    model: "gemini-3.5-flash",
    services: createAgentServices({}),
  });

  assert.ok(runtime.runner instanceof Runner);
  assert.equal(runtime.services.mode, "memory");
  assert.equal(runtime.appName, "verge-contextops");
});

test("score_priority tool returns deterministic session state rather than model arguments", async () => {
  const tool = createScorePriorityTool();
  const state = new State({
    deterministic_priority: "P0",
    deterministic_reasons: ["Inside the two-hour SLA window"],
  });
  const actions: { skipSummarization?: boolean } = {};
  const result = await tool.runAsync({
    args: {
      summary: "Model-authored summary",
      intent: "incident_triage",
      urgency_mentions: ["tomorrow"],
    },
    toolContext: { state, actions } as never,
  });

  assert.deepEqual(result, {
    priority: "P0",
    reasons: ["Inside the two-hour SLA window"],
    external_write: false,
  });
  assert.equal(actions.skipSummarization, true);
});

test("score_priority fails closed when deterministic priority state is absent", async () => {
  await assert.rejects(
    createScorePriorityTool().runAsync({
      args: { summary: "Summary", intent: "triage", urgency_mentions: [] },
      toolContext: { state: new State() } as never,
    }),
    /Deterministic priority state is unavailable/,
  );
});
