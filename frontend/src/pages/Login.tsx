import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';

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
      try {
        const stores = await api.get('/stores');
        const list = stores.data.data ?? [];
        const current = localStorage.getItem('ventapos:storeId');
        if (list.length === 1) {
          localStorage.setItem('ventapos:storeId', list[0].id);
        } else if (current && !list.some((s: any) => s.id === current)) {
          localStorage.removeItem('ventapos:storeId');
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
      <div className="w-full max-w-sm rounded-2xl border bg-white p-6 shadow-sm">
        <h1 className="text-xl font-bold text-teal-800">VentaPOS</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in to your store</p>
        <input
          className="mt-4 w-full rounded-lg border p-2"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <input
          className="mt-2 w-full rounded-lg border p-2"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && login()}
        />
        <button className="mt-3 w-full rounded-lg bg-teal-700 p-2 text-white" onClick={login}>
          Sign in
        </button>
        {msg && <p className="mt-2 text-sm">{msg}</p>}
      </div>
    </div>
  );
}
