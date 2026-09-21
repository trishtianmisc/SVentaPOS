import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { Button, Field, AuthShell, TextInput } from '../components/ui';
export default function OnboardingPage() {
    const [shop, setShop] = useState('');
    const [store, setStore] = useState('Main Store');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [checking, setChecking] = useState(true);
    const navigate = useNavigate();
    // Accounts that already finished onboarding go straight to POS.
    useEffect(() => {
        api
            .get('/auth/me')
            .then((r) => {
            if (r.data.data.organization_id)
                navigate('/pos', { replace: true });
            else
                setChecking(false);
        })
            .catch(() => setChecking(false));
    }, [navigate]);
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
            navigate('/pos', { replace: true });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Setup failed, please retry.');
        }
        finally {
            setBusy(false);
        }
    };
    if (checking)
        return _jsx("div", { className: "p-6", children: "Loading\u2026" });
    return (_jsxs(AuthShell, { title: "Set up your business", sub: "One step \u2014 your shop, first store, and owner access are created together.", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Business name", hint: "e.g. Aling Nena's Sari-Sari Store", children: _jsx(TextInput, { value: shop, onChange: (e) => setShop(e.target.value) }) }), _jsx(Field, { label: "First store", hint: "e.g. Main Store", children: _jsx(TextInput, { value: store, onChange: (e) => setStore(e.target.value) }) }), _jsx(Button, { size: "large", className: "w-full", disabled: busy, onClick: submit, children: busy ? 'Creating…' : 'Create my store' })] }), msg && _jsx("p", { className: "mt-3 text-[13px] text-red-600", children: msg })] }));
}
