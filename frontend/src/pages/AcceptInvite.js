import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase-client';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { queryClient } from '../app/queryClient';
import { AuthShell, Button, Field, PasswordInput, TextInput, toast } from '../components/ui';
import { roleLabel } from '../lib/role-perms';
async function completeAccept(token, navigate) {
    const res = await api.post('/users/accept', { token });
    const data = res.data.data;
    localStorage.setItem('ventapos:orgId', data.organization_id);
    if (data.store_id)
        useSessionStore.getState().setStore(data.store_id);
    queryClient.clear();
    toast('success', `Joined as ${roleLabel(data.role)}`);
    navigate(data.role === 'owner' ? '/owner-hub' : '/pos', { replace: true });
}
export default function AcceptInvitePage() {
    const [params] = useSearchParams();
    const token = params.get('token') ?? '';
    const navigate = useNavigate();
    const [meta, setMeta] = useState(null);
    const [peekErr, setPeekErr] = useState('');
    const [mode, setMode] = useState('loading');
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
                if (cancelled)
                    return;
                setMeta(peek.data.data);
                setEmail(peek.data.data.email ?? '');
            }
            catch (e) {
                if (!cancelled) {
                    setPeekErr(e.response?.data?.error?.message ?? 'Invite link is invalid or expired.');
                }
            }
            try {
                const { data } = await supabase.auth.getSession();
                if (cancelled)
                    return;
                if (data.session) {
                    await completeAccept(token, navigate);
                    return;
                }
            }
            catch {
                // fall through to auth UI
            }
            if (!cancelled)
                setMode('create');
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
            }
            else {
                setMsg('Check your inbox to confirm, then open the invite link again.');
            }
        }
        finally {
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
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Could not complete invite');
        }
        finally {
            setBusy(false);
        }
    };
    if (!token || peekErr) {
        return (_jsxs(AuthShell, { title: "Invite", sub: "This link is not valid", children: [_jsx("p", { className: "text-sm text-red-600", children: peekErr || 'Ask the owner to send a new invite.' }), _jsx("p", { className: "mt-4 text-center text-sm text-gray-500", children: _jsx(Link, { to: "/login", className: "font-medium text-primary", children: "Sign in" }) })] }));
    }
    if (mode === 'loading') {
        return _jsx("div", { className: "p-6", children: "Loading invite\u2026" });
    }
    const inviteLine = meta
        ? `You're invited as ${roleLabel(meta.role)}${meta.email ? ` · ${meta.email}` : ''}`
        : 'Create your account to join the store.';
    return (_jsxs(AuthShell, { title: "Join your store", sub: inviteLine, children: [_jsxs("div", { className: "grid gap-4", children: [mode === 'create' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Full name", children: _jsx(TextInput, { autoComplete: "name", value: name, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { label: "Email", hint: "Use the invited email.", children: _jsx(TextInput, { type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value), readOnly: !!meta?.email }) }), _jsx(Field, { label: "Password", hint: "At least 6 characters.", children: _jsx(PasswordInput, { autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && signUp() }) }), _jsx(Button, { size: "large", className: "w-full", disabled: busy, onClick: signUp, children: busy ? 'Creating…' : 'Create account & join' })] })), mode === 'signin' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "Email", children: _jsx(TextInput, { type: "email", autoComplete: "username", value: email, onChange: (e) => setEmail(e.target.value) }) }), _jsx(Field, { label: "Password", children: _jsx(PasswordInput, { autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && signIn() }) }), _jsx(Button, { size: "large", className: "w-full", disabled: busy, onClick: signIn, children: busy ? 'Signing in…' : 'Sign in & join' })] })), mode === 'create' && (_jsx("button", { type: "button", className: "text-center text-sm text-gray-500 underline", onClick: () => setMode('signin'), children: "Already have an account? Sign in" })), mode === 'signin' && (_jsx("button", { type: "button", className: "text-center text-sm text-gray-500 underline", onClick: () => setMode('create'), children: "Need an account? Create one" }))] }), msg && _jsx("p", { className: "mt-4 text-sm text-red-600", children: msg })] }));
}
