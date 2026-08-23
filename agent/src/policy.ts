import {
  PolicyOutcome,
  type BasePolicyEngine,
  type BaseTool,
  type PolicyCheckResult,
  type SecurityPlugin,
  type State,
  type ToolCallPolicyContext,
} from "@google/adk";

import { evaluateAuthority } from "../../lib/contextops/authority.js";

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export class ContextOpsPolicyEngine implements BasePolicyEngine {
  async evaluate(context: ToolCallPolicyContext): Promise<PolicyCheckResult> {
    if (context.tool.name === "commit_changes") {
      const role = typeof context.toolArgs.role === "string" ? context.toolArgs.role : "";
      const hoursAffected = finiteNumber(context.toolArgs.hoursAffected);
      const spendAud = finiteNumber(context.toolArgs.spendAud);
      const externalCommunications = finiteNumber(context.toolArgs.externalCommunications);
      const accountsTouched = finiteNumber(context.toolArgs.accountsTouched);
      if (!role || hoursAffected === null || spendAud === null || externalCommunications === null || accountsTouched === null) {
        return { outcome: PolicyOutcome.DENY, reason: "Malformed authority scope" };
      }
      const verdict = evaluateAuthority(role, {
        hoursAffected,
        spendAud,
        externalCommunications,
        accountsTouched,
      });
      if (!verdict.canApprove) {
        return { outcome: PolicyOutcome.DENY, reason: verdict.blockedBy.join("; ") };
      }
    }

    if (context.tool.name === "build_context_packet") {
      const accessGroup = typeof context.toolArgs.accessGroup === "string" ? context.toolArgs.accessGroup : "";
      const permissionGroups = Array.isArray(context.toolArgs.permissionGroups)
        ? context.toolArgs.permissionGroups.filter((value): value is string => typeof value === "string")
        : [];
      if (!accessGroup || !permissionGroups.includes(accessGroup)) {
        return {
          outcome: PolicyOutcome.DENY,
          reason: `Permission groups do not include required access group ${accessGroup || "unknown"}`,
        };
      }
    }

    return { outcome: PolicyOutcome.ALLOW, reason: "Authority and tenant checks passed" };
  }
}

export async function executeWithSecurityPlugin({
  plugin,
  tool,
  toolArgs,
  state,
}: {
  plugin: SecurityPlugin;
  tool: BaseTool;
  toolArgs: Record<string, unknown>;
  state: State;
}) {
  const toolContext = {
    state,
    functionCallId: "policy-test-call",
    requestConfirmation: () => undefined,
  } as never;
  const blocked = await plugin.beforeToolCallback({ tool, toolArgs, toolContext });
  if (blocked !== undefined) return blocked;
  return tool.runAsync({ args: toolArgs, toolContext });
}
