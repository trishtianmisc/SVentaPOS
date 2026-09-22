import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
        }
        catch {
            setMsg('Sign in failed — try again');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsxs(AuthShell, { title: "Platform admin", sub: "Sign in to the VentaPOS admin console", children: [_jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Email", children: _jsx(TextInput, { type: "email", autoComplete: "username", value: email, onChange: (e) => setEmail(e.target.value) }) }), _jsx(Field, { label: "Password", children: _jsx(TextInput, { type: "password", autoComplete: "current-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && login() }) }), _jsx(Button, { size: "large", className: "w-full", disabled: busy, onClick: login, children: busy ? 'Signing in…' : 'Sign in' })] }), msg && _jsx("p", { className: "mt-3 text-[13px]", children: msg })] }));
}
