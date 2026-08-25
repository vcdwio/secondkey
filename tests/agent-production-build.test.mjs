import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const repositoryRoot = new URL("..", import.meta.url);

test("agent production build excludes tests and local smoke scripts", () => {
  const result = spawnSync(
    "npm",
    ["run", "build", "--prefix", "agent", "--", "--listFilesOnly"],
    { cwd: repositoryRoot, encoding: "utf8" },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.doesNotMatch(result.stdout, /\/agent\/tests\//);
  assert.doesNotMatch(result.stdout, /\/agent\/scripts\//);
});

test("Docker build preserves the root ESM boundary for shared ContextOps code", () => {
  const dockerfile = readFileSync(new URL("../Dockerfile", import.meta.url), "utf8");
  const packageBoundary = dockerfile.indexOf("COPY package.json ./package.json");
  const agentBuild = dockerfile.indexOf("RUN npm run build --prefix agent");

  assert.ok(packageBoundary >= 0, "Dockerfile must copy the root package.json before compiling shared code");
  assert.ok(packageBoundary < agentBuild, "the root ESM package boundary must exist before the agent build");
});

test("GCP telemetry declares the Cloud Trace exporter required by ADK", () => {
  const agentPackage = JSON.parse(
    readFileSync(new URL("../agent/package.json", import.meta.url), "utf8"),
  );

  assert.match(
    agentPackage.dependencies?.["@google-cloud/opentelemetry-cloud-trace-exporter"] ?? "",
    /^3\./,
  );
});
