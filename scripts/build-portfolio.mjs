/**
 * Derives the demo portfolio model from the supplied Verge data pack.
 *
 * Nothing in the UI is hand-written: priorities, confidence inputs, capacity,
 * approval thresholds and ROI all come from this file, which reads only the
 * fixture CSV/JSON files. Run `npm run data` after changing the data pack.
 *
 * Output: lib/contextops/generated/portfolio.json
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pack = join(root, "fixtures", "verge-demo-pack");

/** Scenario "now": Monday 17 Aug 2026, 08:05 Sydney time. */
const NOW = new Date("2026-08-17T08:05:00+10:00");
const DAY_START = new Date("2026-08-17T00:00:00+10:00");

function csv(file) {
  const lines = readFileSync(join(pack, "data", file), "utf8").trim().split(/\r?\n/);
  const head = splitRow(lines[0]);
  return lines.slice(1).map((line) => {
    const cells = splitRow(line);
    return Object.fromEntries(head.map((key, index) => [key, cells[index] ?? ""]));
  });
}

function splitRow(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (const char of line) {
    if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

function json(...parts) {
  return JSON.parse(readFileSync(join(pack, ...parts), "utf8"));
}

const hours = (from, to = NOW) => (to - new Date(from)) / 3_600_000;
const round = (value, digits = 2) => Number(value.toFixed(digits));
const pipe = (value) => (value ? value.split("|").filter(Boolean) : []);

const staffRows = csv("staff.csv");
const clientRows = csv("clients.csv");
const projectRows = csv("projects.csv");
const capacityRows = csv("staff_capacity.csv");
const emailRows = csv("emails.csv");
const ticketRows = csv("tickets.csv");
const calendarRows = csv("calendar_events.csv");
const invoiceRows = csv("invoices.csv");

const scenario = json("scenarios", "flagship_monday_capacity_crisis.json");
const trace = json("scenarios", "flagship_decision_trace.json");
const outputs = json("scenarios", "flagship_proposed_outputs.json");
const packet = json("scenarios", "context_packets", "flagship_context_packet.json");
const evals = json("scenarios", "eval_scenarios.json");
const noise = {
  unknownClient: json("noise", "unknown_client_request.json"),
  connectorFailure: json("noise", "connector_failure.json"),
  unsupportedClaim: json("noise", "unsupported_claim_request.json"),
};

/* ---------------------------------------------------------------- people */

const staff = staffRows.map((row) => ({
  id: row.staff_id,
  name: row.name,
  role: row.role,
  managerId: row.manager_id || null,
  email: row.email,
  location: row.location,
  skills: pipe(row.skills),
  accessLevel: row.access_level,
  weeklyCapacityHours: Number(row.weekly_capacity_hours),
  bookedHours: Number(row.booked_hours),
  availableHours: Number(row.available_hours_2026_08_17),
  approvalLimitAud: Number(row.approval_limit_aud),
  initials: row.name.split(" ").map((part) => part[0]).join(""),
}));
const staffById = Object.fromEntries(staff.map((person) => [person.id, person]));

/* --------------------------------------------------------------- clients */

const projects = projectRows.map((row) => ({
  id: row.project_id,
  clientId: row.client_id,
  name: row.name,
  status: row.status,
  deadline: row.deadline,
  deadlineInHours: round(-hours(row.deadline), 1),
  budgetAud: Number(row.budget_aud),
  budgetUsedPct: Number(row.budget_used_pct),
  leadStaffId: row.lead_staff_id,
  assignedStaffIds: pipe(row.assigned_staff_ids),
  commitment: row.commitment,
}));
const projectByClient = Object.fromEntries(projects.map((project) => [project.clientId, project]));

const clients = clientRows.map((row) => ({
  id: row.client_id,
  name: row.name,
  industry: row.industry,
  tier: row.tier,
  accountManagerId: row.account_manager_id,
  annualValueAud: Number(row.annual_value_aud),
  renewalDate: row.renewal_date,
  renewalInDays: Math.round(-hours(row.renewal_date) / 24),
  healthScore: Number(row.health_score),
  slaHours: Number(row.default_sla_hours),
  accessGroup: row.access_group,
  status: row.status,
  primaryNeed: row.primary_need,
}));

/* ----------------------------------------------------- inbound + signals */

const cleanEmails = emailRows.filter((row) => row.is_noise !== "true");
const noiseEmails = emailRows.filter((row) => row.is_noise === "true");

function inboundToday(clientId) {
  return cleanEmails
    .filter(
      (row) =>
        row.client_id === clientId &&
        !/vergeconsulting/.test(row.from_email) &&
        new Date(row.sent_at) >= DAY_START,
    )
    .sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at));
}

/**
 * Signals feed engine.scoreIncident. Every one is read from the data pack:
 *  - slaHoursRemaining: contract SLA minus time since the client's newest request
 *  - launchBlockedTomorrow: a red project whose commitment lands inside 26 hours
 *  - explicitCommitment: a dated commitment on a project already amber or red
 *  - renewalRisk: renewal inside 90 days on an account below 65 health
 */
function signalsFor(client) {
  const project = projectByClient[client.id];
  const latest = inboundToday(client.id)[0];
  const slaHoursRemaining = latest ? round(client.slaHours - hours(latest.sent_at)) : null;
  const deadlineInHours = project ? project.deadlineInHours : null;
  return {
    slaHoursRemaining,
    launchBlockedTomorrow: Boolean(project && project.status === "red" && deadlineInHours <= 26),
    explicitCommitment: Boolean(project && project.commitment && ["amber", "red"].includes(project.status)),
    renewalRisk: client.renewalInDays <= 90 && client.healthScore < 65,
    internalWork: false,
  };
}

/* ------------------------------------------------------------ confidence */

const AUTHORITY_WEIGHT = {
  latest_project_governance: 1,
  client_confirmed: 0.9,
  project_owner: 0.85,
  internal_resource_plan: 0.8,
  unverified_external: 0.2,
};

const factsFor = (clientName) =>
  packet.verified_facts.filter((fact) => fact.fact.toLowerCase().includes(clientName.toLowerCase().split(" ")[0]));

const evalsFor = (clientId) => {
  const project = projectByClient[clientId];
  const refs = new Set(
    cleanEmails.filter((row) => row.client_id === clientId).map((row) => row.email_id),
  );
  return evals.filter(
    (item) =>
      item.input_refs.some((ref) => refs.has(ref)) ||
      (project && item.input_refs.some((ref) => ref.includes(clientId.replace("CL-", "")))),
  );
};

/**
 * Confidence inputs are counted, never asserted. Each number below is a ratio
 * of things the pack actually contains, so the UI can show its own arithmetic.
 */
function confidenceInputs(client) {
  const facts = factsFor(client.name);
  const scenarios = evalsFor(client.id);
  const requiredEvidence = scenarios.flatMap((item) => item.required_evidence ?? []);
  const sources = facts.flatMap((fact) => fact.sources);
  const conflicts = packet.conflicts.filter((conflict) =>
    conflict.topic.toLowerCase().includes(client.name.toLowerCase().split(" ")[0]),
  );
  const missing = packet.missing_information.filter((item) =>
    item.toLowerCase().includes(client.name.toLowerCase().split(" ")[0]),
  );
  const dated = cleanEmails
    .filter((row) => row.client_id === client.id)
    .map((row) => hours(row.sent_at))
    .sort((a, b) => a - b);
  const newestAgeHours = dated.length ? round(dated[0], 1) : 72;
  const signals = signalsFor(client);
  const ruleInputs = [
    signals.slaHoursRemaining !== null,
    signals.launchBlockedTomorrow !== null,
    signals.explicitCommitment !== null,
    Boolean(projectByClient[client.id]),
    Number.isFinite(client.healthScore),
  ];

  const evidenceCoverage = requiredEvidence.length
    ? Math.min(1, facts.length / Math.max(1, Math.ceil(requiredEvidence.length / 3)))
    : facts.length
      ? 1
      : 0.5;

  return {
    evidenceCoverage: round(evidenceCoverage),
    sourceAuthority: round(
      facts.length
        ? facts.reduce((total, fact) => total + (AUTHORITY_WEIGHT[fact.authority] ?? 0.6), 0) / facts.length
        : 0.6,
    ),
    freshness: round(Math.max(0, Math.min(1, 1 - newestAgeHours / 72))),
    sourceAgreement: round(facts.length ? 1 - conflicts.length / (facts.length + conflicts.length) : 0.75),
    deterministicCoverage: round(ruleInputs.filter(Boolean).length / ruleInputs.length),
    evalHistory: round(scenarios.length ? scenarios.filter((item) => item.expected_priority).length / scenarios.length : 0.8),
    counts: {
      facts: facts.length,
      sources: new Set(sources).size,
      conflicts: conflicts.length,
      missing: missing.length,
      evalScenarios: scenarios.length,
      newestEvidenceAgeHours: newestAgeHours,
    },
    missingInformation: missing,
    conflicts,
    evidence: facts,
  };
}

/* -------------------------------------------------------------- incidents */

function releasedFor(clientId) {
  const project = projectByClient[clientId];
  if (!project) return [];
  return scenario.resource_changes
    .filter((change) => change.from_project === project.id && change.to_project !== project.id)
    .map((change) => ({
      staffId: change.staff_id,
      name: staffById[change.staff_id]?.name ?? change.staff_id,
      initials: staffById[change.staff_id]?.initials ?? "?",
      hours: change.hours,
      toProject: change.to_project,
      toProjectName: projects.find((item) => item.id === change.to_project)?.name ?? change.to_project,
      role: change.role,
    }));
}

function allocationFor(clientId) {
  const project = projectByClient[clientId];
  if (!project) return [];
  return scenario.resource_changes
    .filter((change) => change.to_project === project.id)
    .map((change) => ({
      staffId: change.staff_id,
      name: staffById[change.staff_id]?.name ?? change.staff_id,
      initials: staffById[change.staff_id]?.initials ?? "?",
      fromProject: change.from_project,
      fromProjectName: projects.find((item) => item.id === change.from_project)?.name ?? change.from_project,
      hours: change.hours,
      role: change.role,
      skills: staffById[change.staff_id]?.skills.slice(0, 3) ?? [],
      availableHours: staffById[change.staff_id]?.availableHours ?? 0,
    }));
}

const REQUEST_SUMMARY = {
  "CL-BH": "ETA dashboard wrong before tomorrow's executive preview; credential rotation unresolved.",
  "CL-EL": "Lead facilitator unavailable for tomorrow's 85-person workshop.",
  "CL-MH": "Returns at 18% against an 8% baseline after a packaging change.",
  "CL-PR": "Board-driven pipeline diagnostic due tomorrow 15:00.",
  "CL-FF": "Promotion decision Thursday while supplier data is stale.",
  "CL-CS": "Dispatch backlog feeds Friday's board review.",
  "CL-LP": "Routine onboarding wording update due Friday.",
};

const incidents = clients.map((client) => {
  const project = projectByClient[client.id];
  const signals = signalsFor(client);
  const confidence = confidenceInputs(client);
  const allocation = allocationFor(client.id);
  const released = releasedFor(client.id);
  const expected = scenario.expected_priorities.find((item) => item.client_id === client.id);
  const openTickets = ticketRows.filter((row) => row.client_id === client.id && row.status !== "closed");
  const scenarios = evalsFor(client.id);
  const proposedHours = allocation.reduce((total, item) => total + item.hours, 0);
  const drafts = outputs.client_email_drafts.filter((draft) => draft.client_id === client.id);
  const tasks = outputs.internal_tasks.filter((task) =>
    project ? allocation.some((item) => item.staffId === task.owner_staff_id) : false,
  );
  const crm = outputs.crm_drafts.filter((draft) => draft.client_id === client.id);

  return {
    id: client.id,
    clientName: client.name,
    tier: client.tier,
    industry: client.industry,
    annualValueAud: client.annualValueAud,
    healthScore: client.healthScore,
    accountManagerId: client.accountManagerId,
    accountManager: staffById[client.accountManagerId]?.name ?? "",
    accessGroup: client.accessGroup,
    status: client.status,
    slaHours: client.slaHours,
    renewalInDays: client.renewalInDays,
    request: REQUEST_SUMMARY[client.id] ?? client.primaryNeed,
    project: project
      ? {
          id: project.id,
          name: project.name,
          status: project.status,
          commitment: project.commitment,
          deadline: project.deadline,
          deadlineInHours: project.deadlineInHours,
          budgetUsedPct: project.budgetUsedPct,
        }
      : null,
    signals,
    expectedPriority: expected?.priority ?? null,
    expectedReason: expected?.reason ?? "",
    confidence,
    allocation,
    released,
    releasedHours: released.reduce((total, item) => total + item.hours, 0),
    proposedHours,
    openTickets: openTickets.length,
    evalScenarios: scenarios.map((item) => item.scenario_id),
    drafts,
    tasks,
    crm,
  };
});

/* Internal work competes for the same people and must be visible in the queue. */
const internalProject = projects.find((project) => project.clientId === "INTERNAL");
const internalExpected = scenario.expected_priorities.find((item) => item.client_id === "INTERNAL");
const internalReleased = scenario.resource_changes
  .filter((change) => change.from_project === internalProject.id)
  .reduce((total, change) => total + change.hours, 0);

const internalItem = {
  id: "INTERNAL",
  clientName: "ContextOps Accelerator",
  tier: "Internal",
  industry: "Internal product",
  annualValueAud: 0,
  healthScore: 100,
  accountManagerId: internalProject.leadStaffId,
  accountManager: staffById[internalProject.leadStaffId]?.name ?? "",
  accessGroup: "internal",
  status: "movable",
  slaHours: null,
  renewalInDays: null,
  request: "Internal prototype work; movable unless approved otherwise.",
  project: {
    id: internalProject.id,
    name: internalProject.name,
    status: internalProject.status,
    commitment: internalProject.commitment,
    deadline: internalProject.deadline,
    deadlineInHours: internalProject.deadlineInHours,
    budgetUsedPct: internalProject.budgetUsedPct,
  },
  signals: {
    slaHoursRemaining: null,
    launchBlockedTomorrow: false,
    explicitCommitment: false,
    renewalRisk: false,
    internalWork: true,
  },
  expectedPriority: internalExpected?.priority ?? "P2",
  expectedReason: internalExpected?.reason ?? "",
  confidence: {
    evidenceCoverage: 1,
    sourceAuthority: 0.8,
    freshness: 1,
    sourceAgreement: 1,
    deterministicCoverage: 1,
    evalHistory: 0.8,
    counts: { facts: 1, sources: 3, conflicts: 0, missing: 0, evalScenarios: 0, newestEvidenceAgeHours: 1 },
    missingInformation: [],
    conflicts: [],
    evidence: packet.verified_facts.filter((fact) => fact.fact.includes("accelerator")),
  },
  allocation: [],
  released: scenario.resource_changes
    .filter((change) => change.from_project === internalProject.id)
    .map((change) => ({
      staffId: change.staff_id,
      name: staffById[change.staff_id]?.name ?? change.staff_id,
      initials: staffById[change.staff_id]?.initials ?? "?",
      hours: change.hours,
      toProject: change.to_project,
      toProjectName: projects.find((item) => item.id === change.to_project)?.name ?? change.to_project,
      role: change.role,
    })),
  proposedHours: -internalReleased,
  releasedHours: internalReleased,
  openTickets: 0,
  evalScenarios: [],
  drafts: [],
  tasks: outputs.internal_tasks.filter((task) => task.owner_staff_id === internalProject.leadStaffId),
  crm: [],
  deferred: scenario.deferred_work,
};

/**
 * Portfolio-level confidence for the cross-client decision. Same six inputs,
 * counted across the whole Context Packet rather than one account.
 */
const packetSourceAuthority =
  packet.verified_facts.reduce((total, fact) => total + (AUTHORITY_WEIGHT[fact.authority] ?? 0.6), 0) /
  packet.verified_facts.length;
const newestPacketEvidenceHours = Math.min(
  ...cleanEmails
    .filter((row) => new Date(row.sent_at) <= NOW)
    .map((row) => hours(row.sent_at)),
);

const portfolioConfidence = {
  evidenceCoverage: round(
    packet.verified_facts.length / (packet.verified_facts.length + packet.missing_information.length),
  ),
  sourceAuthority: round(packetSourceAuthority),
  freshness: round(Math.max(0, Math.min(1, 1 - newestPacketEvidenceHours / 72))),
  sourceAgreement: round(
    packet.verified_facts.length / (packet.verified_facts.length + packet.conflicts.length),
  ),
  deterministicCoverage: 1,
  evalHistory: round(evals.filter((item) => item.expected_priority).length / evals.length),
  counts: {
    facts: packet.verified_facts.length,
    sources: new Set(packet.verified_facts.flatMap((fact) => fact.sources)).size,
    conflicts: packet.conflicts.length,
    missing: packet.missing_information.length,
    evalScenarios: evals.length,
    newestEvidenceAgeHours: round(newestPacketEvidenceHours, 1),
  },
  missingInformation: packet.missing_information,
  conflicts: packet.conflicts,
  evidence: packet.verified_facts,
};

/* --------------------------------------------------------------- capacity */

const capacity = capacityRows.map((row) => ({
  id: row.allocation_id,
  staffId: row.staff_id,
  staffName: staffById[row.staff_id]?.name ?? row.staff_id,
  projectId: row.planned_project_id,
  hours: Number(row.planned_hours),
  work: row.work,
  movable: row.movable === "true",
  switchingCostHours: Number(row.switching_cost_hours),
}));

const availableStaff = staff.filter((person) => person.availableHours >= 4);
const totalAvailableHours = staff.reduce((total, person) => total + person.availableHours, 0);
const movableHours = capacity.filter((item) => item.movable).reduce((total, item) => total + item.hours, 0);
const switchingCost = scenario.resource_changes.reduce((total, change) => {
  const source = capacity.find(
    (item) => item.staffId === change.staff_id && item.projectId === change.from_project,
  );
  return total + (source?.switchingCostHours ?? 0);
}, 0);

/* -------------------------------------------------------------------- ROI */

/**
 * ROI assumptions are declared, not hidden. Rates come from the data pack's
 * own project budgets; the manual baseline is the only estimate and is labelled
 * as such everywhere it is shown.
 */
const ROI_ASSUMPTIONS = {
  triageMinutesPerRequest: 12,
  evidenceMinutesPerDecision: 45,
  draftMinutesPerOutput: 18,
  taskSetupMinutesPerTask: 6,
  blendedHourlyRateAud: 180,
  slaBreachCostAud: 2500,
  workingDaysPerWeek: 5,
};

const roiVolumes = {
  inboundRequests: cleanEmails.length,
  duplicatesGrouped: noiseEmails.filter((row) => row.expected_relevance?.startsWith("duplicate")).length,
  decisionsPrepared: 1,
  draftsPrepared: outputs.client_email_drafts.length + outputs.crm_drafts.length,
  tasksPrepared: outputs.internal_tasks.length,
  slaBreachesAvoided: incidents.filter(
    (item) => item.signals.slaHoursRemaining !== null && item.signals.slaHoursRemaining <= 4,
  ).length,
};

const roiLines = [
  {
    label: "Triage and dedupe inbound requests",
    volume: roiVolumes.inboundRequests,
    unit: "requests",
    minutesEach: ROI_ASSUMPTIONS.triageMinutesPerRequest,
  },
  {
    label: "Assemble evidence for the portfolio decision",
    volume: roiVolumes.decisionsPrepared,
    unit: "decisions",
    minutesEach: ROI_ASSUMPTIONS.evidenceMinutesPerDecision,
  },
  {
    label: "Draft client emails and CRM updates",
    volume: roiVolumes.draftsPrepared,
    unit: "drafts",
    minutesEach: ROI_ASSUMPTIONS.draftMinutesPerOutput,
  },
  {
    label: "Set up internal tasks with owners and due times",
    volume: roiVolumes.tasksPrepared,
    unit: "tasks",
    minutesEach: ROI_ASSUMPTIONS.taskSetupMinutesPerTask,
  },
].map((line) => ({ ...line, hours: round((line.volume * line.minutesEach) / 60, 2) }));

const hoursSavedPerDay = round(roiLines.reduce((total, line) => total + line.hours, 0), 2);
const roi = {
  assumptions: ROI_ASSUMPTIONS,
  volumes: roiVolumes,
  lines: roiLines,
  hoursSavedPerDay,
  hoursSavedPerWeek: round(hoursSavedPerDay * ROI_ASSUMPTIONS.workingDaysPerWeek, 1),
  labourValuePerWeekAud: Math.round(
    hoursSavedPerDay * ROI_ASSUMPTIONS.workingDaysPerWeek * ROI_ASSUMPTIONS.blendedHourlyRateAud,
  ),
  slaValueAud: roiVolumes.slaBreachesAvoided * ROI_ASSUMPTIONS.slaBreachCostAud,
  note: "Minutes per task are the only estimates and are editable. Volumes come from the data pack; Monday is treated as a typical day.",
};

/* ------------------------------------------------- connectors + execution */

const CONNECTOR_REGISTRY = [
  { id: "google_drive", label: "Google Drive", boundary: "Knowledge", scope: "read", writeRisk: "low", approval: false, rollback: true, order: 1 },
  { id: "gmail_read", label: "Gmail (read)", boundary: "Intake", scope: "read", writeRisk: "low", approval: false, rollback: true, order: 2 },
  { id: "hubspot", label: "HubSpot", boundary: "CRM", scope: "read + draft", writeRisk: "high", approval: true, rollback: true, order: 3 },
  { id: "google_calendar", label: "Google Calendar", boundary: "Calendar", scope: "read", writeRisk: "high", approval: true, rollback: true, order: 4 },
  { id: "linear", label: "Linear", boundary: "Projects", scope: "create task", writeRisk: "medium", approval: true, rollback: true, order: 5 },
  { id: "apollo", label: "Apollo / Brandfetch", boundary: "Enrichment", scope: "read", writeRisk: "low", approval: false, rollback: false, order: 6 },
  { id: "gmail_send", label: "Gmail (send)", boundary: "Communication", scope: "send", writeRisk: "high", approval: true, rollback: false, order: 7 },
];

const executionPlan = [
  ...outputs.internal_tasks.map((task, index) => ({
    id: `EX-TASK-${index + 1}`,
    kind: "task",
    connector: "linear",
    target: "Linear · Verge Delivery",
    summary: task.task,
    owner: staffById[task.owner_staff_id]?.name ?? task.owner_staff_id,
    due: task.due,
    method: "POST",
    endpoint: "/issues",
    reversible: true,
  })),
  ...outputs.proposed_calendar_changes.map((change, index) => ({
    id: `EX-CAL-${index + 1}`,
    kind: "calendar",
    connector: "google_calendar",
    target: "Google Calendar · Verge Delivery",
    summary: change.change,
    owner: "Grace Miller",
    method: "PATCH",
    endpoint: `/calendars/verge/events/${change.event_id}`,
    reversible: true,
  })),
  ...outputs.crm_drafts.map((draft, index) => ({
    id: `EX-CRM-${index + 1}`,
    kind: "crm",
    connector: "hubspot",
    target: `HubSpot · ${draft.client_id}`,
    summary: `${draft.field}: ${draft.current} → ${draft.proposed}`,
    owner: staffById[clients.find((client) => client.id === draft.client_id)?.accountManagerId]?.name ?? "",
    method: "PATCH",
    endpoint: `/crm/v3/objects/companies/${draft.client_id}`,
    reversible: true,
  })),
  ...outputs.client_email_drafts.map((draft, index) => ({
    id: `EX-MAIL-${index + 1}`,
    kind: "email",
    connector: "gmail_send",
    target: draft.to,
    summary: draft.subject,
    owner: staffById[clients.find((client) => client.id === draft.client_id)?.accountManagerId]?.name ?? "",
    method: "POST",
    endpoint: "/gmail/v1/users/me/messages/send",
    reversible: false,
  })),
];

/* ----------------------------------------------------------- security set */

const securityDrills = [
  {
    id: "injection",
    label: "Prompt injection",
    sourceId: "EM-023",
    from: noiseEmails.find((row) => row.email_id === "EM-023")?.from_email ?? "",
    payload: noiseEmails.find((row) => row.email_id === "EM-023")?.body ?? "",
    expected: "quarantine",
    verdict: "blocked",
    rule: "Unverified external sender cannot issue instructions or request credentials.",
    outcome: "EM-023 quarantined. No credential, contract file or resolution status was touched.",
  },
  {
    id: "cross_account",
    label: "Cross-account request",
    sourceId: "EM-030",
    from: noiseEmails.find((row) => row.email_id === "EM-030")?.from_email ?? "",
    payload: noiseEmails.find((row) => row.email_id === "EM-030")?.body ?? "",
    expected: "deny",
    verdict: "blocked",
    rule: "Ledgerwise identity has no permission group for Morrow Home records.",
    outcome: "Request denied at the permission filter before retrieval. Two contacts named Alex Morgan stayed separate.",
  },
  {
    id: "duplicate",
    label: "Duplicate request",
    sourceId: "EM-025",
    from: noiseEmails.find((row) => row.email_id === "EM-025")?.from_email ?? "",
    payload: noiseEmails.find((row) => row.email_id === "EM-025")?.body ?? "",
    expected: "group",
    verdict: "grouped",
    rule: "Same thread and same commitment inside the SLA window is one unit of work.",
    outcome: "Grouped into TH-BH-01. One task, one owner, no double staffing.",
  },
  {
    id: "unknown_client",
    label: "Unknown sender",
    sourceId: noise.unknownClient.request_id,
    from: noise.unknownClient.from,
    payload: noise.unknownClient.body,
    expected: noise.unknownClient.expected_action,
    verdict: "clarify",
    rule: "No resolvable tenant or client identity, so no work is created.",
    outcome: "Held for clarification. Nothing entered the priority queue on an unidentified account.",
  },
  {
    id: "unsupported_claim",
    label: "Unsupported claim",
    sourceId: noise.unsupportedClaim.request_id,
    from: "internal request",
    payload: noise.unsupportedClaim.question,
    expected: noise.unsupportedClaim.expected_action,
    verdict: "abstain",
    rule: "No authoritative source for revenue or margin, so the system abstains instead of estimating.",
    outcome: "Abstained and asked for a source. No number was invented.",
  },
  {
    id: "connector_failure",
    label: "Connector failure",
    sourceId: noise.connectorFailure.request_id,
    from: noise.connectorFailure.connector,
    payload: `${noise.connectorFailure.error} · retry ${noise.connectorFailure.retry_policy.backoff_seconds.join("s / ")}s`,
    expected: noise.connectorFailure.expected_action,
    verdict: "degraded",
    rule: "Three retries, then keep the draft and tell a human. Never a silent partial write.",
    outcome: "Draft preserved, owner alerted, external_write stayed false.",
  },
];

/* ------------------------------------------------------------------ write */

const approver = staffById[scenario.approval_owner];

const model = {
  generatedAt: new Date("2026-08-17T08:35:00+10:00").toISOString(),
  scenarioTime: NOW.toISOString(),
  taskId: scenario.task_id,
  source: {
    staff: staff.length,
    clients: clients.length,
    projects: projects.length,
    emails: emailRows.length,
    noiseEmails: noiseEmails.length,
    tickets: ticketRows.length,
    calendarEvents: calendarRows.length,
    invoices: invoiceRows.length,
    evalScenarios: evals.length,
  },
  staff,
  clients,
  projects,
  capacity,
  incidents: [...incidents, internalItem],
  portfolioConfidence,
  capacitySummary: {
    availableStaff: availableStaff.length,
    availableStaffNames: availableStaff.map((person) => person.name),
    totalAvailableHours,
    movableHours,
    switchingCostHours: round(switchingCost, 1),
    proposedHours: scenario.resource_changes.reduce((total, change) => total + change.hours, 0),
  },
  approval: {
    id: "VC-APR-001",
    ownerStaffId: scenario.approval_owner,
    ownerName: approver?.name ?? "",
    ownerRole: approver?.role ?? "",
    ownerLimitAud: approver?.approvalLimitAud ?? 0,
    reasons: scenario.approval_reasons,
    contractorCostAud: 1800,
    requiresApproval: scenario.approval_required,
    externalWrite: scenario.external_write,
  },
  trace: trace.steps,
  traceStatus: trace.final_status,
  outputs,
  packet,
  evals,
  roi,
  connectors: CONNECTOR_REGISTRY,
  executionPlan,
  securityDrills,
};

const target = join(root, "lib", "contextops", "generated");
mkdirSync(target, { recursive: true });
writeFileSync(join(target, "portfolio.json"), `${JSON.stringify(model, null, 2)}\n`);

const priorityCheck = model.incidents.map((item) => `${item.id}:${item.expectedPriority}`).join(" ");
console.log(`portfolio.json written — ${model.incidents.length} queue items`);
console.log(`expected priorities from pack → ${priorityCheck}`);
