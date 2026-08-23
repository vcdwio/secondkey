import assert from "node:assert/strict";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the Verge portfolio command surface", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Verge ContextOps — Unit Platform<\/title>/i);
  assert.match(html, /Seven clients\. Three available people\. One decision\./);
  assert.match(html, /BlueHarbor Logistics/);
  assert.match(html, /Elevate Learning/);
  assert.match(html, /external_write: false/);
  assert.doesNotMatch(html, /codex-preview|Building your site|react-loading-skeleton/i);
});

test("renders all ten public Units and keeps shared core separate", async () => {
  const response = await render();
  const html = await response.text();
  const units = [
    "Intake &amp; Triage", "Customer Service", "Sales &amp; CRM",
    "Operations &amp; Scheduling", "Finance Admin", "Knowledge &amp; Documents",
    "Marketing &amp; Content", "Research &amp; Insights", "People &amp; Onboarding",
    "Purchase &amp; Order",
  ];

  for (const unit of units) assert.match(html, new RegExp(unit));
  assert.match(html, /Shared platform core/);
  assert.match(html, /Context Quality/);
  assert.match(html, /Audit \/ Eval/);
});

test("renders the input-output, connector, and quality-gate blueprint", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /Input \/ Output map/);
  assert.match(html, /API \/ MCP readiness/);
  assert.match(html, /25 regression scenarios/);
  assert.match(html, /Demo adapters/);
  assert.match(html, /Live connectors locked/);
});
