import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, PasswordInput, TextInput, toast } from '../components/ui';
import { roleLabel } from '../lib/role-perms';

async function completeAccept(token: string, navigate: ReturnType<typeof useNavigate>) {
  const res = await api.post('/users/accept', { token });
  const data = res.data.data as {
    organization_id: string;
    store_id: string | null;
    role: string;
  };
  localStorage.setItem('ventapos:orgId', data.organization_id);
  if (data.store_id) useSessionStore.getState().setStore(data.store_id);
  queryClient.clear();
  toast('success', `Joined as ${roleLabel(data.role)}`);
  navigate(data.role === 'owner' ? '/owner-hub' : '/pos', { replace: true });
}

export default function AcceptInvitePage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  const [meta, setMeta] = useState<{ email: string; role: string } | null>(null);
  const [peekErr, setPeekErr] = useState('');
  const [mode, setMode] = useState<'loading' | 'auth' | 'create' | 'signin'>('loading');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setPeekErr('Missing invite token.');
      setMode('auth');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const peek = await api.get('/users/accept', { params: { token } });
        if (cancelled) return;
        setMeta(peek.data.data);
        setEmail(peek.data.data.email ?? '');
      } catch (e: any) {
        if (!cancelled) {
          setPeekErr(
            e.response?.data?.error?.message ?? 'Invite link is invalid or expired.',
          );
        }
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (cancelled) return;
        if (data.session) {
          await completeAccept(token, navigate);
          return;
        }
      } catch {
        // fall through to auth UI
      }
      if (!cancelled) setMode('create');
    })();
    return () => {
      cancelled = true;
    };
  }, [token, navigate]);

  const signUp = async () => {
    setMsg('');
    if (!password || password.length < 6) {
      setMsg('Use a password with at least 6 characters.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: (email || meta?.email || '').trim(),
        password,
        options: {
          data: {
            full_name: name.trim() || email.split('@')[0],
            invite_token: token,
          },
          emailRedirectTo: `${window.location.origin}/accept-invite?token=${token}`,
        },
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      queryClient.clear();
      if (data.session) {
        await completeAccept(token, navigate);
      } else {
        setMsg('Check your inbox to confirm, then open the invite link again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const signIn = async () => {
    setMsg('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: (email || meta?.email || '').trim(),
        password,
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      queryClient.clear();
      await completeAccept(token, navigate);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Could not complete invite');
    } finally {
      setBusy(false);
    }
  };

  if (!token || peekErr) {
    return (
      <AuthShell title="Invite" sub="This link is not valid">
        <p className="text-sm text-red-600">{peekErr || 'Ask the owner to send a new invite.'}</p>
        <p className="mt-4 text-center text-sm text-gray-500">
          <Link to="/login" className="font-medium text-primary">
            Sign in
          </Link>
        </p>
      </AuthShell>
    );
  }

  if (mode === 'loading') {
    return <div className="p-6">Loading invite…</div>;
  }

  const inviteLine = meta
    ? `You're invited as ${roleLabel(meta.role)}${meta.email ? ` · ${meta.email}` : ''}`
    : 'Create your account to join the store.';

  return (
    <AuthShell
      title="Join your store"
      sub={inviteLine}
    >
      <div className="grid gap-4">
        {mode === 'create' && (
          <>
            <Field label="Full name">
              <TextInput
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            <Field label="Email" hint="Use the invited email.">
              <TextInput
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={!!meta?.email}
              />
            </Field>
            <Field label="Password" hint="At least 6 characters.">
              <PasswordInput
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && signUp()}
              />
            </Field>
            <Button size="large" className="w-full" disabled={busy} onClick={signUp}>
              {busy ? 'Creating…' : 'Create account & join'}
            </Button>
          </>
        )}
        {mode === 'signin' && (
          <>
            <Field label="Email">
              <TextInput
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            <Field label="Password">
              <PasswordInput
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && signIn()}
              />
            </Field>
            <Button size="large" className="w-full" disabled={busy} onClick={signIn}>
              {busy ? 'Signing in…' : 'Sign in & join'}
            </Button>
          </>
        )}
        {mode === 'create' && (
          <button
            type="button"
            className="text-center text-sm text-gray-500 underline"
            onClick={() => setMode('signin')}
          >
            Already have an account? Sign in
          </button>
        )}
        {mode === 'signin' && (
          <button
            type="button"
            className="text-center text-sm text-gray-500 underline"
            onClick={() => setMode('create')}
          >
            Need an account? Create one
          </button>
        )}
      </div>
      {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}
    </AuthShell>
  );
}
