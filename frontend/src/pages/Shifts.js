import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { useSessionStore } from '../stores/session';
import { Badge, EmptyState, PageHeader, Section, Spinner, Table, } from '../components/ui';
export default function ShiftsPage() {
    const [shifts, setShifts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [msg, setMsg] = useState('');
    const storeVersion = useSessionStore((s) => s.storeVersion);
    useEffect(() => {
        setLoading(true);
        api
            .get('/shifts')
            .then((r) => setShifts(r.data.data ?? []))
            .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'))
            .finally(() => setLoading(false));
    }, [storeVersion]);
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Shifts", sub: "Opening float, close-out, and cash variance" }), msg && _jsx("p", { className: "mb-4 text-[13px] text-red-600", children: msg }), _jsx(Section, { action: _jsxs("span", { className: "text-[13px] text-gray-500", children: [shifts.length, " shift", shifts.length === 1 ? '' : 's'] }), children: loading ? (_jsx(Spinner, { label: "Loading shifts\u2026" })) : shifts.length === 0 ? (_jsx(EmptyState, { title: "No shifts yet", hint: "Open one from the POS register to start selling." })) : (_jsx(Table, { head: [
                        'Opened by',
                        'Opened',
                        'Float',
                        'Closed by',
                        'Closed',
                        'Expected',
                        'Counted',
                        'Variance',
                    ], children: shifts.map((s) => (_jsxs("tr", { children: [_jsx("td", { className: "px-3 py-2 text-[13px] text-gray-500 first:pl-0", children: s.opened_by_name || '—' }), _jsx("td", { className: "px-3 py-2", children: s.opened_at
                                    ? new Date(s.opened_at).toLocaleString([], {
                                        month: 'short',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })
                                    : '—' }), _jsx("td", { className: "px-3 py-2 text-right", children: formatPHP(s.opening_float ?? 0) }), _jsx("td", { className: "px-3 py-2 text-[13px] text-gray-500", children: s.closed_by_name || '—' }), _jsx("td", { className: "px-3 py-2 text-right", children: s.closed_at ? (new Date(s.closed_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })) : (_jsx(Badge, { tone: "green", children: "OPEN" })) }), _jsx("td", { className: "px-3 py-2 text-right", children: s.expected_cash != null ? formatPHP(s.expected_cash) : '—' }), _jsx("td", { className: "px-3 py-2 text-right", children: s.counted_cash != null ? formatPHP(s.counted_cash) : '—' }), _jsx("td", { className: "px-3 py-2 text-right last:pr-0", children: s.variance != null ? (_jsx(Badge, { tone: Number(s.variance) === 0 ? 'green' : 'red', children: formatPHP(s.variance) })) : ('—') })] }, s.id))) })) })] }));
}
