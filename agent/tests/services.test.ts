import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryMemoryService,
  InMemorySessionService,
  VertexAiMemoryBankService,
  VertexAiSessionService,
} from "@google/adk";

import { createAgentServices } from "../src/services.js";

test("local mode uses real ADK in-memory session and memory services", async () => {
  const services = createAgentServices({});

  assert.equal(services.mode, "memory");
  assert.ok(services.sessionService instanceof InMemorySessionService);
  assert.ok(services.memoryService instanceof InMemoryMemoryService);
  const created = await services.sessionService.createSession({
    appName: "secondkey-contextops",
    userId: "VC-001",
    sessionId: "SESSION-LOCAL",
    state: { task_id: "TASK-1", external_write: false },
  });
  const restored = await services.sessionService.getSession({
    appName: "secondkey-contextops",
    userId: "VC-001",
    sessionId: created.id,
  });
  assert.equal(restored?.state.task_id, "TASK-1");
  assert.equal(restored?.state.external_write, false);
});

test("partial Vertex configuration fails closed instead of silently using memory", () => {
  assert.throws(
    () => createAgentServices({ CONTEXTOPS_STATE_BACKEND: "vertex", GOOGLE_CLOUD_PROJECT: "demo" }),
    /Vertex state requires GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, VERTEX_AGENT_ENGINE_ID, and Application Default Credentials/,
  );
});

test("Vertex API-key state mode fails with the official ADK limitation instead of constructing a broken service", () => {
  assert.throws(
    () => createAgentServices({
      CONTEXTOPS_STATE_BACKEND: "vertex",
      GOOGLE_CLOUD_PROJECT: "demo-project",
      GOOGLE_CLOUD_LOCATION: "australia-southeast1",
      VERTEX_AGENT_ENGINE_ID: "reasoning-engine-1",
      VERTEX_EXPRESS_API_KEY: "test-only-placeholder",
    }),
    /ADK 2\.0 does not support API-key authentication for Vertex Agent Engine state/,
  );
});

test("complete Vertex ADC configuration selects official persistent services without making a request", () => {
  const services = createAgentServices({
    CONTEXTOPS_STATE_BACKEND: "vertex",
    GOOGLE_CLOUD_PROJECT: "demo-project",
    GOOGLE_CLOUD_LOCATION: "australia-southeast1",
    VERTEX_AGENT_ENGINE_ID: "reasoning-engine-1",
  });

  assert.equal(services.mode, "vertex");
  assert.ok(services.sessionService instanceof VertexAiSessionService);
  assert.ok(services.memoryService instanceof VertexAiMemoryBankService);
});
