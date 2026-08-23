import fs from "node:fs";
import path from "node:path";

import { parse } from "csv-parse/sync";

export interface RawInboundEmail {
  id: string;
  from_email: string;
  subject: string;
  body: string;
  sent_at: string;
}

interface ClientRow {
  client_id: string;
  name: string;
  access_group: string;
}

interface ContactRow {
  client_id: string;
  email: string;
}

interface PortfolioIncident {
  id: string;
  expectedPriority: "P0" | "P1" | "P2";
  expectedReason: string;
}

interface GeneratedPortfolio {
  incidents: PortfolioIncident[];
}

export interface FixtureClient {
  id: string;
  name: string;
  accessGroup: string;
  aliases: string[];
}

export interface FixtureContext {
  clients: FixtureClient[];
  contactClientByEmail: Map<string, string>;
  priorityByClientId: Map<string, { priority: "P0" | "P1" | "P2"; reason: string }>;
}

function readCsv<T>(filePath: string): T[] {
  return parse(fs.readFileSync(filePath, "utf8"), {
    columns: true,
    skip_empty_lines: true,
  }) as T[];
}

function requireValue(row: Record<string, string>, key: string, rowNumber: number) {
  const value = row[key]?.trim();
  if (!value) throw new Error(`Inbound row ${rowNumber} is missing ${key}`);
  return value;
}

function normalizeAlias(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function emailDomainAlias(email: string) {
  const domain = email.toLowerCase().split("@")[1] ?? "";
  return normalizeAlias(domain.split(".")[0] ?? "");
}

export function loadRawInbound(repoRoot: string): RawInboundEmail[] {
  const filePath = path.join(repoRoot, "fixtures/verge-demo-pack/data/emails.csv");
  const rows = readCsv<Record<string, string>>(filePath);

  return rows.map((row, index) => ({
    id: requireValue(row, "email_id", index + 2),
    from_email: requireValue(row, "from_email", index + 2).toLowerCase(),
    subject: requireValue(row, "subject", index + 2),
    body: requireValue(row, "body", index + 2),
    sent_at: requireValue(row, "sent_at", index + 2),
  }));
}

export function loadFixtureContext(repoRoot: string): FixtureContext {
  const dataRoot = path.join(repoRoot, "fixtures/verge-demo-pack/data");
  const clients = readCsv<ClientRow>(path.join(dataRoot, "clients.csv"));
  const contacts = readCsv<ContactRow>(path.join(dataRoot, "contacts.csv"));
  const portfolio = JSON.parse(
    fs.readFileSync(path.join(repoRoot, "lib/contextops/generated/portfolio.json"), "utf8"),
  ) as GeneratedPortfolio;

  const domainsByClient = new Map<string, Set<string>>();
  const contactClientByEmail = new Map<string, string>();
  for (const contact of contacts) {
    const email = contact.email.trim().toLowerCase();
    contactClientByEmail.set(email, contact.client_id);
    const aliases = domainsByClient.get(contact.client_id) ?? new Set<string>();
    const domainAlias = emailDomainAlias(email);
    if (domainAlias) aliases.add(domainAlias);
    domainsByClient.set(contact.client_id, aliases);
  }

  return {
    clients: clients.map((client) => ({
      id: client.client_id,
      name: client.name,
      accessGroup: client.access_group,
      aliases: [
        normalizeAlias(client.name),
        ...(domainsByClient.get(client.client_id) ?? []),
      ].filter(Boolean),
    })),
    contactClientByEmail,
    priorityByClientId: new Map(
      portfolio.incidents.map((incident) => [
        incident.id,
        { priority: incident.expectedPriority, reason: incident.expectedReason },
      ]),
    ),
  };
}

export function resolveRepoRoot(startDirectory = process.cwd()) {
  const candidates = [startDirectory, path.resolve(startDirectory, "..")];
  const match = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "fixtures/verge-demo-pack/data/emails.csv")),
  );
  if (!match) {
    throw new Error("Unable to locate the Verge repository root from the current directory");
  }
  return match;
}
