import scenario from "../../fixtures/verge-demo-pack/scenarios/flagship_monday_capacity_crisis.json" with { type: "json" };
import trace from "../../fixtures/verge-demo-pack/scenarios/flagship_decision_trace.json" with { type: "json" };
import outputs from "../../fixtures/verge-demo-pack/scenarios/flagship_proposed_outputs.json" with { type: "json" };
import evalScenarios from "../../fixtures/verge-demo-pack/scenarios/eval_scenarios.json" with { type: "json" };

export const FLAGSHIP_SCENARIO = scenario;
export const FLAGSHIP_TRACE = trace;
export const FLAGSHIP_OUTPUTS = outputs;
export const EVAL_SCENARIOS = evalScenarios;

export function runFlagshipScenario() {
  return {
    taskId: scenario.task_id,
    priorities: scenario.expected_priorities.map((item) => ({
      clientId: item.client_id,
      priority: item.priority,
    })),
    reallocatedHours: scenario.resource_changes.reduce(
      (total, change) => total + change.hours,
      0,
    ),
    approvalRequired: scenario.approval_required,
    externalWrite: scenario.external_write,
    status: trace.final_status,
    trace: trace.steps,
    outputs,
  };
}
