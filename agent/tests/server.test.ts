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
  env: Record<string, string> = {},
) {
  const services = createAgentServices({});
  const app = createApp({
    env: {
      GEMINI_MODEL: "gemini-test-model",
      CONTEXTOPS_TELEMETRY: "off",
      CONTEXTOPS_UI_ORIGIN: "https://fleet.example",
      ...env,
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
      model_backend: "developer",
      model_location: "developer-api",
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
    const firstResponse = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-001", "EM-023"] }),
    });
    assert.equal(firstResponse.status, 200);
    const firstBody = await firstResponse.json() as {
      external_write: boolean;
      processed_count: number;
      results: TriageHttpResult[];
    };
    const secondResponse = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-025", "EM-030"] }),
    });
    assert.equal(secondResponse.status, 200);
    const secondBody = await secondResponse.json() as {
      external_write: boolean;
      processed_count: number;
      results: TriageHttpResult[];
    };
    assert.equal(firstBody.external_write, false);
    assert.equal(secondBody.external_write, false);
    assert.equal(firstBody.processed_count + secondBody.processed_count, 4);
    const byId = new Map([...firstBody.results, ...secondBody.results].map((result) => [result.email_id, result]));
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

test("cost-bearing endpoints share one rate limit after triage validates a bounded batch", async () => {
  await withServer(async (baseUrl) => {
    const missing = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    assert.equal(missing.status, 400);
    assert.match((await missing.json() as { error: string }).error, /email_ids is required/i);

    const oversized = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-001", "EM-023", "EM-025"] }),
    });
    assert.equal(oversized.status, 400);
    assert.match((await oversized.json() as { error: string }).error, /between 1 and 2/i);

    const first = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-023"] }),
    });
    assert.equal(first.status, 200);

    const fleetLimited = await fetch(`${baseUrl}/fleet/run`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ account_id: "CL-BH", role: "Delivery Manager" }),
    });
    assert.equal(fleetLimited.status, 429);
    assert.ok(Number(fleetLimited.headers.get("retry-after")) >= 1);
    assert.equal((await fleetLimited.json() as { external_write: boolean }).external_write, false);

    const triageLimited = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-023"] }),
    });
    assert.equal(triageLimited.status, 429);
    assert.ok(Number(triageLimited.headers.get("retry-after")) >= 1);
    assert.equal((await triageLimited.json() as { external_write: boolean }).external_write, false);
  }, {
    CONTEXTOPS_TRIAGE_RATE_LIMIT: "1",
    CONTEXTOPS_TRIAGE_RATE_WINDOW_MS: "60000",
  });
});

test("default public allowance lets judges complete 60 valid probes before throttling", async () => {
  await withServer(async (baseUrl) => {
    for (let requestNumber = 1; requestNumber <= 60; requestNumber += 1) {
      const response = await fetch(`${baseUrl}/triage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email_ids: ["EM-023"] }),
      });
      assert.equal(response.status, 200, `request ${requestNumber} should be allowed`);
      assert.equal(response.headers.get("x-ratelimit-limit"), "60");
      assert.equal(
        response.headers.get("x-ratelimit-remaining"),
        String(60 - requestNumber),
      );
    }

    const throttled = await fetch(`${baseUrl}/triage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email_ids: ["EM-023"] }),
    });
    assert.equal(throttled.status, 429);
    assert.equal(throttled.headers.get("x-ratelimit-limit"), "60");
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
