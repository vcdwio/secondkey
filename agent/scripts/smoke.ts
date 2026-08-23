import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

import { createAdkTriageRuntime } from "../src/adk.js";
import { resolveAgentRoot } from "../src/config.js";
import { loadFixtureContext, loadRawInbound, resolveRepoRoot } from "../src/inbound.js";
import { createAgentServices } from "../src/services.js";
import { processEmailTriage } from "../src/triage.js";

const agentRoot = resolveAgentRoot(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(agentRoot, ".env"), quiet: true });

const apiKey = process.env.GEMINI_API_KEY?.trim();
if (!apiKey) {
  throw new Error("Create agent/.env from agent/.env.example and set GEMINI_API_KEY before running smoke");
}

const repoRoot = resolveRepoRoot();
const inbound = loadRawInbound(repoRoot);
const context = loadFixtureContext(repoRoot);
const services = createAgentServices(process.env);
const runtime = createAdkTriageRuntime({
  apiKey,
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  services,
});
const requester = runtime.requestScorePriority;
const smokeIds = new Set(["EM-001", "EM-023", "EM-025", "EM-030"]);
const selected = inbound.filter((email) => smokeIds.has(email.id));
const results = [];

for (const email of selected) {
  results.push(await processEmailTriage(email, inbound, context, requester));
}

const byId = new Map(results.map((result) => [result.email_id, result]));
if (byId.get("EM-023")?.outcome !== "quarantine") throw new Error("EM-023 was not quarantined");
if (byId.get("EM-030")?.actor_client_id !== "CL-LP" || byId.get("EM-030")?.outcome !== "rejected") {
  throw new Error("EM-030 identity or cross-account rejection failed");
}
if (byId.get("EM-025")?.duplicate_of !== "EM-001") throw new Error("EM-025 duplicate detection failed");
if (byId.get("EM-001")?.tool_call?.name !== "score_priority") {
  throw new Error("Queued priority lacks a real score_priority tool call");
}

console.log(JSON.stringify({
  model: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  runtime: "google-adk",
  state_backend: services.mode,
  external_write: false,
  events: results.map((result) => ({
    email_id: result.email_id,
    outcome: result.outcome,
    priority: result.priority,
    actor_client_id: result.actor_client_id,
    requested_client_id: result.requested_client_id,
    duplicate_of: result.duplicate_of,
    tool_called: result.tool_call?.name ?? null,
  })),
}, null, 2));
