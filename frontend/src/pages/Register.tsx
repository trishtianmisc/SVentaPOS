import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, PasswordInput, TextInput } from '../components/ui';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  // Already signed in (revisited /register): same resolution as Login.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session || cancelled) return;
        const res = await api.get('/auth/me');
        if (cancelled) return;
        const orgId = res.data.data.organization_id;
        if (orgId) localStorage.setItem('ventapos:orgId', orgId);
        navigate(orgId ? '/pos' : '/onboarding', { replace: true });
      } catch {
        // Stay on the form.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  const register = async () => {
    setMsg('');
    if (!name.trim() || !email.trim() || password.length < 6) {
      setMsg('Enter your name, a valid email, and a 6+ character password.');
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: { full_name: name.trim() } },
      });
      if (error) {
        setMsg(error.message);
        return;
      }
      // Confirmation off -> session starts immediately; on -> inbox branch.
      // Either way the account is new to this device: drop cached rows.
      queryClient.clear();
      const invite = new URLSearchParams(window.location.search).get('token');
      if (invite) {
        localStorage.setItem('ventapos:inviteToken', invite);
        navigate(`/accept-invite?token=${encodeURIComponent(invite)}`, {
          replace: true,
        });
        return;
      }
      if (data.session) navigate('/onboarding', { replace: true });
      else setMsg('Account created — check your inbox to confirm, then sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" sub="Free to start, no card needed">
      <div className="grid gap-4">
        <Field label="Full name">
          <TextInput
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Email">
          <TextInput
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password" hint="At least 6 characters.">
          <PasswordInput
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && register()}
          />
        </Field>
        <Button size="large" className="mt-1 w-full" disabled={busy} onClick={register}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </div>
      {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}
      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
