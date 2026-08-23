import {
  InMemoryMemoryService,
  InMemorySessionService,
  VertexAiMemoryBankService,
  VertexAiSessionService,
  type BaseMemoryService,
  type BaseSessionService,
} from "@google/adk";

export interface AgentServiceBundle {
  mode: "memory" | "vertex";
  sessionService: BaseSessionService;
  memoryService: BaseMemoryService;
}

export type AgentEnvironment = Record<string, string | undefined>;

export function createAgentServices(env: AgentEnvironment = process.env): AgentServiceBundle {
  if (env.CONTEXTOPS_STATE_BACKEND !== "vertex") {
    return {
      mode: "memory",
      sessionService: new InMemorySessionService(),
      memoryService: new InMemoryMemoryService(),
    };
  }

  const projectId = env.GOOGLE_CLOUD_PROJECT?.trim();
  const location = env.GOOGLE_CLOUD_LOCATION?.trim();
  const agentEngineId = env.VERTEX_AGENT_ENGINE_ID?.trim();
  const expressModeApiKey = env.VERTEX_EXPRESS_API_KEY?.trim();
  if (expressModeApiKey) {
    throw new Error(
      "ADK 2.0 does not support API-key authentication for Vertex Agent Engine state; use Application Default Credentials",
    );
  }
  if (!projectId || !location || !agentEngineId) {
    throw new Error(
      "Vertex state requires GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION, VERTEX_AGENT_ENGINE_ID, and Application Default Credentials",
    );
  }

  return {
    mode: "vertex",
    sessionService: new VertexAiSessionService({
      projectId,
      location,
      agentEngineId,
    }),
    memoryService: new VertexAiMemoryBankService({
      projectId,
      location,
      agentEngineId,
    }),
  };
}
