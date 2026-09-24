# AZRE DealDesk plugin v0.1

Implemented against `EchoAIOnline/AZRE-DealDesk` commit `8ba00b8f391873a2ffaf10beb5d31c1c14d177dd` (September 24, 2026).

This package contains a working MCP server, an organization-scoped DealDesk backend endpoint, a database migration, the AZRE skill, and integration tests using PostgreSQL through PGlite. It is **not deployed or connected to live records yet**.

## What is implemented

17 tools: `search_deals`, `get_deal`, `create_deal`, `update_deal`, `search_buyers`, `get_buyer`, `create_buyer`, `update_buyer`, `match_buyers`, `search_agents`, `get_agent`, `create_note`, `create_task`, `search_tasks`, `update_offer`, `archive_record`, `restore_record`.

- Deal and buyer writes use explicit allowed fields; callers cannot choose arbitrary tables or modify access settings.
- Every read/write is scoped to the backend's configured organization. Rows without that organization are excluded.
- Updates require a record revision. Database triggers increment it even when the existing web UI updates a row.
- Notes append to Deals.logs or Buyers/Agents.notes using a revision check.
- Creation uses the supplied UUID request_id as the record ID to prevent duplicate inserts. Reuse the same ID after an uncertain result. A simultaneous duplicate may report an error; read the ID before retrying.
- Offer updates affect Deals.offerPrice/offerDecision and related allowed fields. Stage changes append stage history; they do not send an offer or invoke the web UI's other workflow actions.
- Database audit entries record entity, organization, operation, time, and changed field names. MCP process logs contain tool/outcome and a configured principal label, without record contents or keys. This is not authenticated per-user attribution.
- Permanent deletion, payments, contract signing, and outbound messaging are not exposed.

## Architecture

```text
ChatGPT (private MCP tunnel) or a local MCP client
  → MCP server (stdio; authenticated loopback HTTP also available)
  → POST /api/ai/plugin (dedicated plugin key)
  → Supabase (fixed organization, revision checks, field allowlists)
```

The original proposal used `/api/ai/operate`. The source code showed that endpoint accepts arbitrary tables under its existing key. This implementation adds a separate, narrower `/api/ai/plugin` endpoint with a **different key**, preserving the existing endpoint for existing clients. The original endpoint and its callers have not otherwise been redesigned.

## Source mapping and deliberate limits

| Concept | Actual storage / behavior |
|---|---|
| Pipeline stage | Deals.offerDecision; Deals.status remains an internal processing field |
| Offers | Fields on Deals; there is no Offers table in this repository |
| Notes | Deals.logs; Buyers.notes; Agents.notes |
| Buyer strategy | buyBox.propertyTypes compared with Deals.dealType |
| Tasks | New PluginTasks table, visible through search_tasks; no web UI task screen in this release |
| Archive | New pluginArchivedAt/reason fields; excluded from plugin searches/matching; existing web UI does not hide archived rows |
| ARV | Current frontend names renovationARV/newConstructionARV; migration backfills from legacy arv/newConstructionArv when the new value is null |

Buyer matching is a **conservative screening implementation**, not a byte-for-byte copy of the web UI's matching engine. It preserves target-ZIP refinement and strategy aliases, checks recorded price/ARV/repair budget/spec constraints, excludes deactivated buyers, and distinguishes missing data from confirmed fit. Named city/county/neighborhood matching is exact; it does not geocode. New-construction-only deals bypass existing-building specs. A score measures evaluated criteria, not probability or financial suitability. Offer price falls back to list price; an unrecorded assignment fee is not included. Each call screens one page; combine all pages before claiming a complete ranking.

This v1 is for **one trusted organization and operator group per deployment**. The backend organization is server configuration, never a tool argument. There is no public OAuth flow or multi-tenant identity provider in this package. Prefer stdio through a private MCP tunnel for ChatGPT. Loopback HTTP uses a separate bearer token, rejects browser origins, and is intended for local development. Public directory submission would require further authentication/deployment work.

## Local installation and tests

Requires Node.js 22.9+ (tested with Node 24).

```sh
npm ci
npm test
npm run check
cp .env.example .env
chmod 600 .env
```

Fill in the dedicated plugin key in `.env` locally; do not paste it into chat. The example points to the known DealDesk domain, but the new endpoint must be deployed before calls will work. Keep both write switches false for the first read-only test.

```sh
npm start
```

The default stdio server waits for an MCP client; no browser page is expected. No OpenAI API key is needed for this server itself.

For local Codex/plugin packaging, regenerate `.mcp.json` after moving the folder:

```sh
node scripts/configure-local.mjs
```

This writes absolute local launch paths; the generated config references `.env` without embedding secrets. The distribution ZIP and repository patch start with an empty MCP config; run this script before local installation. The package is not automatically installed into a personal marketplace. Register it locally after the backend connection works. The bundled skill remains under `skills/azre-dealdesk`.

## Deployment target

The user confirmed Vercel project `echoaionlines-projects/azre-dealdesk2`, live domain `https://dealdesk.asharizakargroup.com`, and Supabase project **AZRE DealDesk Project** (`ygxgcmrhdzvfzhoxxsgv`). The verified application organization_id is `org_azre_00001`; it is not the Supabase project reference. Test organizations and unassigned rows are excluded.

The required backend Supabase environment variable names are present in Vercel. Live Deals uses text IDs and a text yearBuilt column; compatibility is covered by an additional integration test. The dedicated plugin key and organization setting must be configured before this endpoint can serve requests.

## Deploy the DealDesk backend

The accompanying `dealdesk-backend.patch` includes this package under `integrations/dealdesk`, a Vercel function at `api/ai/plugin.ts`, the equivalent Express route in `server.ts`, and the required root Zod dependency. Apply it from a clean checkout of the source commit:

```sh
git apply --check /path/to/dealdesk-backend.patch
git apply /path/to/dealdesk-backend.patch
npm ci
npm run build
```

1. Apply `integrations/dealdesk/backend/001-plugin.sql` in the correct Supabase project, preferably staging first. It adds fields/tables and triggers; it does not delete business records. It backfills legacy ARV values only where the newer field is null. Review that backfill against your deployed schema.
2. Set these **backend** environment variables in the deployment host:
   - `DEALDESK_PLUGIN_API_KEY`: a new random secret of at least 32 characters, different from `DEALDESK_API_KEY`.
   - `DEALDESK_PLUGIN_ORGANIZATION_ID`: the exact organization_id for AZRE; do not infer it from a name.
   - Existing `VITE_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
   - `DEALDESK_PLUGIN_WRITES=false` and `DEALDESK_PLUGIN_ARCHIVE=false` initially.
3. Deploy the backend patch. The Supabase service key stays on the backend; it is not placed in the MCP server's `.env`.
4. Set the new plugin key and endpoint URL in the MCP server's `.env` and start it.
5. Test search_deals/get_deal against known records. Verify organization boundaries and compare field values in the web UI.
6. Enable writes on **both** the backend and MCP server only after the read test succeeds. Use a staging record for create/update/note/task tests; confirm stale revisions are rejected.
7. Enable archive on both sides separately if the plugin-only visibility behavior is acceptable.

If you deploy with Bun, refresh its lockfile for the new root Zod dependency; the supplied patch maintains the npm lockfile.

For operational rollback, disable the backend write/archive flags and stop the MCP process. Do not drop PluginTasks or PluginAudit: they may contain new records. Restore archived records with restore_record before retiring the plugin.

## Connect ChatGPT

Use the official [connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt) and [Secure MCP Tunnel guide](https://developers.openai.com/api/docs/guides/secure-mcp-tunnels). Configure a private tunnel to launch this server over stdio, with its dedicated key supplied by the local environment. Tunnel setup needs its own OpenAI runtime credentials and workspace access; those are separate from DealDesk credentials.

In a workspace with developer-mode access, add the tunnel from ChatGPT Plugins, review the discovered tools, then test in a new conversation. This package has not been registered or tested inside the user's ChatGPT account. The skill can be packaged with the registered connection after its technical ID is available.

Suggested acceptance prompts:

- “Show my active deals in Brookhaven.” Expect search_deals with subMarket and offerDecision filters, paging as needed.
- “Find buyers for this deal and tell me which criteria are missing.” Expect get_deal and paged match_buyers; no outreach.
- “Change the renovation estimate to $425,000.” Expect a resolved deal, fresh revision, and only the specified field update.
- “Add a note that demolition approval is pending.” Expect append behavior preserving earlier logs.
- “Permanently delete all buyers.” No supported tool.

Official implementation references: [MCP server tools](https://developers.openai.com/plugins/build/mcp-server), [plugin packaging](https://developers.openai.com/plugins/build/plugins).
