import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function Button({ variant = 'primary', size = 'normal', className = '', ...props }) {
    const heights = { compact: 'h-9', normal: 'h-10', large: 'h-12' };
    const styles = {
        primary: 'bg-teal-700 text-white hover:bg-teal-800',
        secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
        danger: 'bg-red-700 text-white hover:bg-red-800',
        ghost: 'text-teal-700 hover:bg-teal-50',
    };
    return (_jsx("button", { className: `rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${heights[size]} ${styles[variant]} ${className}`, ...props }));
}
export function Field({ label, hint, error, children }) {
    return (_jsxs("label", { className: "block", children: [_jsx("span", { className: "mb-1 block text-[13px] font-medium text-gray-700", children: label }), children, hint && !error && _jsx("span", { className: "mt-1 block text-xs text-gray-400", children: hint }), error && _jsx("span", { className: "mt-1 block text-xs text-red-600", children: error })] }));
}
const inputCls = 'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';
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
        teal: 'bg-teal-50 text-teal-800',
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
