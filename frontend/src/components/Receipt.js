import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import { formatPHP } from '../utils/currency';
import { formatQty } from '../lib/units';
import { longDate, longTime, shortDate, shortTime } from '../utils/receipt';
export function Receipt({ sale, items = [], payments = [], storeInfo, cashierName = '', method, at, onClose, closeLabel = 'Close', printLabel = 'Print', secondaryAction, footer, onCloseExtra, }) {
    const moment = at ?? (sale.created_at ? new Date(sale.created_at) : new Date());
    const tax = Number(sale.tax_amount ?? 0);
    const rate = Number(sale.tax_rate ?? 0);
    const subtotal = sale.subtotal != null
        ? Number(sale.subtotal)
        : Math.round((sale.total - tax) * 100) / 100;
    const addressLines = (storeInfo?.address ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    const qtyOf = (i) => i.unit_quantity ?? i.quantity ?? 0;
    const unitOf = (i) => i.unit_name ?? 'pc';
    const close = () => {
        onCloseExtra?.();
        onClose?.();
    };
    useEffect(() => {
        const onKey = (e) => {
            if (e.key === 'Escape')
                close();
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [onClose, onCloseExtra]);
    return createPortal(_jsx("div", { id: "rcpt-portal", role: "dialog", "aria-modal": "true", "aria-label": `Receipt ${sale.receipt_number}`, className: "fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 print:static print:block print:bg-transparent sm:items-center", onMouseDown: (e) => {
            if (e.target === e.currentTarget)
                close();
        }, children: _jsxs("div", { className: "receipt-80 relative w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none", children: [_jsx("button", { type: "button", "aria-label": "Close receipt", onClick: close, className: "absolute right-3 top-3 z-10 rounded-lg p-1.5 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600 print:hidden", children: "\u00D7" }), _jsxs("div", { className: "flex justify-between text-[11px] leading-tight", children: [_jsxs("span", { children: [shortDate(moment), ", ", shortTime(moment)] }), _jsx("span", { children: sale.receipt_number })] }), _jsxs("div", { className: "mt-2 text-center leading-tight", children: [_jsx("p", { className: "font-bold uppercase tracking-wide", children: storeInfo?.name ?? 'Store' }), addressLines.map((line, idx) => (_jsx("p", { className: "text-[11px]", children: line }, idx)))] }), _jsx("div", { className: "rcpt-sep" }), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Receipt #:" }), _jsx("span", { children: sale.receipt_number })] }), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Date:" }), _jsx("span", { children: longDate(moment) })] }), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Time:" }), _jsx("span", { children: longTime(moment) })] }), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Cashier:" }), _jsx("span", { children: cashierName || '—' })] }), _jsx("div", { className: "rcpt-sep" }), items.length === 0 && (_jsx("p", { className: "py-1 text-center text-[11px] text-gray-500", children: "Loading items\u2026" })), items.map((i, idx) => (_jsxs("div", { className: "mb-1", children: [_jsxs("div", { className: "rcpt-row", children: [_jsx("span", { className: "min-w-0 truncate pr-2", children: i.product_name_snapshot }), _jsx("span", { className: "shrink-0", children: formatPHP(i.line_total ?? 0) })] }), _jsxs("div", { className: "pl-3 text-[11px]", children: [formatQty(Number(qtyOf(i))), " \u00D7 ", formatPHP(i.unit_price ?? 0), ' ', unitOf(i) !== 'pc' ? unitOf(i) : ''] })] }, i.id ?? idx))), _jsx("div", { className: "rcpt-sep" }), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Subtotal:" }), _jsx("span", { children: formatPHP(subtotal) })] }), tax > 0 && (_jsxs("div", { className: "rcpt-row", children: [_jsxs("span", { children: ["VAT (Added ", rate || 12, "%):"] }), _jsx("span", { children: formatPHP(tax) })] })), (sale.discount_amount ?? 0) > 0 && (_jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Discount:" }), _jsxs("span", { children: ["\u2212", formatPHP(sale.discount_amount ?? 0)] })] })), _jsxs("div", { className: "rcpt-row font-bold", children: [_jsx("span", { children: "TOTAL:" }), _jsx("span", { children: formatPHP(sale.total) })] }), _jsx("div", { className: "rcpt-sep" }), (payments.length
                    ? payments
                    : [{ payment_method: method, amount: sale.paid }]).map((p, idx) => (_jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: idx === 0 ? 'Payment:' : '' }), _jsx("span", { className: "capitalize", children: p.payment_method ?? method ?? '—' })] }, idx))), _jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Cash:" }), _jsx("span", { children: formatPHP(sale.paid ?? sale.total) })] }), (sale.change ?? 0) > 0 && (_jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Change:" }), _jsx("span", { children: formatPHP(sale.change ?? 0) })] })), (sale.utang ?? 0) > 0 && (_jsxs("div", { className: "rcpt-row", children: [_jsx("span", { children: "Balance:" }), _jsx("span", { children: formatPHP(sale.balance ?? 0) })] })), _jsx("div", { className: "rcpt-sep" }), _jsx("p", { className: "mt-1 text-center text-[11px]", children: "Thank you for your business!" }), _jsxs("p", { className: "mt-3 text-center text-[11px] leading-snug", children: ["Not valid for tax claim.", _jsx("br", {}), "For internal record only."] }), _jsxs("p", { className: "mt-3 text-center text-[10px] leading-snug text-gray-500", children: ["Powered by VentaPOS", _jsx("br", {}), "Multi-unit selling ready"] }), footer ?? (_jsxs("div", { className: "mt-5 grid grid-cols-2 gap-2 print:hidden", children: [_jsx("button", { className: "h-10 rounded-lg border border-gray-300 text-sm font-medium", onClick: close, children: closeLabel }), _jsx("button", { className: "h-10 rounded-lg bg-primary text-sm font-medium text-white", onClick: () => window.print(), children: printLabel }), secondaryAction] }))] }) }), document.body);
}
