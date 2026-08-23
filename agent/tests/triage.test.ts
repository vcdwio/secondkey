import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { resolveAgentRoot } from "../src/config.js";
import { loadFixtureContext, loadRawInbound } from "../src/inbound.js";
import {
  buildDeterministicEnvelope,
  processEmailTriage,
  type RequestedToolCall,
} from "../src/triage.js";

const repoRoot = path.resolve(process.cwd(), "..");

test("compiled and source modules resolve the same agent root", () => {
  const expected = path.join(repoRoot, "agent");

  assert.equal(resolveAgentRoot(path.join(expected, "src")), expected);
  assert.equal(resolveAgentRoot(path.join(expected, "dist/src")), expected);
});

test("raw inbound exposes no authoritative client identifier", () => {
  const inbound = loadRawInbound(repoRoot);

  assert.equal(inbound.length, 30);
  assert.deepEqual(Object.keys(inbound[0] ?? {}).sort(), [
    "body",
    "from_email",
    "id",
    "sent_at",
    "subject",
  ]);
  assert.equal("client_id" in (inbound[0] ?? {}), false);
});

test("fixture identity resolves the sender before detecting cross-account access", () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-030");
  assert.ok(email);

  const envelope = buildDeterministicEnvelope(email, inbound, context);

  assert.equal(envelope.actorClientId, "CL-LP");
  assert.equal(envelope.requestedClientId, "CL-MH");
  assert.equal(envelope.crossAccount, true);
  assert.equal(envelope.outcome, "rejected");
});

test("prompt injection is quarantined before Gemini is invoked", async () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-023");
  assert.ok(email);
  let modelCalls = 0;

  const result = await processEmailTriage(email, inbound, context, async () => {
    modelCalls += 1;
    throw new Error("model must not be invoked");
  });

  assert.equal(result.outcome, "quarantine");
  assert.equal(result.external_write, false);
  assert.equal(result.tool_call, null);
  assert.equal(modelCalls, 0);
});

test("duplicate detection links the retry to the earlier matching message", () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-025");
  assert.ok(email);

  const envelope = buildDeterministicEnvelope(email, inbound, context);

  assert.equal(envelope.outcome, "duplicate");
  assert.equal(envelope.duplicateOf, "EM-001");
});

test("a real score_priority request produces evidence without controlling priority", async () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-001");
  assert.ok(email);
  const requestedCall: RequestedToolCall = {
    name: "score_priority",
    args: {
      summary: "Shipment ETA discrepancy before an executive preview",
      intent: "incident_triage",
      urgency_mentions: ["tomorrow", "within two hours"],
    },
  };

  const result = await processEmailTriage(
    email,
    inbound,
    context,
    async () => requestedCall,
  );

  assert.equal(result.outcome, "queued");
  assert.equal(result.priority, "P0");
  assert.equal(result.tool_call?.name, "score_priority");
  assert.deepEqual(result.tool_call?.args, requestedCall.args);
  assert.equal(result.tool_call?.result.priority, "P0");
});

test("queued triage passes the deterministic envelope into the model-tool boundary", async () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-001");
  assert.ok(email);
  let observedPriority = null;

  await processEmailTriage(email, inbound, context, async (_message, envelope) => {
    observedPriority = envelope.priority;
    return {
      name: "score_priority",
      args: { summary: "summary", intent: "triage", urgency_mentions: ["tomorrow"] },
    };
  });

  assert.equal(observedPriority, "P0");
});

test("missing function call fails closed instead of fabricating evidence", async () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-017");
  assert.ok(email);

  await assert.rejects(
    processEmailTriage(email, inbound, context, async () => null),
    /Gemini did not request score_priority/,
  );
});

test("malformed tool arguments fail closed before deterministic scoring", async () => {
  const inbound = loadRawInbound(repoRoot);
  const context = loadFixtureContext(repoRoot);
  const email = inbound.find((entry) => entry.id === "EM-017");
  assert.ok(email);

  await assert.rejects(
    processEmailTriage(email, inbound, context, async () => ({
      name: "score_priority",
      args: { summary: "", intent: "", urgency_mentions: "none" },
    } as unknown as RequestedToolCall)),
    /Invalid score_priority arguments/,
  );
});
