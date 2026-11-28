# Hosted controlled operations (v0.4)

Ten read tools (including Off-Market Scouter), two Zillow wrappers, and ten
operational writes are available. The hosted server never exposes offer
execution, messaging, SQL, deletion, archive, restore, organization or
permission changes.

## Authorization and release

Apply `backend/003-operational.sql` after migrations 001 and 002. It adds a private
atomic mutation/audit function, an append-only audit table (for the service role),
a disabled-by-default `operational_writes` flag on each explicit OAuth grant, and
priority/datetime support on the existing PluginTasks table. It does not edit
existing Deals, Buyers or Agents. Existing task dates become midnight UTC.

Only enable the existing approved user's existing ChatGPT client grant. There is
no model-supplied organization. Both handler and RPC enforce org_azre_00001.
The token hook, audience, issuer, key verification, local browser logout, refresh
lifecycle, and OAuth client remain unchanged. The historical `dealdesk_permission:
read` claim is retained for token compatibility; **current server-side grant
policy** controls these new operations, not a model argument or that claim alone.
An OAuth session_id is required for writes. Revoking enabled or operational_writes
blocks new mutations, even if the access token has not expired. Do not enable the
legacy DEALDESK_PLUGIN_WRITES or DEALDESK_PLUGIN_ARCHIVE environment flags.

Deploy the branch preview, validate, then deploy the tested branch to production.
Do not change the connector URL or recreate the OAuth client. Refresh the tool
list in ChatGPT if it caches the eight-tool manifest. Existing authorization should
remain valid; a reconnect is only needed if the host requests renewed consent or
its session has independently expired/revoked. Verify this live rather than assume.
Rollback: set operational_writes=false for the grant and redeploy the previous
Vercel deployment. Keep migration/audit rows; never roll back by deleting audits.

## Tools and schemas

See `hosted-tool-schemas.json` for the exact input schemas. Each object rejects
unknown keys; omitted PATCH fields are preserved. All monetary values are finite,
nonnegative; the three asking-price integer columns require whole dollars within
PostgreSQL integer range. UI enum values are used for deal/property types, contact
status, interest and Pipeline Status. Dates use YYYY-MM-DD; task dueDate also
accepts ISO timestamps with a timezone. Date-only task input is midnight UTC.

- `create_deal`: fields with required address, optional request_id UUID. Defaults
  offerDecision to No Offer Made Yet, separate status to Analyzing. Duplicate
  address/MLS returns DUPLICATE with existing IDs, addresses, MLS, stages/revisions.
- `update_deal`: deal_id, expected_revision, fields. Get the record first. CONFLICT
  requires rereading and reconciliation. New stage appends stage history.
- `add_deal_note`: deal_id, body, optional category and request_id. Locks the row
  and appends a UTC timestamp and ChatGPT attribution; it cannot replace logs.
- `create_task`: fields containing title, entityType (Deals/Buyers/Agents), entityId,
  dueDate; optional description, assignee, status, priority and request_id UUID.
- `update_task`: task_id, expected_revision, fields. Read via search_tasks first.
  Set status=Completed to complete; no separate complete_task is needed.
- `import_from_zillow`: url, create_deal=false. Preview never writes. True maps
  reliable returned fields through the same validated create_deal/RPC path;
  duplicates still fail. Audit tool is import_from_zillow.
- `pull_zillow_comps`: url. Returns the existing importer's comps; never saves.

Use a fresh request_id for intended creation/note and reuse it for retries.
The audit and operation commit together; audit failure rolls back business writes.
Audits include before/after records, changed keys, revision, user/client/session,
organization, tool and UTC time. The database records original note body in the
idempotency request and appended note in after values. Preserve these private.

Zillow accepts only HTTPS zillow.com/www.zillow.com homedetails URLs and converts
input to a canonical numeric property-ID URL (no query, fragment or arbitrary
redirect parameters). It calls the existing api/zillow-data handler directly;
no OAuth token is forwarded and no scraping implementation is duplicated.
The backend's fixed BrightData request rejects redirects and times out after45s.
Only known property/comps fields are returned; raw scraper metadata is omitted.
Upstream asynchronous/pending results are reported as such; never create from them.

## Test records

Production writes must use only clearly marked MCP TEST records created for this
release. Check create/read/PATCH/stale revision/note/task completion, address and
MLS duplicates, unknown fields, tenant isolation, disabled destructive tools and
all eight reads. Cross-tenant write checks should use a missing target ID, or
local fixtures; never edit an actual other-tenant row. Cleanup only explicitly
recorded test IDs through admin SQL. Retain their mutation audits. Do not expose
cleanup as an MCP tool.

## Queue placement

Apply `backend/006-queue.sql` before deploying the queue-aware Hosted server. It
requires the existing text `Deals.queueStatus` and `Deals.pipelineType` columns
and the exact reviewed migration-005 function hash. It preserves grants, owner,
execution permissions, revisions, audits, and existing deal values; there is no
backfill. Save the previous Vercel deployment for rollback.

`create_deal.fields.queueStatus` and `update_deal.fields.queueStatus` accept only
`In Queue` and `In Pipeline`. New deals default to In Pipeline and Listed On MLS.
The atomic mutation function derives pipelineType: In Queue -> azre-queue;
In Pipeline + Off-Market -> off-market; otherwise -> mls. Changing listingType
on a queued deal keeps it queued. Omitted queue placement remains unchanged.
JV/DFD records cannot be reassigned via queueStatus. pipelineType is readable and
filterable but cannot be directly written through Hosted.

`get_deal`/`search_deals` expose queueStatus and pipelineType; `search_deals`
accepts exact filters for queueStatus, pipelineType, and listingType. Filters
match stored values, so older null queueStatus values do not match In Pipeline.

After deployment, refresh the existing connector's tool list. Verify discovery,
then use only a clearly marked disposable MCP TEST record to test queue entry,
listing changes, queue exit, stale revisions, and audit entries. Existing
business deals must not be changed for validation. For rollback, restore the
previous application deployment first, then apply `006-queue-rollback.sql` only
if its guard still matches. Rollback preserves all deal values and audit rows.

## Buyers, notes, and Off-Market Scouter (007)

Apply `backend/007-hosted-expansion.sql` before deploying the 22-tool Hosted server.
It adds nullable `organization_id` and `pluginArchivedAt` columns (plus index) to
`OffMarketProperties` without modifying or backfilling existing rows, and updates
`public.dealdesk_operational_mutation` to preserve all comparables (005) and queue
routing (006) while adding:

- `create_buyer`: creates a `Buyers` row (`New Lead`, `Subscribed`, `propertiesBought=0`,
  `notes=[]`) with duplicate checks (email, 7+ digit phone, or un-emailed name) and
  `request_id` idempotency.
- `update_buyer`: patches `Buyers` using `expected_revision`, merging supplied `buyBox`
  keys into existing `buyBox` JSON without wiping unspecified criteria, and checking
  email/phone collisions.
- `add_buyer_note` / `add_agent_note`: appends timestamped `ChatGPT / DealDesk Hosted`
  notes to `Buyers.notes` or `Agents.notes` without overwriting prior entries, with
  `request_id` idempotency and `PluginMutationAudit` tracking.
- `search_off_market_properties` / `get_off_market_property`: read-only access to
  `OffMarketProperties` scoped strictly to `org_azre_00001` (`organization_id = 'org_azre_00001'`),
  with literal address `query` search, exact column filters, and `offset`/`limit`/`next_offset`
  matching `off-market` and `Interested` filters, and `offset`/`limit`/`next_offset`
  pagination. Assign `organization_id = 'org_azre_00001'` on existing `OffMarketProperties`
  rows in Supabase so they are visible through the organization-scoped Hosted tools.

## Full user capabilities (008)

Apply `backend/008-full-user-capabilities.sql` to enable all user DealDesk capabilities
across Hosted MCP (`/api/mcp`), Plugin API + Local MCP (`/api/ai/plugin`), and AI
Operate (`/api/ai/operate`), while keeping organization scoping (`org_azre_00001`),
OAuth / API key authentication, revision conflict detection, write/archive gates, and
atomic `PluginMutationAudit` tracking intact:

- **Full table & field access**: Reads, creates, updates, deletes, archive/restore, and
  notes on `Deals` (including `lockBoxCode`, `dispo`, `documents`, `motivationSignals`,
  `renovationWorkflow`, owner info, LOI tracking, buyer interest lists, and comparables),
  `JVDeals`, `Buyers`, `Agents`, `Wholesalers`, `OffMarketProperties`,
  `OffMarketOfferTextMessageGenerator`, `PluginTasks`, and all CRM workspace tables
  (`Brokerages`, `Contacts`, `EmailLists`, `Campaigns`, `EmailTemplates`, `OfferTemplates`,
  `sender_emails`, `activity_logs`, `InboxMessages`, `MarketData`, `Integrations` with
  sensitive API keys/tokens omitted from reads).
- **Workflow moves**: `move_deal` (`Deals` <-> `JVDeals` or pipeline transfers across
  `mls`, `off-market`, `azre-queue`, `dfd`) and `move_contact` (`Buyers` <-> `Agents` <->
  `Wholesalers`).
- **Service integrations**: `send_email` (AWS SES single/bulk email, requires
  `operational_writes`), `import_from_zillow` / `pull_zillow_comps` (BrightData via
  validated canonical Zillow homedetails URLs), `generate_ai_comps` (Gemini comps), and
  `ai_search_chat` (Gemini web-grounded search chat).

## User Accounts, Activity Feed, and Dashboard (009)

Apply `backend/009-users-activity-dashboard.sql` after `008-full-user-capabilities.sql`
to enable user account provisioning, Activity Feed reads/writes, and live Dashboard
aggregation across Hosted MCP (`/api/mcp`), Plugin API + Local MCP (`/api/ai/plugin`),
and AI Operate (`/api/ai/operate`):

- `create_user`: creates a Supabase Auth user (`auth.admin.createUser` via
  `SUPABASE_SERVICE_ROLE_KEY`) and a matching organization-scoped profile in `public."Users"`,
  with optional `grant_mcp_access` + `mcp_operational_writes` provisioning in
  `PluginOAuthGrants`. Passwords are never stored in `public."Users"`, never recorded in
  `PluginMutationAudit`, and never returned in API responses. Duplicate emails return
  `DUPLICATE`. Direct `read`/`update`/`delete` access to `Users` remains blocked.
- `get_activity_feed` & `log_activity`: chronological (`created_at DESC`) read and write
  access to `activity_logs` scoped to `org_azre_00001`, mirroring `activityLogService.ts`
  including 5-minute `UPDATE` grouping and `sent_text_to_agent_only` filtering.
- `get_dashboard`: read-only aggregation matching `Dashboard.tsx`, returning active
  pipeline KPIs and 7-day trends, timeframe metrics (deals added, listings removed, offers
  declined, canceled deals, LOIs, agent/owner texts & conversations), 14-day chart series,
  recent deals, upcoming follow-ups/tasks, recent activity, and non-sensitive user summaries.

