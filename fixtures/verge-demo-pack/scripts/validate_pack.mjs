import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2] || '.');
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const parseCsv = (p) => {
  const text = fs.readFileSync(path.join(root,p),'utf8').trim();
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += ch;
  }
  row.push(field.replace(/\r$/, '')); rows.push(row);
  const headers = rows.shift();
  return rows.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries(headers.map((h,i) => [h,r[i] ?? ''])));
};
const unique = (rows, key, errors) => {
  const seen = new Set();
  for (const row of rows) {
    if (!row[key]) errors.push(`Missing ${key}`);
    if (seen.has(row[key])) errors.push(`Duplicate ${key}: ${row[key]}`);
    seen.add(row[key]);
  }
  return seen;
};
const manifest = readJson('demo_manifest.json');
const evals = readJson('scenarios/eval_scenarios.json');
const packet = readJson('scenarios/context_packets/flagship_context_packet.json');
const expected = readJson('scenarios/flagship_monday_capacity_crisis.json');
const staff = parseCsv('data/staff.csv');
const clients = parseCsv('data/clients.csv');
const contacts = parseCsv('data/contacts.csv');
const projects = parseCsv('data/projects.csv');
const emails = parseCsv('data/emails.csv');
const tickets = parseCsv('data/tickets.csv');
const events = parseCsv('data/calendar_events.csv');
const knowledge = parseCsv('data/knowledge_index.csv');
const errors = [];
if (manifest.counts.clients !== 7) errors.push('Expected exactly 7 clients');
if (manifest.counts.staff !== 10) errors.push('Expected exactly 10 staff');
if (manifest.counts.emails < 30) errors.push('Expected at least 30 emails');
if (evals.length !== 25) errors.push('Expected exactly 25 eval scenarios');
if (packet.external_write !== false) errors.push('Flagship packet must disable external writes');
if (evals.some((e) => e.external_write !== false)) errors.push('Every eval must disable external writes');
const staffIds = unique(staff, 'staff_id', errors);
const clientIds = unique(clients, 'client_id', errors);
const contactIds = unique(contacts, 'contact_id', errors);
const projectIds = unique(projects, 'project_id', errors);
unique(emails, 'email_id', errors);
unique(tickets, 'ticket_id', errors);
unique(events, 'event_id', errors);
for (const s of staff) if (s.manager_id && !staffIds.has(s.manager_id)) errors.push(`Unknown manager ${s.manager_id}`);
for (const c of clients) if (!staffIds.has(c.account_manager_id)) errors.push(`Unknown account manager ${c.account_manager_id}`);
for (const c of contacts) if (!clientIds.has(c.client_id)) errors.push(`Unknown contact client ${c.client_id}`);
for (const p of projects) {
  if (p.client_id !== 'INTERNAL' && !clientIds.has(p.client_id)) errors.push(`Unknown project client ${p.client_id}`);
  if (!staffIds.has(p.lead_staff_id)) errors.push(`Unknown project lead ${p.lead_staff_id}`);
}
for (const e of emails) {
  if (e.client_id !== 'INTERNAL' && !clientIds.has(e.client_id)) errors.push(`Unknown email client ${e.email_id}:${e.client_id}`);
  if (e.project_id && !projectIds.has(e.project_id)) errors.push(`Unknown email project ${e.email_id}:${e.project_id}`);
  if (!e.from_email.endsWith('.example')) errors.push(`Non-demo email domain ${e.email_id}`);
}
for (const t of tickets) {
  if (t.client_id !== 'INTERNAL' && !clientIds.has(t.client_id)) errors.push(`Unknown ticket client ${t.ticket_id}`);
  if (!projectIds.has(t.project_id)) errors.push(`Unknown ticket project ${t.ticket_id}`);
  if (t.owner_staff_id && !staffIds.has(t.owner_staff_id)) errors.push(`Unknown ticket owner ${t.ticket_id}`);
}
for (const e of events) {
  if (e.client_id !== 'INTERNAL' && !clientIds.has(e.client_id)) errors.push(`Unknown event client ${e.event_id}`);
  if (!projectIds.has(e.project_id)) errors.push(`Unknown event project ${e.event_id}`);
  if (!staffIds.has(e.owner_staff_id)) errors.push(`Unknown event owner ${e.event_id}`);
}
const alex = contacts.filter((c) => c.name === 'Alex Morgan');
if (alex.length !== 2 || new Set(alex.map((c) => c.client_id)).size !== 2) errors.push('Same-name identity test is not configured correctly');
if (!knowledge.some((k) => k.version === '3' && k.status === 'active')) errors.push('Active SLA policy v3 missing');
if (!knowledge.some((k) => k.version === '2' && k.status === 'archived')) errors.push('Archived SLA policy v2 missing');
const priorities = Object.fromEntries(expected.expected_priorities.map((p) => [p.client_id,p.priority]));
for (const [id,priority] of Object.entries({'CL-BH':'P0','CL-EL':'P0','CL-MH':'P1','CL-LP':'P2','INTERNAL':'P2'})) {
  if (priorities[id] !== priority) errors.push(`Unexpected flagship priority for ${id}`);
}
const allText = fs.readdirSync(root,{recursive:true}).filter((p) => typeof p === 'string' && p.endsWith('.json')).map((p) => fs.readFileSync(path.join(root,p),'utf8')).join('\n');
if (/"external_write"\s*:\s*true/.test(allText)) errors.push('Found external_write=true');
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log('VALID: Verge Consulting demo pack');
console.log(JSON.stringify(manifest.counts));
console.log(`REFERENCES: staff=${staffIds.size}, clients=${clientIds.size}, contacts=${contactIds.size}, projects=${projectIds.size}`);
console.log('SAFETY: all demo email domains and external_write controls passed');
