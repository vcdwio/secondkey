import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import express from "express";

import { AUTHORITY_MATRIX } from "../../lib/contextops/authority.js";
import {
  CONTEXTOPS_APP_NAME,
  buildGeminiModel,
  createAdkTriageRuntime,
  describeGeminiAccess,
  resolveGeminiAccess,
} from "./adk.js";
import { resolveAgentRoot } from "./config.js";
import { FLEET_TIERS, createFleetRuntime, type FleetRunResult } from "./fleet.js";
import { loadFixtureContext, loadRawInbound, resolveRepoRoot } from "./inbound.js";
import { REGISTRY_ENTRIES, createRegistryService } from "./registry.js";
import { createAgentServices, type AgentServiceBundle } from "./services.js";
import {
  AuditStore,
  flushSpans,
  initializeTelemetry,
  type TelemetryMode,
} from "./telemetry.js";
import { processEmailTriage, type ToolCallRequester } from "./triage.js";

const agentRoot = resolveAgentRoot(path.dirname(fileURLToPath(import.meta.url)));
dotenv.config({ path: path.join(agentRoot, ".env"), quiet: true });

type RegistryService = ReturnType<typeof createRegistryService>;

export interface AppDependencies {
  env?: Record<string, string | undefined>;
  services?: AgentServiceBundle;
  registryService?: RegistryService;
  auditStore?: AuditStore;
  requestToolCall?: ToolCallRequester;
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

function telemetryMode(env: Record<string, string | undefined>): TelemetryMode {
  const mode = env.CONTEXTOPS_TELEMETRY ?? "console";
  if (mode !== "off" && mode !== "console" && mode !== "gcp") {
    throw new Error("CONTEXTOPS_TELEMETRY must be off, console, or gcp");
  }
  return mode;
}

function positiveInteger(
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
) {
  const raw = env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function createApp(dependencies: AppDependencies = {}) {
  const env = dependencies.env ?? process.env;
  const services = dependencies.services ?? createAgentServices(env);
  const registryService = dependencies.registryService ?? createRegistryService(env);
  const auditStore = dependencies.auditStore ?? new AuditStore();
  const model = env.GEMINI_MODEL ?? "gemini-3.7-flash";
  const modelAccess = describeGeminiAccess(env);
  const mode = telemetryMode(env);
  const triageRateLimit = positiveInteger(env, "CONTEXTOPS_TRIAGE_RATE_LIMIT", 60);
  const triageRateWindowMs = positiveInteger(env, "CONTEXTOPS_TRIAGE_RATE_WINDOW_MS", 600_000);
  const fleetMaxLlmCalls = positiveInteger(env, "CONTEXTOPS_FLEET_MAX_LLM_CALLS", 15);
  let triageWindowStartedAt = Date.now();
  let triageRequestsInWindow = 0;
  let adkRequester: ToolCallRequester | undefined = dependencies.requestToolCall;

  /**
   * Built on first use, like the triage runtime: constructing it needs Gemini
   * access, and a service with no model configured must still serve /status,
   * /fleet and /registry rather than failing to start.
   */
  let fleetRun: ((input: { accountId: string; role: string; userId: string }) => Promise<FleetRunResult>) | undefined;
  const getFleetRun = () => {
    if (fleetRun) return fleetRun;
    try {
      const access = resolveGeminiAccess(env);
      fleetRun = createFleetRuntime({
        model: buildGeminiModel(access, model),
        services,
        appName: CONTEXTOPS_APP_NAME,
        maxLlmCalls: fleetMaxLlmCalls,
      }).run;
      return fleetRun;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini access is unavailable";
      throw new HttpError(503, message);
    }
  };

  const getRequester = () => {
    if (adkRequester) return adkRequester;
    try {
      adkRequester = createAdkTriageRuntime({
        access: resolveGeminiAccess(env),
        model,
        services,
      }).requestScorePriority;
      return adkRequester;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Gemini access is unavailable";
      throw new HttpError(503, message);
    }
  };

  const consumeCostBearingRequest = (response: express.Response) => {
    const now = Date.now();
    if (now - triageWindowStartedAt >= triageRateWindowMs) {
      triageWindowStartedAt = now;
      triageRequestsInWindow = 0;
    }
    if (triageRequestsInWindow >= triageRateLimit) {
      const retryAfterSeconds = Math.max(
        1,
        Math.ceil((triageRateWindowMs - (now - triageWindowStartedAt)) / 1000),
      );
      response.setHeader("Retry-After", String(retryAfterSeconds));
      response.setHeader("X-RateLimit-Limit", String(triageRateLimit));
      response.status(429).json({
        external_write: false,
        error: "Agent rate limit reached; retry after the current window",
      });
      return false;
    }
    triageRequestsInWindow += 1;
    response.setHeader("X-RateLimit-Limit", String(triageRateLimit));
    response.setHeader("X-RateLimit-Remaining", String(triageRateLimit - triageRequestsInWindow));
    return true;
  };

  const app = express();
  app.disable("x-powered-by");
  app.use((request, response, next) => {
    const allowedOrigin = env.CONTEXTOPS_UI_ORIGIN?.trim();
    const requestOrigin = request.headers.origin;
    if (allowedOrigin && requestOrigin === allowedOrigin) {
      response.setHeader("Access-Control-Allow-Origin", allowedOrigin);
      response.setHeader("Vary", "Origin");
      response.setHeader("Access-Control-Allow-Headers", "Content-Type");
      response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }
    if (request.method === "OPTIONS") {
      response.sendStatus(204);
      return;
    }
    next();
  });
  app.use(express.json({ limit: "64kb" }));

  /**
   * Two paths, one handler.
   *
   * `/healthz` returns 404 on Cloud Run — every other route on the same service
   * answers, and the route serves locally, so something in front of the
   * container claims that path before we see it. Rather than guess at the
   * mechanism under deadline, `/status` is the address we publish and test
   * against; `/healthz` stays registered for anyone who reaches for the
   * convention.
   */
  app.get(["/status", "/healthz"], (_request, response) => {
    response.json({
      status: "ok",
      external_write: false,
      runtime: "google-adk",
      state_backend: services.mode,
      model,
      model_backend: modelAccess.backend,
      model_location: modelAccess.location,
      registry_count: REGISTRY_ENTRIES.length,
      telemetry_mode: mode,
    });
  });

  /**
   * The capability partition, served as data.
   *
   * The claim that these agents differ is only worth anything if it can be
   * checked, so the tool set each tier was constructed with is published rather
   * than described. It is derived from the same arrays the agents are built
   * from, so it cannot drift out of date.
   */
  app.get("/fleet", (_request, response) => {
    response.json({
      coordinator: "secondkey_fleet",
      order: "draft → internal → external, ascending by what cannot be undone",
      tiers: FLEET_TIERS,
      external_write: false,
    });
  });

  /**
   * Run the fleet, and report which agent reached for which tool.
   *
   * GET /fleet says what each tier is allowed to do. This proves the split is
   * live: the `delegation` array is built from the actual run, so an agent
   * cannot be listed beside a tool its tier was never constructed with.
   */
  app.post("/fleet/run", async (request, response, next) => {
    try {
      const accountId = typeof request.body?.account_id === "string" ? request.body.account_id : "CL-BH";
      const role = typeof request.body?.role === "string" ? request.body.role : "Delivery Manager";
      if (!AUTHORITY_MATRIX[role]) {
        throw new HttpError(400, `Unknown role: ${role}`);
      }
      if (!consumeCostBearingRequest(response)) return;
      const result = await getFleetRun()({ accountId, role, userId: `fleet-${role.replaceAll(" ", "-")}` });
      response.json(result);
    } catch (error) {
      next(error);
    }
  });

  app.get("/registry", async (_request, response, next) => {
    try {
      response.json(await registryService.list());
    } catch (error) {
      next(error);
    }
  });

  app.get("/sessions/:id", async (request, response, next) => {
    try {
      const userId = typeof request.query.user_id === "string"
        ? request.query.user_id
        : "demo-operator";
      const session = await services.sessionService.getSession({
        appName: CONTEXTOPS_APP_NAME,
        userId,
        sessionId: request.params.id,
      });
      if (!session) throw new HttpError(404, "Session not found");
      response.json({ external_write: false, session });
    } catch (error) {
      next(error);
    }
  });

  app.get("/audit.json", (_request, response) => {
    response.json(auditStore.toJson());
  });

  app.get("/audit.csv", (_request, response) => {
    response.type("text/csv").send(auditStore.toSafeCsv());
  });

  app.post("/triage", async (request, response, next) => {
    try {
      const repoRoot = resolveRepoRoot();
      const inbound = loadRawInbound(repoRoot);
      const context = loadFixtureContext(repoRoot);
      const rawIds = request.body?.email_ids;
      if (!Array.isArray(rawIds)) {
        throw new HttpError(400, "email_ids is required and must be an array of strings");
      }
      if (rawIds.length < 1 || rawIds.length > 2) {
        throw new HttpError(400, "email_ids must contain between 1 and 2 identifiers");
      }
      const emailIds = rawIds?.filter(
        (value: unknown): value is string => typeof value === "string",
      ) as string[];
      if (emailIds.length !== rawIds.length) {
        throw new HttpError(400, "email_ids must be an array of strings");
      }
      const requestedIds = new Set(emailIds);
      const availableIds = new Set(inbound.map((email) => email.id));
      const unknownIds = [...requestedIds].filter((id) => !availableIds.has(id));
      if (unknownIds.length) {
        throw new HttpError(400, `Unknown email_ids: ${unknownIds.join(", ")}`);
      }

      if (!consumeCostBearingRequest(response)) return;

      const selected = inbound.filter((email) => requestedIds.has(email.id));
      const results = [];
      for (const email of selected) {
        const result = await processEmailTriage(email, inbound, context, getRequester());
        results.push(result);
        auditStore.record({
          time: new Date().toISOString(),
          component: "Intake & Triage",
          actor: result.actor_client_id ?? email.from_email,
          role: result.actor_client_id ? "Client Contact" : "Unresolved Sender",
          message: `${result.outcome}: ${result.reasons.join("; ")}`,
          evidence: [result.email_id, ...(result.duplicate_of ? [result.duplicate_of] : [])],
          task_id: result.email_id,
          policy_outcome: result.outcome.toUpperCase(),
        });
      }
      await flushSpans(mode);
      response.json({ external_write: false, processed_count: results.length, results });
    } catch (error) {
      next(error);
    }
  });

  app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
    void _next;
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof HttpError ? error.message : "Agent request failed closed";
    response.status(status).json({ external_write: false, error: message });
  });

  return app;
}

const isEntryPoint = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isEntryPoint) {
  const port = Number(process.env.PORT ?? 3001);
  await initializeTelemetry(process.env);
  createApp().listen(port, () => {
    console.log(`SecondKey Agent listening on ${port} · external_write=false`);
  });
}
