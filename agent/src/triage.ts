import type { FixtureContext, RawInboundEmail } from "./inbound.js";

export type Priority = "P0" | "P1" | "P2";
export type TriageOutcome = "queued" | "duplicate" | "rejected" | "quarantine" | "human_review";

export interface ScorePriorityArgs {
  summary: string;
  intent: string;
  urgency_mentions: string[];
}

export interface RequestedToolCall {
  name: string;
  args: ScorePriorityArgs;
}

export interface DeterministicEnvelope {
  emailId: string;
  actorClientId: string | null;
  requestedClientId: string | null;
  crossAccount: boolean;
  duplicateOf: string | null;
  outcome: TriageOutcome;
  priority: Priority | null;
  reasons: string[];
}

export interface TriageResult {
  email_id: string;
  actor_client_id: string | null;
  requested_client_id: string | null;
  outcome: TriageOutcome;
  priority: Priority | null;
  duplicate_of: string | null;
  reasons: string[];
  external_write: false;
  tool_call: null | {
    name: "score_priority";
    args: ScorePriorityArgs;
    result: { priority: Priority; reasons: string[] };
  };
}

export type ToolCallRequester = (
  email: RawInboundEmail,
  envelope: DeterministicEnvelope,
) => Promise<RequestedToolCall | null>;

function compact(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function normalizedSubject(value: string) {
  return value
    .toLowerCase()
    .replace(/^\s*((re|fw|fwd)\s*:\s*)+/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set([
  "about", "after", "again", "before", "from", "have", "into", "please",
  "that", "their", "there", "these", "this", "those", "through", "within",
  "with", "your",
]);

function contentTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length >= 4 && !STOP_WORDS.has(token)),
  );
}

function containmentOverlap(left: Set<string>, right: Set<string>) {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;
  if (smaller.size === 0) return 0;
  let matches = 0;
  for (const token of smaller) if (larger.has(token)) matches += 1;
  return matches / smaller.size;
}

function findDuplicate(email: RawInboundEmail, inbound: RawInboundEmail[]) {
  const timestamp = Date.parse(email.sent_at);
  const subject = normalizedSubject(email.subject);
  const bodyTokens = contentTokens(email.body);

  return inbound
    .filter((candidate) => candidate.id !== email.id)
    .filter((candidate) => candidate.from_email === email.from_email)
    .filter((candidate) => normalizedSubject(candidate.subject) === subject)
    .filter((candidate) => {
      const candidateTime = Date.parse(candidate.sent_at);
      return candidateTime < timestamp && timestamp - candidateTime <= 5 * 60 * 1000;
    })
    .filter((candidate) => containmentOverlap(bodyTokens, contentTokens(candidate.body)) >= 0.3)
    .sort((a, b) => Date.parse(a.sent_at) - Date.parse(b.sent_at))[0]?.id ?? null;
}

function findRequestedClient(
  email: RawInboundEmail,
  actorClientId: string | null,
  context: FixtureContext,
) {
  const content = compact(`${email.subject} ${email.body}`);
  const matches = context.clients.filter((client) =>
    client.aliases.some((alias) => alias.length >= 5 && content.includes(alias)),
  );
  return matches.find((client) => client.id !== actorClientId)?.id
    ?? matches.find((client) => client.id === actorClientId)?.id
    ?? actorClientId;
}

function securityReasons(email: RawInboundEmail) {
  const content = `${email.subject}\n${email.body}`.toLowerCase();
  const reasons: string[] = [];
  if (/ignore (all|any|the) previous instructions|override (all|the) instructions/.test(content)) {
    reasons.push("Prompt-injection instruction detected");
  }
  if (/(send|share|reveal|export)[\s\S]{0,80}(password|credential|api key|auth token|contract file)/.test(content)) {
    reasons.push("Credential or protected-file disclosure request detected");
  }
  return reasons;
}

export function buildDeterministicEnvelope(
  email: RawInboundEmail,
  inbound: RawInboundEmail[],
  context: FixtureContext,
): DeterministicEnvelope {
  const actorClientId = context.contactClientByEmail.get(email.from_email) ?? null;
  const requestedClientId = findRequestedClient(email, actorClientId, context);
  const crossAccount = Boolean(
    actorClientId && requestedClientId && actorClientId !== requestedClientId,
  );
  const duplicateOf = findDuplicate(email, inbound);
  const security = securityReasons(email);
  const priorityRecord = actorClientId ? context.priorityByClientId.get(actorClientId) : undefined;

  if (security.length > 0) {
    return {
      emailId: email.id,
      actorClientId,
      requestedClientId,
      crossAccount,
      duplicateOf,
      outcome: "quarantine",
      priority: null,
      reasons: security,
    };
  }
  if (crossAccount) {
    return {
      emailId: email.id,
      actorClientId,
      requestedClientId,
      crossAccount,
      duplicateOf,
      outcome: "rejected",
      priority: null,
      reasons: ["Cross-account identity and permission mismatch"],
    };
  }
  if (duplicateOf) {
    return {
      emailId: email.id,
      actorClientId,
      requestedClientId,
      crossAccount,
      duplicateOf,
      outcome: "duplicate",
      priority: null,
      reasons: [`Matches earlier inbound ${duplicateOf}`],
    };
  }
  if (!actorClientId || !priorityRecord) {
    return {
      emailId: email.id,
      actorClientId,
      requestedClientId,
      crossAccount,
      duplicateOf,
      outcome: "human_review",
      priority: null,
      reasons: ["Sender identity or deterministic priority context is unavailable"],
    };
  }
  return {
    emailId: email.id,
    actorClientId,
    requestedClientId,
    crossAccount,
    duplicateOf,
    outcome: "queued",
    priority: priorityRecord.priority,
    reasons: [priorityRecord.reason],
  };
}

function parseScorePriorityArgs(value: unknown): ScorePriorityArgs {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid score_priority arguments");
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.summary !== "string"
    || candidate.summary.trim() === ""
    || typeof candidate.intent !== "string"
    || candidate.intent.trim() === ""
    || !Array.isArray(candidate.urgency_mentions)
    || !candidate.urgency_mentions.every((item) => typeof item === "string")
  ) {
    throw new Error("Invalid score_priority arguments");
  }
  return {
    summary: candidate.summary,
    intent: candidate.intent,
    urgency_mentions: candidate.urgency_mentions,
  };
}

function withoutToolCall(envelope: DeterministicEnvelope): TriageResult {
  return {
    email_id: envelope.emailId,
    actor_client_id: envelope.actorClientId,
    requested_client_id: envelope.requestedClientId,
    outcome: envelope.outcome,
    priority: envelope.priority,
    duplicate_of: envelope.duplicateOf,
    reasons: envelope.reasons,
    external_write: false,
    tool_call: null,
  };
}

export async function processEmailTriage(
  email: RawInboundEmail,
  inbound: RawInboundEmail[],
  context: FixtureContext,
  requestToolCall: ToolCallRequester,
): Promise<TriageResult> {
  const envelope = buildDeterministicEnvelope(email, inbound, context);
  if (envelope.outcome !== "queued") return withoutToolCall(envelope);

  const requestedCall = await requestToolCall(email, envelope);
  if (!requestedCall || requestedCall.name !== "score_priority") {
    throw new Error("Gemini did not request score_priority");
  }
  const args = parseScorePriorityArgs(requestedCall.args);
  if (!envelope.priority) throw new Error("Deterministic priority is unavailable");

  return {
    ...withoutToolCall(envelope),
    tool_call: {
      name: "score_priority",
      args,
      result: { priority: envelope.priority, reasons: envelope.reasons },
    },
  };
}
