import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, PasswordInput, TextInput, toast } from '../components/ui';
export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();
    // Already signed in (revisited /login): leave once org context is known.
    // Mid-login does not re-run this — login() owns that navigation.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (!data.session || cancelled)
                    return;
                const res = await api.get('/auth/me');
                if (cancelled)
                    return;
                const orgId = res.data.data.organization_id;
                if (orgId)
                    localStorage.setItem('ventapos:orgId', orgId);
                navigate(orgId ? '/pos' : '/onboarding', { replace: true });
            }
            catch {
                // Stay on the form; user can retry or sign in again.
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [navigate]);
    const login = async () => {
        setMsg('');
        setBusy(true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                setMsg(error.message);
                return;
            }
            // Fresh session: drop any rows cached under a previous account before
            // fetching context, so they can never flash on screen.
            queryClient.clear();
            const res = await api.get('/auth/me');
            const orgId = res.data.data.organization_id;
            if (orgId)
                localStorage.setItem('ventapos:orgId', orgId);
            // Persist active store so store-scoped endpoints (inventory, sales,
            // void) send X-Store-Id. Auto-select when the user has exactly 1.
            // setStore() also invalidates store-scoped caches for the new store.
            const setStore = useSessionStore.getState().setStore;
            let storeCount = -1;
            try {
                const stores = await api.get('/stores');
                const list = stores.data.data ?? [];
                storeCount = list.length;
                const current = useSessionStore.getState().storeId;
                if (list.length === 1) {
                    setStore(list[0].id);
                }
                else if (current && !list.some((s) => s.id === current)) {
                    setStore(null);
                }
            }
            catch {
                // stores lookup is best-effort; catalog still works via org role.
            }
            if (!orgId) {
                navigate('/onboarding', { replace: true });
                return;
            }
            if (storeCount === 0) {
                setMsg('Logged in — no store assigned yet. Ask an owner to add you.');
                return;
            }
            toast('success', 'Signed in');
            navigate('/pos', { replace: true });
        }
        catch {
            setMsg('Logged in (context pending)');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(AuthShell, { title: "Sign in", sub: "Sign in to your store", children: [_jsxs("div", { className: "grid gap-4", children: [_jsx(Field, { label: "Email", children: _jsx(TextInput, { type: "email", autoComplete: "username", value: email, onChange: (e) => setEmail(e.target.value) }) }), _jsx(Field, { label: "Password", children: _jsx(PasswordInput, { autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && login() }) }), _jsx(Button, { size: "large", className: "mt-1 w-full", disabled: busy, onClick: login, children: busy ? 'Signing in…' : 'Sign in' })] }), msg && _jsx("p", { className: "mt-4 text-sm text-red-600", children: msg }), _jsxs("p", { className: "mt-6 text-center text-sm text-gray-500", children: ["New here?", ' ', _jsx(Link, { to: "/register", className: "font-medium text-primary hover:text-primary-hover", children: "Create an account" })] })] }));
}
