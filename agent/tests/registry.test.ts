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

test("partial cloud registry configuration fails closed", () => {
  assert.throws(
    () => createRegistryService({ GOOGLE_CLOUD_PROJECT: "demo-project" }),
    /Cloud Agent Registry requires both GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION/,
  );
});
