import assert from "node:assert/strict";
import test from "node:test";

import { InMemorySpanExporter, SimpleSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

import { AuditStore, flushSpans } from "../src/telemetry.js";

test("span flushing never throws when provider support is absent or fails", async () => {
  await assert.doesNotReject(() => flushSpans("gcp", {}));
  await assert.doesNotReject(() =>
    flushSpans("gcp", {
      forceFlush: async () => {
        throw new Error("exporter unavailable");
      },
    }),
  );
});

test("audit records become OTel spans with actor, role, evidence, task and policy attributes", async () => {
  const exporter = new InMemorySpanExporter();
  const provider = new NodeTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exporter)] });
  provider.register();
  const store = new AuditStore();

  store.record({
    time: "2026-08-17T08:05:00.000Z",
    component: "Policy Gateway",
    actor: "Marcus Reed",
    role: "Consultant",
    message: "Commit denied before execution",
    evidence: ["VC-APR-001", "PJ-BH-01"],
    task_id: "DEMO-PORTFOLIO-001",
    policy_outcome: "DENY",
  });
  await provider.forceFlush();

  const [span] = exporter.getFinishedSpans();
  assert.ok(span);
  assert.equal(span.name, "contextops.audit.Policy_Gateway");
  assert.equal(span.attributes.actor, "Marcus Reed");
  assert.equal(span.attributes.role, "Consultant");
  assert.equal(span.attributes.evidence_ids, "VC-APR-001|PJ-BH-01");
  assert.equal(span.attributes.task_id, "DEMO-PORTFOLIO-001");
  assert.equal(span.attributes.policy_outcome, "DENY");
  await provider.shutdown();
});
test("CSV export has the compliance columns and neutralizes spreadsheet formulas", () => {
  const store = new AuditStore();
  store.record({
    time: "2026-08-17T08:05:00.000Z",
    component: "Audit",
    actor: "=HYPERLINK(\"https://evil.example\")",
    role: "+cmd",
    message: "-unsafe",
    evidence: ["@payload", "EM-023"],
    task_id: "DEMO-1",
    policy_outcome: "DENY",
  });

  const csv = store.toSafeCsv();
  assert.equal(csv.split("\n")[0], "time,component,actor,role,message,evidence,task_id");
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /'\+cmd/);
  assert.match(csv, /'-unsafe/);
  assert.match(csv, /'@payload\|EM-023/);
  assert.doesNotMatch(csv, /,"=[^']/);
});

test("JSON audit envelope preserves external_write false", () => {
  const store = new AuditStore();
  assert.deepEqual(store.toJson(), { external_write: false, events: [] });
});
