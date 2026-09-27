# Hosted read-only DealDesk MCP

The Vercel function at `/api/mcp` uses the shared DealDesk tools and scoped backend directly. It requires Supabase OAuth tokens. It never uses the Mac tunnel, preview bypass key, or generic `/api/ai/operate` endpoint.

## Access model

- Fixed resource: `https://dealdesk.asharizakargroup.com/api/mcp`
- Fixed organization: `org_azre_00001`
- Supabase issuer: `https://ygxgcmrhdzvfzhoxxsgv.supabase.co/auth/v1`
- Eight read tools are discoverable. All nine mutation names are rejected even if environment flags are changed.
- Validate JWT signature, ES256/RS256, issuer, resource audience, expiration, subject, OAuth client, role, identity scope and read permission before querying the database.
- Recheck an enabled `PluginOAuthGrants` row on each request so revocation is immediate.
- OAuth token role is `dealdesk_mcp`. This role is deliberately not available to the Supabase Data API. Do not create it or grant it to `authenticator`.
- Supabase issues/refreshes OAuth tokens. Vercel has no authorization-code store or signing secret.
- Service-role credentials stay on Vercel and never reach ChatGPT or the browser. Backend reads always add the fixed organization filter and project the field allowlist.
- `/oauth/consent` is separate from the main DealDesk app and cannot trigger business-data synchronization.

## Deployment

1. Deploy the branch and run lint, build, plugin tests. The new endpoint remains inaccessible until all OAuth setup is complete.
2. Apply `backend/002-oauth.sql`. It adds a private authorization table and a token hook; it does not change business records. Check any existing token hook before enabling the new one. This hook denies OAuth clients without explicit grants and leaves ordinary sign-ins unchanged.
3. In Supabase Authentication > OAuth Server, enable OAuth, keep dynamic registration disabled, and configure authorization path `/oauth/consent`. Site URL must be `https://dealdesk.asharizakargroup.com`.
4. Register a public OAuth client for ChatGPT with authorization-code + PKCE and refresh tokens. Copy the exact callback URI from ChatGPT's connection setup; do not use wildcard redirects. No client secret is required for a public client.
5. Add one grant for that client ID and the approved user's immutable Supabase Auth ID. Set organization/resource exactly as above. Do not derive access from editable user metadata.
6. Enable `public.dealdesk_oauth_token_hook` in Authentication > Hooks. Verify normal sign-in remains unchanged. Enable no other clients until their authorization model has been reviewed.
7. Vercel needs existing `VITE_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `DEALDESK_PLUGIN_ORGANIZATION_ID=org_azre_00001`. Keep plugin write/archive flags false. No new MCP secret is needed.
8. Connect a remote HTTP MCP app in ChatGPT using the URL above, OAuth and the registered public client ID. Sign in with the approved DealDesk account and consent to read-only access.
9. Verify an authenticated read from normal ChatGPT, then stop the local tunnel and repeat. Test rejection of invalid/expired/wrong-audience credentials, unknown clients, unauthorized users, revoked grants, and all nine mutation tool names. Confirm the OAuth token cannot query the Supabase Data API.

## Rollback/revocation

Set the relevant grant's `enabled` to false to revoke MCP access immediately. Normal DealDesk logins remain unaffected. Disconnect the hosted ChatGPT app if needed; keep the old private tunnel registration until cloud verification succeeds. To remove the hook, first disable/disconnect OAuth clients so they cannot receive ordinary database-capable tokens.

## Verification

`npm run lint`, `npm run build`, `npm run test:plugin`.
The hosted tests use signed test JWTs and an isolated PostgreSQL engine. No live business records are created or changed.
