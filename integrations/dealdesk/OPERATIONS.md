# Hosted controlled operations (v0.3)

The existing eight reads remain. Five operational writes and two Zillow wrappers
are added. The hosted server never exposes buyer writes, offer execution,
messaging, SQL, deletion, archive, restore, organization or permission changes.

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
