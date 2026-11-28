import { z } from 'zod';
import { DomainError, fail } from './domain.mjs';

export const MCP_RESOURCE = 'https://dealdesk.asharizakargroup.com/api/mcp';

export const createUserSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.email().max(320),
  password: z.string().min(8).max(128),
  position: z.string().trim().min(1).max(100).default('Acquisitions'),
  organization: z.string().trim().min(1).max(200).optional(),
  grant_mcp_access: z.boolean().default(false),
  mcp_client_id: z.string().trim().min(1).max(128).optional(),
  mcp_operational_writes: z.boolean().default(false),
  request_id: z.uuid().optional(),
}).strict();

export const userWriteTools = [
  {
    name: 'create_user',
    description: 'Create a DealDesk user account (Supabase Auth login + Users profile) within the configured organization, with optional OAuth grant provisioning for Hosted MCP API access. Passwords are never stored in Users or returned in responses.',
    schema: createUserSchema,
    write: true,
    destructive: true,
  },
];

export function sanitizeUserRequestForAudit(args, normalizedEmail = args.email.trim().toLowerCase()) {
  return {
    tool: 'create_user',
    name: args.name,
    email: normalizedEmail,
    position: args.position,
    organization: args.organization || 'AZRE',
    grant_mcp_access: Boolean(args.grant_mcp_access),
    mcp_client_id: args.mcp_client_id || null,
    mcp_operational_writes: Boolean(args.mcp_operational_writes),
  };
}

function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, '\\$&');
}

function isAuthDuplicateError(err) {
  const msg = String(err?.message || '').toLowerCase();
  const code = String(err?.code || '').toLowerCase();
  return (
    code === 'email_exists' ||
    code === 'user_already_exists' ||
    err?.status === 422 ||
    msg.includes('already been registered') ||
    msg.includes('already exists') ||
    msg.includes('duplicate')
  );
}

function presentUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    position: row.position || 'Acquisitions',
    organization: row.organization || 'AZRE',
    createdAt: row.createdAt || null,
    loginStatus: row.loginStatus || 'Offline',
    ...(row.pluginRevision !== undefined ? { _revision: row.pluginRevision } : {}),
  };
}

export async function createUserDirect(db, input, org) {
  const args = createUserSchema.parse(input || {});
  const normalizedEmail = args.email.trim().toLowerCase();
  if (!db?.auth?.admin?.createUser) {
    fail('SERVICE_UNAVAILABLE', 'User account creation requires Supabase Auth Admin API (SUPABASE_SERVICE_ROLE_KEY).');
  }

  // Check existing user in public."Users" before touching Auth
  const { data: existingRows, error: existingErr } = await db
    .from('Users')
    .select('id,name,email,position,organization')
    .ilike('email', escapeLike(normalizedEmail))
    .limit(5);
  if (existingErr) fail('DATABASE_ERROR', 'Failed checking existing user accounts.');
  const dup = (existingRows || []).find(r => String(r.email || '').trim().toLowerCase() === normalizedEmail);
  if (dup) {
    const err = new DomainError('DUPLICATE', 'A DealDesk user account with this email already exists.');
    err.details = { existing_user: dup };
    throw err;
  }

  let resolvedClientId = args.mcp_client_id || null;
  if (args.grant_mcp_access && !resolvedClientId) {
    const { data: grants, error: grantErr } = await db
      .from('PluginOAuthGrants')
      .select('client_id,operational_writes')
      .eq('organization_id', org)
      .eq('resource', MCP_RESOURCE)
      .eq('enabled', true)
      .limit(10);
    if (grantErr) fail('DATABASE_ERROR', 'Failed resolving existing OAuth client for MCP grant.');
    const preferred = (grants || []).sort((a, b) => Number(b.operational_writes) - Number(a.operational_writes))[0];
    if (!preferred?.client_id) {
      fail('INVALID_REQUEST', 'mcp_client_id is required when grant_mcp_access is true and no existing OAuth client is configured.');
    }
    resolvedClientId = preferred.client_id;
  }

  const orgName = args.organization || 'AZRE';
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: normalizedEmail,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.name,
      position: args.position,
      organization: orgName,
      organization_id: org,
    },
  });

  if (authError || !authData?.user?.id) {
    if (isAuthDuplicateError(authError)) {
      fail('DUPLICATE', 'An authentication account with this email already exists.');
    }
    fail('AUTH_CREATE_FAILED', authError?.message || 'Unable to create authentication user.');
  }

  const createdAuthId = authData.user.id;
  const profilePayload = {
    id: createdAuthId,
    name: args.name,
    email: normalizedEmail,
    position: args.position,
    organization: orgName,
    organization_id: org,
    createdAt: new Date().toISOString(),
    loginStatus: 'Offline',
  };

  const { data: insertedRows, error: insertErr } = await db.from('Users').insert(profilePayload).select('*');
  if (insertErr || !insertedRows?.length) {
    await db.auth.admin.deleteUser?.(createdAuthId).catch(() => {});
    if (String(insertErr?.code) === '23505') {
      fail('DUPLICATE', 'A DealDesk user account with this email already exists.');
    }
    fail('DATABASE_ERROR', 'Failed saving DealDesk user profile.');
  }

  let mcpGrant = null;
  if (args.grant_mcp_access && resolvedClientId) {
    const { data: existingGrant } = await db
      .from('PluginOAuthGrants')
      .select('*')
      .eq('client_id', resolvedClientId)
      .eq('user_id', createdAuthId)
      .limit(1);

    if (existingGrant?.length) {
      const { data: updatedGrant, error: grantUpdateErr } = await db
        .from('PluginOAuthGrants')
        .update({ enabled: true, operational_writes: Boolean(args.mcp_operational_writes) })
        .eq('client_id', resolvedClientId)
        .eq('user_id', createdAuthId)
        .select('*');
      if (grantUpdateErr) fail('DATABASE_ERROR', 'User created, but failed updating MCP OAuth grant.');
      mcpGrant = updatedGrant?.[0] || null;
    } else {
      const { data: insertedGrant, error: grantInsertErr } = await db
        .from('PluginOAuthGrants')
        .insert({
          client_id: resolvedClientId,
          user_id: createdAuthId,
          organization_id: org,
          resource: MCP_RESOURCE,
          enabled: true,
          operational_writes: Boolean(args.mcp_operational_writes),
        })
        .select('*');
      if (grantInsertErr) fail('DATABASE_ERROR', 'User created, but failed provisioning MCP OAuth grant.');
      mcpGrant = insertedGrant?.[0] || null;
    }
  }

  return {
    user: presentUser(insertedRows[0]),
    ...(mcpGrant ? { mcp_grant: mcpGrant } : {}),
  };
}

export async function createUserHosted(db, input, identity, org) {
  const args = createUserSchema.parse(input || {});
  const normalizedEmail = args.email.trim().toLowerCase();
  if (!db?.auth?.admin?.createUser) {
    fail('SERVICE_UNAVAILABLE', 'User account creation requires Supabase Auth Admin API (SUPABASE_SERVICE_ROLE_KEY).');
  }

  const sanitizedBody = sanitizeUserRequestForAudit(args, normalizedEmail);

  const { data: checkData, error: checkError } = await db.rpc('dealdesk_check_user_create', {
    p_email: normalizedEmail,
    p_request_body: sanitizedBody,
    p_user: identity.sub,
    p_client: identity.client_id,
    p_session: identity.session_id,
    p_request: args.request_id ?? null,
  });

  if (checkError) fail('DATABASE_ERROR', 'Failed validating user creation preconditions.');
  if (checkData?.error) {
    const err = new DomainError(checkData.error.code, checkData.error.message);
    if (checkData.error.details) err.details = checkData.error.details;
    throw err;
  }
  if (checkData?.replay) {
    return checkData.result;
  }

  if (args.grant_mcp_access && !args.mcp_client_id) {
    const { data: grants, error: grantErr } = await db
      .from('PluginOAuthGrants')
      .select('client_id')
      .eq('organization_id', org)
      .eq('resource', MCP_RESOURCE)
      .eq('enabled', true)
      .limit(1);
    if (grantErr) fail('DATABASE_ERROR', 'Failed resolving existing OAuth client.');
    if (!grants?.length) {
      fail('INVALID_REQUEST', 'mcp_client_id is required when grant_mcp_access is true and no existing OAuth client is configured.');
    }
  }

  const orgName = args.organization || 'AZRE';
  const { data: authData, error: authError } = await db.auth.admin.createUser({
    email: normalizedEmail,
    password: args.password,
    email_confirm: true,
    user_metadata: {
      full_name: args.name,
      position: args.position,
      organization: orgName,
      organization_id: org,
    },
  });

  if (authError || !authData?.user?.id) {
    if (isAuthDuplicateError(authError)) {
      fail('DUPLICATE', 'An authentication account with this email already exists.');
    }
    fail('AUTH_CREATE_FAILED', authError?.message || 'Unable to create authentication user.');
  }

  const createdAuthId = authData.user.id;
  const { data: rpcData, error: rpcError } = await db.rpc('dealdesk_create_user_profile', {
    p_id: createdAuthId,
    p_name: args.name,
    p_email: normalizedEmail,
    p_position: args.position,
    p_organization: orgName,
    p_grant_mcp_access: Boolean(args.grant_mcp_access),
    p_mcp_client_id: args.mcp_client_id ?? null,
    p_mcp_operational_writes: Boolean(args.mcp_operational_writes),
    p_request_body: sanitizedBody,
    p_user: identity.sub,
    p_client: identity.client_id,
    p_session: identity.session_id,
    p_request: args.request_id ?? null,
  });

  if (rpcError || rpcData?.error) {
    await db.auth.admin.deleteUser?.(createdAuthId).catch(() => {});
    if (rpcError) fail('DATABASE_ERROR', 'Failed creating DealDesk user profile.');
    const err = new DomainError(rpcData.error.code, rpcData.error.message);
    if (rpcData.error.details) err.details = rpcData.error.details;
    throw err;
  }

  return rpcData;
}
