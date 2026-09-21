import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
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
            if (data.session)
                navigate('/onboarding', { replace: true });
            else
                setMsg('Account created — check your inbox to confirm, then sign in.');
        }
        finally {
            setBusy(false);
        }
    };
    return (_jsx("div", { className: "flex min-h-dvh items-center justify-center bg-gray-50 p-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm", children: [_jsx("h1", { className: "text-xl font-semibold text-teal-800", children: "Create your account" }), _jsx("p", { className: "mt-1 text-[13px] text-gray-500", children: "Free to start, no card needed" }), _jsxs("div", { className: "mt-4 grid gap-3", children: [_jsx(Field, { label: "Full name", children: _jsx(TextInput, { autoComplete: "name", value: name, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { label: "Email", children: _jsx(TextInput, { type: "email", autoComplete: "email", value: email, onChange: (e) => setEmail(e.target.value) }) }), _jsx(Field, { label: "Password", hint: "At least 6 characters.", children: _jsx(TextInput, { type: "password", autoComplete: "new-password", value: password, onChange: (e) => setPassword(e.target.value), onKeyDown: (e) => e.key === 'Enter' && register() }) }), _jsx(Button, { size: "large", className: "w-full", disabled: busy, onClick: register, children: busy ? 'Creating…' : 'Create account' })] }), msg && _jsx("p", { className: "mt-3 text-[13px]", children: msg }), _jsxs("p", { className: "mt-4 text-center text-[13px] text-gray-500", children: ["Already have an account?", ' ', _jsx(Link, { to: "/login", className: "font-medium text-teal-700", children: "Sign in" })] })] }) }));
}
