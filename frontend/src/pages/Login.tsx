import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { Button, Field, TextInput } from '../components/ui';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const navigate = useNavigate();

  const login = async () => {
    setMsg('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setMsg(error.message);
      return;
    }
    try {
      const res = await api.get('/auth/me');
      const orgId = res.data.data.organization_id;
      if (orgId) localStorage.setItem('ventapos:orgId', orgId);
      // Persist active store so store-scoped endpoints (inventory, sales,
      // void) send X-Store-Id. Auto-select when the user has exactly 1.
      // setStore() also invalidates store-scoped caches for the new store.
      const setStore = useSessionStore.getState().setStore;
      try {
        const stores = await api.get('/stores');
        const list = stores.data.data ?? [];
        const current = useSessionStore.getState().storeId;
        if (list.length === 1) {
          setStore(list[0].id);
        } else if (current && !list.some((s: any) => s.id === current)) {
          setStore(null);
        }
        if (list.length === 0) {
          setMsg('Logged in — no store assigned yet. Ask an owner to add you.');
          return;
        }
      } catch {
        // stores lookup is best-effort; catalog still works via org role.
      }
      navigate('/pos', { replace: true });
    } catch {
      setMsg('Logged in (context pending)');
    }
  };

  useEffect(() => {
    document.title = 'Login — VentaPOS';
  }, []);

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-teal-800">VentaPOS</h1>
        <p className="mt-1 text-[13px] text-gray-500">Sign in to your store</p>
        <div className="mt-4 grid gap-3">
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
          <Button size="large" className="w-full" onClick={login}>
            Sign in
          </Button>
        </div>
        {msg && <p className="mt-3 text-[13px]">{msg}</p>}
      </div>
    </div>
  );
}
