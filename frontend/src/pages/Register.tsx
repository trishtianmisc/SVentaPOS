import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { Button, Field, TextInput } from '../components/ui';

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
      if (data.session) navigate('/onboarding', { replace: true });
      else setMsg('Account created — check your inbox to confirm, then sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-teal-800">Create your account</h1>
        <p className="mt-1 text-[13px] text-gray-500">Free to start, no card needed</p>
        <div className="mt-4 grid gap-3">
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
          <Link to="/login" className="font-medium text-teal-700">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
