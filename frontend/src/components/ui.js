import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useRef } from 'react';
import { create } from 'zustand';
export function Button({ variant = 'primary', size = 'normal', className = '', ...props }) {
    const heights = { compact: 'h-9', normal: 'h-10', large: 'h-12' };
    const styles = {
        primary: 'bg-primary text-white hover:bg-primary-hover',
        secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
        danger: 'bg-red-700 text-white hover:bg-red-800',
        ghost: 'text-primary hover:bg-primary-soft',
    };
    return (_jsx("button", { className: `rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${heights[size]} ${styles[variant]} ${className}`, ...props }));
}
export function Field({ label, hint, error, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1 block text-[13px] font-medium text-gray-700", children: label }), children, hint && !error && _jsx("span", { className: "mt-1 block text-xs text-gray-400", children: hint }), error && _jsx("span", { className: "mt-1 block text-xs text-red-600", children: error })] }));
}
const inputCls = 'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';
export function TextInput(props) {
    return _jsx("input", { ...props, className: `${inputCls} ${props.className ?? ''}` });
}
export function Select(props) {
    return _jsx("select", { ...props, className: `${inputCls} ${props.className ?? ''}` });
}
export function Badge({ tone = 'gray', children }) {
    const tones = {
        amber: 'bg-amber-100 text-amber-800',
        red: 'bg-red-100 text-red-800',
        green: 'bg-green-100 text-green-800',
        gray: 'bg-gray-100 text-gray-600',
        brand: 'bg-primary-soft text-primary-ink',
    };
    return (_jsx("span", { className: `inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`, children: children }));
}
export function Section({ title, action, children, }) {
    return (_jsxs("section", { className: "rounded-xl border border-gray-200 bg-white p-4", children: [(title || action) && (_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [title && _jsx("h2", { className: "text-base font-semibold", children: title }), action] })), children] }));
}
export function PageHeader({ title, sub, actions, }) {
    return (_jsxs("div", { className: "mb-4 flex flex-wrap items-center justify-between gap-2", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-xl font-semibold md:text-2xl", children: title }), sub && _jsx("p", { className: "mt-1 text-[13px] text-gray-500", children: sub })] }), actions] }));
}
export function Table({ head, children }) {
    return (_jsx("div", { className: "-mx-4 overflow-x-auto px-4", children: _jsxs("table", { className: "w-full text-left text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-gray-200 text-xs text-gray-500", children: head.map((h, i) => (_jsx("th", { scope: "col", className: `px-3 py-2 font-medium first:pl-0 last:pr-0 ${i > 0 ? 'text-right' : ''}`, children: h }, h))) }) }), _jsx("tbody", { className: "divide-y divide-gray-100", children: children })] }) }));
}
export function Spinner({ label = 'Loading…' }) {
    return (_jsxs("p", { role: "status", "aria-live": "polite", className: "py-3 text-sm text-gray-500", children: [_jsx("span", { "aria-hidden": "true", className: "mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary align-[-2px]" }), label] }));
}
export function EmptyState({ title, hint }) {
    return (_jsxs("div", { className: "py-6 text-center", children: [_jsx("p", { className: "text-sm font-medium text-gray-700", children: title }), hint && _jsx("p", { className: "mt-1 text-[13px] text-gray-400", children: hint })] }));
}
export function ListFooter({ count, noun }) {
    return (_jsxs("p", { className: "mt-3 text-xs text-gray-400", children: ["Showing ", count, " ", noun, count === 1 ? '' : 's'] }));
}
export function SearchInput({ value, onChange, placeholder, label, }) {
    return (_jsxs("div", { className: "relative flex-1", children: [_jsx("label", { htmlFor: `search-${label}`, className: "sr-only", children: label }), _jsx("span", { "aria-hidden": "true", className: "pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400", children: _jsxs("svg", { width: "16", height: "16", viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "2", children: [_jsx("circle", { cx: "7", cy: "7", r: "5" }), _jsx("line", { x1: "11", y1: "11", x2: "14.5", y2: "14.5" })] }) }), _jsx("input", { id: `search-${label}`, className: "h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary", placeholder: placeholder, value: value, onChange: (e) => onChange(e.target.value) }), value && (_jsx("button", { type: "button", "aria-label": "Clear search", onClick: () => onChange(''), className: "absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600", children: "\u00D7" }))] }));
}
export function Modal({ title, onClose, children, wide, }) {
    const ref = useRef(null);
    useEffect(() => {
        ref.current?.focus();
        const onKey = (e) => {
            if (e.key === 'Escape')
                onClose();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center", onMouseDown: (e) => {
            if (e.target === e.currentTarget)
                onClose();
        }, children: _jsxs("div", { ref: ref, role: "dialog", "aria-modal": "true", "aria-label": title, tabIndex: -1, className: `max-h-[90dvh] w-full overflow-auto bg-white p-4 focus:outline-none sm:rounded-2xl md:p-6 ${wide ? 'max-w-lg' : 'max-w-sm rounded-t-2xl'}`, children: [_jsxs("div", { className: "mb-3 flex items-center justify-between", children: [_jsx("h2", { className: "text-base font-semibold", children: title }), _jsx("button", { type: "button", "aria-label": "Close dialog", onClick: onClose, className: "rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600", children: "\u00D7" })] }), children] }) }));
}
let toastSeq = 0;
export const useToastStore = create(() => ({ toasts: [] }));
export function toast(kind, text) {
    const id = ++toastSeq;
    useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
    setTimeout(() => {
        useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
    }, 4000);
}
export function AuthShell({ title, sub, children, }) {
    useEffect(() => {
        document.title = `${title} — VentaPOS`;
    }, [title]);
    return (_jsx("div", { className: "flex min-h-dvh items-center justify-center bg-gray-50 p-4", children: _jsxs("div", { className: "w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm", children: [_jsx("h1", { className: "text-xl font-semibold text-primary-ink", children: "VentaPOS" }), _jsx("p", { className: "mt-1 text-xl font-semibold", children: title }), _jsx("p", { className: "mt-1 text-[13px] text-gray-500", children: sub }), _jsx("div", { className: "mt-4", children: children }), _jsx(ToastHost, {})] }) }));
}
export function ToastHost() {
    const toasts = useToastStore((s) => s.toasts);
    if (toasts.length === 0)
        return null;
    const tones = {
        success: 'border-green-200 bg-green-50 text-green-800',
        error: 'border-red-200 bg-red-50 text-red-800',
        info: 'border-gray-200 bg-white text-gray-700',
    };
    return (_jsx("div", { "aria-live": "polite", className: "pointer-events-none fixed inset-x-0 top-2 z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 px-4", children: toasts.map((t) => (_jsx("p", { className: `rounded-xl border p-3 text-sm shadow-lg ${tones[t.kind]}`, children: t.text }, t.id))) }));
}
