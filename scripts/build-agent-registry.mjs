/**
 * Generates the local Agent Registry projection from the canonical Unit list.
 * Cloud discovery is an optional read-through; these files remain the source of
 * truth for the demo and make the frontend and agent report identical contracts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { BUSINESS_UNITS } from "../lib/contextops/units.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const entries = BUSINESS_UNITS.map((unit) => ({
  id: unit.id,
  name: unit.name,
  chineseName: unit.chineseName,
  department: `${unit.shortName} Department`,
  version: "1.0.0",
  status: "published_local",
  crossDepartmentVisible: true,
  inputContract: unit.input,
  outputContract: unit.output,
  connectors: unit.connectors,
  approvalRequired: unit.output.some((item) => /approval/i.test(item)),
}));

const payload = `${JSON.stringify(entries, null, 2)}\n`;
for (const relativePath of [
  "agent/src/generated/registry.json",
  "lib/contextops/generated/registry.json",
]) {
  const outputPath = join(root, relativePath);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, payload);
}

console.log(`Generated ${entries.length} synchronized Unit registry entries.`);
