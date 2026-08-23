import assert from "node:assert/strict";
import test from "node:test";

import { BUSINESS_UNITS } from "../../lib/contextops/units.js";
import { REGISTRY_ENTRIES, createRegistryService } from "../src/registry.js";

test("local registry contains exactly one synchronized entry for every business Unit", async () => {
  assert.equal(REGISTRY_ENTRIES.length, BUSINESS_UNITS.length);
  assert.deepEqual(
    REGISTRY_ENTRIES.map((entry) => entry.id),
    BUSINESS_UNITS.map((unit) => unit.id),
  );

  for (const unit of BUSINESS_UNITS) {
    const entry = REGISTRY_ENTRIES.find((candidate) => candidate.id === unit.id);
    assert.ok(entry);
    assert.equal(entry.version, "1.0.0");
    assert.equal(entry.crossDepartmentVisible, true);
    assert.deepEqual(entry.inputContract, unit.input);
    assert.deepEqual(entry.outputContract, unit.output);
    assert.deepEqual(entry.connectors, unit.connectors);
  }

  const response = await createRegistryService({}).list();
  assert.equal(response.entries.length, 10);
  assert.deepEqual(response.cloud, { enabled: false, discovered: 0 });
});

test("Vertex model configuration does not implicitly enable Cloud Agent Registry", async () => {
  const response = await createRegistryService({
    GOOGLE_CLOUD_PROJECT: "demo-project",
    GOOGLE_CLOUD_LOCATION: "global",
  }).list();

  assert.deepEqual(response.cloud, { enabled: false, discovered: 0 });
});

test("explicit Cloud Agent Registry configuration discovers remote agents", async () => {
  const response = await createRegistryService(
    {
      CONTEXTOPS_CLOUD_REGISTRY: "true",
      GOOGLE_CLOUD_PROJECT: "demo-project",
      GOOGLE_CLOUD_LOCATION: "global",
    },
    {
      async listAgents() {
        return { agents: [{ name: "agents/one" }, { name: "agents/two" }] };
      },
    },
  ).list();

  assert.deepEqual(response.cloud, { enabled: true, discovered: 2 });
});

test("partial explicitly enabled cloud registry configuration fails closed", () => {
  assert.throws(
    () => createRegistryService({
      CONTEXTOPS_CLOUD_REGISTRY: "true",
      GOOGLE_CLOUD_PROJECT: "demo-project",
    }),
    /Cloud Agent Registry requires both GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION/,
  );
});
