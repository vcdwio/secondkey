import assert from "node:assert/strict";
import test from "node:test";

import { Gemini, Runner, State } from "@google/adk";

import {
  createAdkTriageRuntime,
  createScorePriorityTool,
  resolveGeminiAccess,
} from "../src/adk.js";
import { createAgentServices } from "../src/services.js";

test("triage runtime is an official ADK Runner with local state services", () => {
  const runtime = createAdkTriageRuntime({
    access: { backend: "developer", apiKey: "test-only-placeholder" },
    model: "gemini-3.7-flash",
    services: createAgentServices({}),
  });

  assert.ok(runtime.runner instanceof Runner);
  assert.equal(runtime.services.mode, "memory");
  assert.equal(runtime.appName, "verge-contextops");
  const model = runtime.rootAgent.canonicalModel;
  assert.ok(model instanceof Gemini);
  assert.equal(model.model, "gemini-3.7-flash");
  assert.equal(model.apiBackend, "GEMINI_API");
});

test("Vertex mode uses ADC against the explicit global model endpoint", () => {
  const access = resolveGeminiAccess({
    GOOGLE_GENAI_USE_VERTEXAI: "true",
    GOOGLE_CLOUD_PROJECT: "secondkey-hackathon",
    GOOGLE_CLOUD_LOCATION: "global",
  });
  const runtime = createAdkTriageRuntime({
    access,
    model: "gemini-3.7-flash",
    services: createAgentServices({}),
  });

  assert.deepEqual(access, {
    backend: "vertex",
    project: "secondkey-hackathon",
    location: "global",
  });
  const model = runtime.rootAgent.canonicalModel;
  assert.ok(model instanceof Gemini);
  assert.equal(model.model, "gemini-3.7-flash");
  assert.equal(model.apiBackend, "VERTEX_AI");
});

test("Vertex mode fails closed without a project and location", () => {
  assert.throws(
    () => resolveGeminiAccess({ GOOGLE_GENAI_USE_VERTEXAI: "true" }),
    /Vertex Gemini requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION/,
  );
});

test("local Gemini mode fails closed without an API key", () => {
  assert.throws(
    () => resolveGeminiAccess({}),
    /GEMINI_API_KEY is not configured/,
  );
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
