import { AgentRegistry } from "@google/adk";

import registryEntries from "./generated/registry.json" with { type: "json" };

export interface RegistryEntry {
  id: string;
  name: string;
  chineseName: string;
  department: string;
  version: string;
  status: string;
  crossDepartmentVisible: boolean;
  inputContract: string[];
  outputContract: string[];
  connectors: string[];
  approvalRequired: boolean;
}

export const REGISTRY_ENTRIES = registryEntries satisfies RegistryEntry[];

export interface RegistryResponse {
  entries: RegistryEntry[];
  cloud: { enabled: boolean; discovered: number };
  external_write: false;
}

export function createRegistryService(
  env: Record<string, string | undefined>,
  remoteRegistry?: Pick<AgentRegistry, "listAgents">,
) {
  const projectId = env.GOOGLE_CLOUD_PROJECT;
  const location = env.GOOGLE_CLOUD_LOCATION;
  if (Boolean(projectId) !== Boolean(location)) {
    throw new Error(
      "Cloud Agent Registry requires both GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION",
    );
  }

  const cloudRegistry =
    projectId && location
      ? (remoteRegistry ?? new AgentRegistry({ projectId, location }))
      : undefined;

  return {
    async list(): Promise<RegistryResponse> {
      const discovered = cloudRegistry
        ? (await cloudRegistry.listAgents({ pageSize: 100 })).agents?.length ?? 0
        : 0;
      return {
        entries: REGISTRY_ENTRIES,
        cloud: { enabled: Boolean(cloudRegistry), discovered },
        external_write: false,
      };
    },
  };
}
