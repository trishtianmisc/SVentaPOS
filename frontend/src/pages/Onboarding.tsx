import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { landingPathFor } from '../lib/role-perms';
import { Button, Field, AuthShell, TextInput } from '../components/ui';

export default function OnboardingPage() {
  const [shop, setShop] = useState('');
  const [store, setStore] = useState('Main Store');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const inviteToken = params.get('token');

  // Accounts that already finished onboarding go straight to POS / Owner Hub.
  // Invite links skip "create my business" — accept joins an existing org.
  useEffect(() => {
    if (inviteToken) {
      navigate(`/accept-invite?token=${encodeURIComponent(inviteToken)}`, {
        replace: true,
      });
      return;
    }
    api
      .get('/auth/me')
      .then(async (r) => {
        if (!r.data.data.organization_id) {
          setChecking(false);
          return;
        }
        let landing = '/pos';
        try {
          const stores = await api.get('/stores');
          landing = landingPathFor(stores.data.data ?? []);
        } catch {
          // best-effort
        }
        navigate(landing, { replace: true });
      })
      .catch(() => setChecking(false));
  }, [navigate, inviteToken]);

  const submit = async () => {
    setMsg('');
    if (!shop.trim() || !store.trim()) {
      setMsg('Enter your business name and store name.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/organizations', {
        name: shop.trim(),
        store_name: store.trim(),
      });
      const { organization, store: st } = res.data.data;
      localStorage.setItem('ventapos:orgId', organization.id);
      useSessionStore.getState().setStore(st.id);
      // Fresh org creators are owners → land on the Owner Hub.
      navigate('/owner-hub', { replace: true });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Setup failed, please retry.');
    } finally {
      setBusy(false);
    }
  };

  if (checking) return <div className="p-6">Loading…</div>;

  return (
    <AuthShell
      title="Set up your business"
      sub="One step — your shop, first store, and owner access are created together."
    >
      <div className="grid gap-3">
        <Field label="Business name" hint="e.g. Aling Nena's Sari-Sari Store">
          <TextInput value={shop} onChange={(e) => setShop(e.target.value)} />
        </Field>
        <Field label="First store" hint="e.g. Main Store">
          <TextInput value={store} onChange={(e) => setStore(e.target.value)} />
        </Field>
        <Button
          size="large"
          className="w-full"
          disabled={busy}
          onClick={submit}
        >
          {busy ? 'Creating…' : 'Create my store'}
        </Button>
      </div>
      {msg && <p className="mt-3 text-[13px] text-red-600">{msg}</p>}
    </AuthShell>
  );
}
