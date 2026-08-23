import fs from "node:fs";
import path from "node:path";

interface PackageManifest {
  name?: string;
}

export function resolveAgentRoot(moduleDirectory: string) {
  let candidate = path.resolve(moduleDirectory);
  for (let depth = 0; depth < 5; depth += 1) {
    const manifestPath = path.join(candidate, "package.json");
    if (fs.existsSync(manifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as PackageManifest;
      if (manifest.name === "secondkey-agent") return candidate;
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) break;
    candidate = parent;
  }
  throw new Error("Unable to locate the SecondKey agent root");
}
