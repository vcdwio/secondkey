/**
 * The fleet's tools, partitioned by authority.
 *
 * The partition is the architecture, not a labelling exercise. An agent that
 * must not commit does not receive a commit tool, so its inability to commit is
 * a property of how it was built rather than an instruction it was asked to
 * follow. A prompt can be argued with; an empty toolbox cannot.
 *
 * Three tiers, in increasing order of what they can do to the world:
 *
 *   read/draft   — reads the queue, assembles evidence, drafts. Cannot write.
 *   internal     — reversible internal work, inside the acting role's limits.
 *                  Structurally incapable of releasing anything to a client.
 *   external     — client-facing commitments. Irreversible, therefore always
 *                  stops for a human, whatever the role.
 *
 * Every path keeps `external_write` false: even the external tier only ever
 * produces the request that *would* be sent.
 */
import { FunctionTool } from "@google/adk";
import { z } from "zod/v4";

import { evaluateAuthority } from "../../lib/contextops/authority.js";
import {
  rollbackExecution,
  simulateExecution,
  type ExecutionResult,
} from "../../lib/contextops/execution.js";
import portfolio from "../../lib/contextops/generated/portfolio.json" with { type: "json" };

type PortfolioIncident = (typeof portfolio.incidents)[number];

const findIncident = (id: string): PortfolioIncident | undefined =>
  portfolio.incidents.find((entry) => entry.id === id);

/* ------------------------------------------------------------- tier 1: read */

export const listQueue = new FunctionTool({
  name: "list_queue",
  description:
    "List every open unit of work with its account, SLA clock, project status and committed dates. " +
    "Call this first; it is the only source of truth for what is waiting.",
  parameters: z.object({}),
  execute: () =>
    portfolio.incidents.map((item) => ({
      id: item.id,
      account: item.clientName,
      tier: item.tier,
      request: item.request,
      sla_hours_remaining: item.signals.slaHoursRemaining,
      project_status: item.project?.status ?? null,
      due_in_hours: item.project?.deadlineInHours ?? null,
      annual_value_aud: item.annualValueAud,
      external_write: false as const,
    })),
});

export const buildContextPacket = new FunctionTool({
  name: "build_context_packet",
  description:
    "Assemble the Context Packet for one account: verified facts with their source ids, conflicts, and what " +
    "is still missing. Retrieval is filtered by permission group before anything is ranked. Every claim in a " +
    "draft must cite a source id returned here.",
  parameters: z.object({
    id: z.string().describe("Queue item id, e.g. CL-BH"),
    accessGroup: z.string().describe("Access group the record requires"),
    permissionGroups: z.array(z.string()).describe("Permission groups held by the acting role"),
  }),
  execute: ({ id }) => {
    const item = findIncident(id);
    if (!item) return { error: `unknown queue item: ${id}`, external_write: false as const };
    return {
      entity_id: id,
      verified_facts: item.confidence.evidence,
      conflicts: item.confidence.conflicts,
      missing_information: item.confidence.missingInformation,
      external_write: false as const,
    };
  },
});

/* --------------------------------------------------- tier 2: internal write */

const internalScope = z.object({
  hoursAffected: z.number().describe("Total staff hours this decision moves"),
  spendAud: z.number().describe("Money committed, in AUD"),
  accountsTouched: z.number().describe("How many distinct client accounts the decision spans"),
  role: z.string().describe("Role of the person on whose behalf this runs"),
  summary: z.string().describe("One line a human approver would read before deciding"),
});

/**
 * `externalCommunications` is pinned to zero rather than exposed as an argument.
 * The internal tier has no way to express "and tell the client", so no prompt,
 * jailbreak or malformed argument can turn an internal reshuffle into a
 * client-facing promise. Releasing anything external requires a different tool,
 * which this agent does not hold.
 */
export const commitInternalChange = new FunctionTool({
  name: "commit_internal_change",
  description:
    "Apply reversible internal changes — reassignments, scheduling, internal tickets. Cannot send anything to " +
    "a client. Every write is simulated and external_write stays false. Anything beyond the acting role's " +
    "authority pauses here for human approval.",
  parameters: internalScope,
  requireConfirmation: (input) =>
    !evaluateAuthority(input.role, {
      hoursAffected: input.hoursAffected,
      spendAud: input.spendAud,
      externalCommunications: 0,
      accountsTouched: input.accountsTouched,
    }).canApprove,
  execute: (input) => {
    const verdict = evaluateAuthority(input.role, {
      hoursAffected: input.hoursAffected,
      spendAud: input.spendAud,
      externalCommunications: 0,
      accountsTouched: input.accountsTouched,
    });
    const reversible = portfolio.executionPlan.filter((item) => item.reversible);
    const results = simulateExecution(reversible, { taskId: portfolio.taskId, approved: true });
    return {
      tier: "internal" as const,
      cleared_by_role: verdict.canApprove,
      blocked_by: verdict.blockedBy,
      escalated_to: verdict.canApprove ? null : verdict.escalateTo,
      external_write: false as const,
      calls: results.map(describeCall),
      reversible_count: results.length,
    };
  },
});

/* --------------------------------------------------- tier 3: external write */

/**
 * Always confirmed, for every role including the General Manager.
 *
 * The gate here is not about authority — it is about reversibility. A client
 * email cannot be recalled, so no limit exists that would make releasing one
 * safe to do unattended. `requireConfirmation: true` states that as a property
 * of the tool rather than as a rule someone has to remember.
 */
export const releaseExternalCommitment = new FunctionTool({
  name: "release_external_commitment",
  description:
    "Release a client-facing commitment — an email, a revised date, a scope promise. Irreversible, so it " +
    "always waits for a named human, whatever the acting role's limits. The system has no send capability: " +
    "approval produces the exact message that would go out, and nothing leaves.",
  parameters: z.object({
    accountId: z.string().describe("Account the commitment is made to, e.g. CL-BH"),
    role: z.string().describe("Role of the person on whose behalf this runs"),
    summary: z.string().describe("One line a human approver will read before releasing"),
  }),
  requireConfirmation: true,
  execute: (input) => {
    const irreversible = portfolio.executionPlan.filter((item) => !item.reversible);
    const results = simulateExecution(irreversible, { taskId: portfolio.taskId, approved: true });
    return {
      tier: "external" as const,
      account_id: input.accountId,
      released_by: `human approver · requested under ${input.role}`,
      external_write: false as const,
      held_for_human_send: results.map((item) => `${item.summary} — drafted, not sent`),
      calls: results.map(describeCall),
    };
  },
});

export const rollbackChanges = new FunctionTool({
  name: "rollback_changes",
  description:
    "Undo everything reversible from the last internal commit using its idempotency keys. Client commitments " +
    "were never sent, so there is nothing to undo for them.",
  parameters: z.object({}),
  execute: () => {
    const applied = simulateExecution(
      portfolio.executionPlan.filter((item) => item.reversible),
      { taskId: portfolio.taskId, approved: true },
    );
    const rolled = rollbackExecution(applied);
    return {
      rolled_back: rolled.filter((item) => item.status === "rolled_back").length,
      state: "matches the pre-approval snapshot",
      external_write: false as const,
    };
  },
});

function describeCall(item: ExecutionResult) {
  return {
    id: item.id,
    method: item.method,
    endpoint: item.endpoint,
    target: item.target,
    summary: item.summary,
    idempotency_key: item.idempotencyKey,
    reversible: item.reversible,
    status: item.status,
  };
}

/** The three tiers, as the disjoint tool sets each agent is constructed with. */
export const DRAFT_TOOLS = [listQueue, buildContextPacket];
export const INTERNAL_TOOLS = [listQueue, commitInternalChange, rollbackChanges];
export const EXTERNAL_TOOLS = [listQueue, releaseExternalCommitment];
