import { trace } from "@opentelemetry/api";
import {
  ConsoleSpanExporter,
  SimpleSpanProcessor,
} from "@opentelemetry/sdk-trace-base";
import {
  getGcpExporters,
  getGcpResource,
  maybeSetOtelProviders,
} from "@google/adk";

export interface AuditRecord {
  time: string;
  component: string;
  actor: string;
  role: string;
  message: string;
  evidence: string[];
  task_id: string;
  policy_outcome: string;
}

function csvCell(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export class AuditStore {
  readonly records: AuditRecord[] = [];

  record(event: AuditRecord): void {
    this.records.push(structuredClone(event));
    const component = event.component.replaceAll(/[^A-Za-z0-9_]/g, "_");
    const span = trace
      .getTracer("secondkey-contextops-audit")
      .startSpan(`contextops.audit.${component}`);
    span.setAttributes({
      actor: event.actor,
      role: event.role,
      evidence_ids: event.evidence.join("|"),
      task_id: event.task_id,
      policy_outcome: event.policy_outcome,
      external_write: false,
    });
    span.end();
  }

  toJson(): { external_write: false; events: AuditRecord[] } {
    return { external_write: false, events: structuredClone(this.records) };
  }

  toSafeCsv(): string {
    const header = "time,component,actor,role,message,evidence,task_id";
    const rows = this.records.map((event) =>
      [
        event.time,
        event.component,
        event.actor,
        event.role,
        event.message,
        event.evidence.join("|"),
        event.task_id,
      ]
        .map(csvCell)
        .join(","),
    );
    return [header, ...rows].join("\n");
  }
}

export type TelemetryMode = "off" | "console" | "gcp";

interface FlushableTracerProvider {
  getDelegate?: () => unknown;
  forceFlush?: () => Promise<void>;
}

export async function flushSpans(
  mode: TelemetryMode,
  provider: FlushableTracerProvider = trace.getTracerProvider() as FlushableTracerProvider,
): Promise<void> {
  if (mode !== "gcp") return;
  try {
    const target = (typeof provider.getDelegate === "function"
      ? provider.getDelegate()
      : provider) as { forceFlush?: () => Promise<void> } | undefined;
    if (typeof target?.forceFlush === "function") await target.forceFlush();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown exporter error";
    console.warn(`OpenTelemetry forceFlush failed: ${message}`);
  }
}

export async function initializeTelemetry(
  env: Record<string, string | undefined>,
): Promise<TelemetryMode> {
  const mode = (env.CONTEXTOPS_TELEMETRY ?? "console") as TelemetryMode;
  if (!(["off", "console", "gcp"] as string[]).includes(mode)) {
    throw new Error("CONTEXTOPS_TELEMETRY must be off, console, or gcp");
  }
  if (mode === "off") return mode;
  if (mode === "console") {
    maybeSetOtelProviders([
      { spanProcessors: [new SimpleSpanProcessor(new ConsoleSpanExporter())] },
    ]);
    return mode;
  }

  const hooks = await getGcpExporters({
    enableTracing: true,
    enableMetrics: false,
    enableLogging: false,
  });
  maybeSetOtelProviders([hooks], getGcpResource());
  return mode;
}
