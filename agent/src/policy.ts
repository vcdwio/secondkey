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

    /**
     * The fleet's two write tiers, re-checked here even though each agent only
     * holds the tools for its own tier. Construction decides what an agent can
     * *reach*; this decides what any call is allowed to *do*, so a misrouted or
     * hand-crafted call is caught even if the tool partition were bypassed.
     *
     * DENY and CONFIRM mean different things and the distinction is the point:
     * DENY is "no human can authorise this through this path"; CONFIRM is "a
     * human with enough authority must say yes first".
     */
    if (context.tool.name === "commit_internal_change") {
      const role = typeof context.toolArgs.role === "string" ? context.toolArgs.role : "";
      const hoursAffected = finiteNumber(context.toolArgs.hoursAffected);
      const spendAud = finiteNumber(context.toolArgs.spendAud);
      const accountsTouched = finiteNumber(context.toolArgs.accountsTouched);
      const externalCommunications = finiteNumber(context.toolArgs.externalCommunications) ?? 0;

      if (!role || hoursAffected === null || spendAud === null || accountsTouched === null) {
        return { outcome: PolicyOutcome.DENY, reason: "Malformed authority scope" };
      }
      if (externalCommunications > 0) {
        return {
          outcome: PolicyOutcome.DENY,
          reason: "The internal tier cannot release client communications; use the external tier, which is human-gated",
        };
      }

      const verdict = evaluateAuthority(role, {
        hoursAffected,
        spendAud,
        externalCommunications: 0,
        accountsTouched,
      });
      if (!verdict.canApprove) {
        return {
          outcome: PolicyOutcome.CONFIRM,
          reason: `${verdict.blockedBy.join("; ")} — escalate to ${verdict.escalateTo}`,
        };
      }
    }

    /**
     * Irreversible by definition, so no authority level makes it automatic.
     * There is deliberately no role check here: a General Manager waits too.
     */
    if (context.tool.name === "release_external_commitment") {
      return {
        outcome: PolicyOutcome.CONFIRM,
        reason: "Client-facing commitments are irreversible and always wait for a named human",
      };
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
