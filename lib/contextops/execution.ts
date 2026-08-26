/**
 * Simulated execution.
 *
 * Lives in its own module with no imports so that both builds can reach it:
 * the web app resolves it through engine.ts, and the agent service imports it
 * directly. Keeping one definition matters more than the file boundary — the
 * idempotency keys the UI shows and the ones the agent returns have to be the
 * same keys.
 */
export type ExecutionStatus = "queued" | "simulated" | "rolled_back" | "held";

export interface ExecutionItem {
  id: string;
  kind: string;
  connector: string;
  target: string;
  summary: string;
  method: string;
  endpoint: string;
  reversible: boolean;
}

export interface ExecutionResult extends ExecutionItem {
  status: ExecutionStatus;
  externalWrite: false;
  idempotencyKey: string;
  detail: string;
}

/**
 * Demo execution never leaves the process. It produces the request that *would*
 * be sent, an idempotency key, and a reversible flag, so a reviewer can see the
 * exact blast radius before Live is ever unlocked.
 */
export function simulateExecution(
  items: ExecutionItem[],
  { taskId, approved }: { taskId: string; approved: boolean },
): ExecutionResult[] {
  return items.map((item, index) => ({
    ...item,
    externalWrite: false as const,
    idempotencyKey: `${taskId}-${item.id}-${String(index + 1).padStart(2, "0")}`,
    status: approved ? "simulated" : "held",
    detail: approved
      ? `Simulated ${item.method} ${item.endpoint} — payload prepared, nothing sent.`
      : "Held behind the approval gate.",
  }));
}

export function rollbackExecution(results: ExecutionResult[]): ExecutionResult[] {
  return results.map((result) => ({
    ...result,
    status: result.reversible ? "rolled_back" : result.status,
    detail: result.reversible
      ? "Rolled back with the stored idempotency key; state matches the pre-approval snapshot."
      : "Not reversible by design — this is why it stays behind a human send step.",
  }));
}
