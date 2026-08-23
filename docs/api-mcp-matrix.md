# API / MCP Connector Matrix

No connector is active in this demo. Names below are implementation targets, not installed credentials or claimed live integrations.

| Boundary | Demo adapter | Future API / MCP | Authentication | Write risk | Gate |
|---|---|---|---|---|---|
| Intake | local email/form fixtures | Gmail, Outlook, Forms, Slack/Teams, webhook MCP | OAuth/service account | Low–medium | tenant and sender identity |
| CRM | `crm_accounts.json` | HubSpot, Salesforce | OAuth/private app | High | field allow-list + approval |
| Enrichment | local research briefs | Apollo, Brandfetch | API key/OAuth | Read-only | source and cost budget |
| Research | supplied briefs | OpenAI Web Search, Semrush | API key/OAuth | Read-only | citation and recency checks |
| Knowledge | current/archive folders | Google Drive, Notion, SharePoint, Docs MCP | OAuth/service account | Read-only by default | tenant, permission, entity, status, version |
| Calendar | `calendar_events.csv` | Google Calendar, Outlook Calendar | OAuth | High | conflict check + approval |
| Projects | `projects.csv` | Linear, Asana, Monday.com | OAuth | Medium–high | project allow-list + rollback |
| Content | local deterministic drafts | OpenAI Responses, Docs, Sheets, Slides, Gamma/Canva | API key/OAuth | Medium | grounding + brand + approval |
| Publishing | simulated payload | Webflow, Wix, CMS API | OAuth/API token | High | preview + approval + version snapshot |
| Communication | draft-only `.example` emails | Gmail, Outlook Email | OAuth | High | explicit recipient + human approval |
| Finance admin | `invoices.csv` | Xero, QuickBooks, ERP API | OAuth | High | no professional judgment; approval required |
| Procurement | local vendor request | ERP, Airtable | OAuth/API token | High | budget and authority threshold |
| Observability | local audit state | PostHog, Sentry, OpenTelemetry | project token | Low | redact content and identifiers |

## Connector registry contract

```json
{
  "connector_id": "hubspot",
  "mode": "demo | live",
  "capabilities": ["read_account", "draft_update"],
  "allowed_entities": [],
  "requires_approval": true,
  "supports_rollback": true,
  "cost_budget": 0,
  "credential_reference": "runtime-secret-only"
}
```

Credentials must remain in runtime secret storage and never enter source, prompts, logs, Context Packets, screenshots, or fixtures.

## Recommended connection order

1. Google Drive and Gmail read-only.
2. HubSpot read-only plus draft updates.
3. Google Calendar read-only.
4. Linear task creation behind approval.
5. Apollo and Brandfetch enrichment with per-task cost limits.
6. Gmail sending only after recipient preview, approval, idempotency, and rollback controls pass.
