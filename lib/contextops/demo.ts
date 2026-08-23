import scenario from "../../fixtures/verge-demo-pack/scenarios/flagship_monday_capacity_crisis.json" with { type: "json" };
import trace from "../../fixtures/verge-demo-pack/scenarios/flagship_decision_trace.json" with { type: "json" };
import outputs from "../../fixtures/verge-demo-pack/scenarios/flagship_proposed_outputs.json" with { type: "json" };
import evalScenarios from "../../fixtures/verge-demo-pack/scenarios/eval_scenarios.json" with { type: "json" };
import portfolio from "./generated/portfolio.json" with { type: "json" };

export const FLAGSHIP_SCENARIO = scenario;
export const FLAGSHIP_TRACE = trace;
export const FLAGSHIP_OUTPUTS = outputs;
export const EVAL_SCENARIOS = evalScenarios;

export function runFlagshipScenario() {
  const priorityOrder: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
  return {
    taskId: portfolio.taskId,
    priorities: portfolio.incidents
      .map((item) => ({ clientId: item.id, priority: item.expectedPriority }))
      .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    reallocatedHours: portfolio.capacitySummary.proposedHours,
    approvalRequired: portfolio.approval.requiresApproval,
    externalWrite: portfolio.approval.externalWrite,
    status: portfolio.traceStatus,
    trace: portfolio.trace,
    outputs: portfolio.outputs,
  };
}
