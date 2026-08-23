import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";

import type { Server } from "node:http";

import { CONTEXTOPS_APP_NAME } from "../src/adk.js";
import { createApp } from "../src/server.js";
import { createAgentServices } from "../src/services.js";
import { AuditStore } from "../src/telemetry.js";

interface TriageHttpResult {
  email_id: string;
  priority: string | null;
  outcome: string;
  duplicate_of: string | null;
}

interface AuditHttpEvent {
  actor: string;
  role: string;
  evidence: string[];
  task_id: string;
  policy_outcome: string;
}

async function withServer(
  callback: (baseUrl: string, services: ReturnType<typeof createAgentServices>) => Promise<void>,
) {
  const services = createAgentServices({});
  const app = createApp({
    env: {
      GEMINI_MODEL: "gemini-test-model",
      CONTEXTOPS_TELEMETRY: "off",
      CONTEXTOPS_UI_ORIGIN: "https://fleet.example",
    },
    services,
    auditStore: new AuditStore(),
    requestToolCall: async () => ({
      name: "score_priority",
      args: {
        summary: "A grounded incident summary",
        intent: "incident_triage",
        urgency_mentions: ["tomorrow"],
      },
    }),
  });
  const server: Server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  try {
    await callback(`http://127.0.0.1:${address.port}`, services);
  } finally {
    server.close();
    await once(server, "close");
  }
}

test("health and registry expose the fortified runtime without writes", async () => {
  await withServer(async (baseUrl) => {
    const healthResponse = await fetch(`${baseUrl}/healthz`, {
      headers: { origin: "https://fleet.example" },
    });
    assert.equal(healthResponse.headers.get("access-control-allow-origin"), "https://fleet.example");
    const health = await healthResponse.json();
    assert.deepEqual(health, {
      status: "ok",
      external_write: false,
      runtime: "google-adk",
      state_backend: "memory",
      model: "gemini-test-model",
      registry_count: 10,
      telemetry_mode: "off",
    });

    const registry = await fetch(`${baseUrl}/registry`).then(
      async (response) => await response.json() as {
        external_write: boolean;
        entries: unknown[];
        cloud: { enabled: boolean; discovered: number };
      },
    );
    assert.equal(registry.external_write, false);
    assert.equal(registry.entries.length, 10);
    assert.deepEqual(registry.cloud, { enabled: false, discovered: 0 });
  });
});

test("triage endpoint enforces deterministic gates and emits retraceable audits", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-001", "EM-023", "EM-025", "EM-030"] }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as {
      external_write: boolean;
      processed_count: number;
      results: TriageHttpResult[];
    };
    assert.equal(body.external_write, false);
    assert.equal(body.processed_count, 4);
    const byId = new Map(body.results.map((result) => [result.email_id, result]));
    assert.equal(byId.get("EM-001")?.priority, "P0");
    assert.equal(byId.get("EM-023")?.outcome, "quarantine");
    assert.equal(byId.get("EM-025")?.duplicate_of, "EM-001");
    assert.equal(byId.get("EM-030")?.outcome, "rejected");

    const audit = await fetch(`${baseUrl}/audit.json`).then(
      async (auditResponse) => await auditResponse.json() as {
        external_write: boolean;
        events: AuditHttpEvent[];
      },
    );
    assert.equal(audit.external_write, false);
    assert.equal(audit.events.length, 4);
    for (const event of audit.events) {
      assert.ok(event.actor);
      assert.ok(event.role);
      assert.ok(event.evidence.length);
      assert.ok(event.task_id);
      assert.ok(event.policy_outcome);
    }

    const csvResponse = await fetch(`${baseUrl}/audit.csv`);
    assert.match(csvResponse.headers.get("content-type") ?? "", /^text\/csv/);
    const csv = await csvResponse.text();
    assert.equal(csv.split("\n")[0], "time,component,actor,role,message,evidence,task_id");
    assert.match(csv, /EM-023/);
  });
});

test("session endpoint reads the configured ADK session service", async () => {
  await withServer(async (baseUrl, services) => {
    await services.sessionService.createSession({
      appName: CONTEXTOPS_APP_NAME,
      userId: "CL-BH",
      sessionId: "SESSION-HTTP",
      state: { task_id: "EM-001", external_write: false },
    });
    const response = await fetch(`${baseUrl}/sessions/SESSION-HTTP?user_id=CL-BH`);
    assert.equal(response.status, 200);
    const body = await response.json() as {
      external_write: boolean;
      session: { id: string; state: Record<string, unknown> };
    };
    assert.equal(body.external_write, false);
    assert.equal(body.session.id, "SESSION-HTTP");
    assert.equal(body.session.state.task_id, "EM-001");
  });
});

test("unknown email identifiers are rejected instead of silently processing nothing", async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["UNKNOWN"] }),
    });
    assert.equal(response.status, 400);
    const body = await response.json() as { error: string; external_write: boolean };
    assert.match(body.error, /Unknown email_ids: UNKNOWN/);
    assert.equal(body.external_write, false);
  });
});
