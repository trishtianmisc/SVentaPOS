import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, TextInput } from '../components/ui';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

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
      if (data.session) navigate('/onboarding', { replace: true });
      else setMsg('Account created — check your inbox to confirm, then sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Create your account" sub="Free to start, no card needed">
      <div className="grid gap-3">
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
          <TextInput
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && register()}
          />
        </Field>
        <Button size="large" className="w-full" disabled={busy} onClick={register}>
          {busy ? 'Creating…' : 'Create account'}
        </Button>
      </div>
      {msg && <p className="mt-3 text-[13px]">{msg}</p>}
      <p className="mt-4 text-center text-[13px] text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-primary">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
