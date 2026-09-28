import React, { useEffect, useState } from 'react';
import { createClient, type OAuthAuthorizationDetails } from '@supabase/supabase-js';

// Use the same Supabase project/storage key as DealDesk, without mounting App:
// the consent page must not run business-data synchronization or profile writes.
const auth = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
function returnToChatGPT(value: string) {
  const url = new URL(value);
  if (url.origin !== 'https://chatgpt.com' ||
      !(url.pathname === '/connector_platform_oauth_redirect' || /^\/connector\/oauth\/[A-Za-z0-9_-]+$/.test(url.pathname))) {
    throw Error('Unexpected return address. Restart the connection from ChatGPT.');
  }
  window.location.assign(url.href);
}

export function OAuthConsent() {
  const authorizationId = new URLSearchParams(window.location.search).get('authorization_id');
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [sessionEmail, setSessionEmail] = useState<string | null>(null);

  async function load() {
    setBusy(true); setError(''); setDetails(null);
    try {
      const { data: { session } } = await auth.auth.getSession();
      setSessionEmail(session?.user.email ?? null);
      if (!authorizationId || !/^[A-Za-z0-9_-]{10,200}$/.test(authorizationId)) throw Error('Start the DealDesk connection from ChatGPT to continue.');
      if (!session) { setNeedsLogin(true); return; }
      setNeedsLogin(false);
      const permission = await fetch('/api/mcp?view=consent', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store' });
      if (!permission.ok) throw Error('This DealDesk account is not approved for the AZRE connection.');
      const allowed = await permission.json();
      const { data, error: detailError } = await auth.auth.oauth.getAuthorizationDetails(authorizationId);
      if (detailError || !data) throw Error('This connection request has expired. Start again from ChatGPT.');
      if ('redirect_url' in data) { returnToChatGPT(data.redirect_url); return; }
      if (!allowed.client_ids.includes(data.client.id)) throw Error('This application is not approved for DealDesk.');
      // Display Supabase-verified client metadata as plain React text.
      setDetails(data);
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to load this connection.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, []);

  async function signOutBrowser() {
    setBusy(true); setError('');
    try {
      const { error: signOutError } = await auth.auth.signOut({ scope: 'local' });
      if (signOutError) throw signOutError;
      setSessionEmail(null); setDetails(null); setNeedsLogin(Boolean(authorizationId));
    } catch { setError('Unable to sign out. Please try again.'); }
    finally { setBusy(false); }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    const { error: signInError } = await auth.auth.signInWithPassword({ email, password });
    setPassword('');
    if (signInError) { setError('Sign-in failed. Check your DealDesk email and password.'); setBusy(false); }
    else await load();
  }
  async function decide(approve: boolean) {
    if (!authorizationId) return;
    setBusy(true); setError('');
    try {
      const result = approve
        ? await auth.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
        : await auth.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error || !result.data) throw Error('Unable to complete authorization. Restart from ChatGPT.');
      returnToChatGPT(result.data.redirect_url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Authorization failed.'); setBusy(false); }
  }
  return <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
    <section className="w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-8 shadow-xl">
      <p className="text-emerald-400 text-sm font-semibold tracking-wide">DEALDESK</p>
      <h1 className="mt-3 text-2xl font-semibold">Connect AZRE to ChatGPT</h1>
      <p className="mt-3 text-slate-300">Read your deals, buyers, agents and tasks, and check buyer matches.</p>
      <p className="mt-3 text-sm text-slate-400">Read-only access. This connection cannot create, edit, delete or archive records, or send messages.</p>
      {sessionEmail && <div className="mt-4 text-sm text-slate-400">
        <p>Browser signed in as {sessionEmail}</p>
        <button disabled={busy} onClick={() => void signOutBrowser()} className="mt-2 underline disabled:opacity-50">Sign out of this browser</button>
        <p className="mt-2">Signing out here keeps existing ChatGPT connections authorized. Disconnect them in ChatGPT to revoke access.</p>
      </div>}
      {error && <p role="alert" className="mt-5 rounded-lg bg-red-950 p-3 text-red-200">{error}</p>}
      {needsLogin && <form onSubmit={signIn} className="mt-6 space-y-4">
        <label className="block">DealDesk email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-3" /></label>
        <label className="block">Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg bg-slate-800 p-3" /></label>
        <button disabled={busy} className="w-full rounded-lg bg-emerald-500 p-3 font-semibold text-slate-950 disabled:opacity-50">Sign in</button>
        <button type="button" disabled={busy} className="w-full rounded-lg border border-slate-600 p-3" onClick={async () => {
          setBusy(true);
          const result = await auth.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.href } });
          if (result.error) { setError('Google sign-in is unavailable. Use your DealDesk password.'); setBusy(false); }
        }}>Continue with Google</button>
      </form>}
      {details && <div className="mt-6">
        <p><strong>{details.client.name || 'ChatGPT'}</strong> is requesting access.</p>
        <p className="mt-2 text-sm text-slate-400">Signed in as {details.user.email}</p>
        <p className="mt-2 text-sm text-slate-400">Requested identity permissions: {details.scope || 'Sign-in identity'}</p>
        <div className="mt-6 flex gap-3">
          <button disabled={busy} onClick={() => void decide(false)} className="rounded-lg border border-slate-600 px-5 py-3">Cancel</button>
          <button disabled={busy} onClick={() => void decide(true)} className="flex-1 rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">Allow read-only access</button>
        </div>
      </div>}
      {busy && <p role="status" className="mt-5 text-slate-400">Loading…</p>}
    </section>
  </main>;
}
