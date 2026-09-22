import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, TextInput } from '../components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  const login = async () => {
    setMsg('');
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMsg(error.message);
        return;
      }
      queryClient.clear();
      navigate('/', { replace: true });
    } catch {
      setMsg('Sign in failed — try again');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="Platform admin" sub="Sign in to the VentaPOS admin console">
      <div className="grid gap-3">
        <Field label="Email">
          <TextInput
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field label="Password">
          <TextInput
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
        </Field>
        <Button size="large" className="w-full" disabled={busy} onClick={login}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </div>
      {msg && <p className="mt-3 text-[13px]">{msg}</p>}
    </AuthShell>
  );
}
