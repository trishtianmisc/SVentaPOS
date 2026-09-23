import { createPortal } from 'react-dom';
import { useEffect, type ReactNode } from 'react';
import { formatPHP } from '../utils/currency';
import { formatQty } from '../lib/units';
import { longDate, longTime, shortDate, shortTime } from '../utils/receipt';

export interface ReceiptSale {
  receipt_number: string;
  total: number;
  paid?: number;
  change?: number;
  status: string;
  tax_amount?: number;
  tax_rate?: number;
  vatable_amount?: number;
  subtotal?: number;
  discount_amount?: number;
  utang?: number;
  balance?: number;
  created_at?: string;
}

export interface ReceiptItem {
  id?: string | number;
  product_name_snapshot?: string;
  quantity?: number;
  unit_quantity?: number;
  unit_name?: string | null;
  unit_price?: number;
  line_total?: number;
}

export interface ReceiptPayment {
  payment_method?: string | null;
  amount?: number;
  reference?: string | null;
}

export interface ReceiptStoreInfo {
  name?: string | null;
  address?: string | null;
  tin?: string | null;
}

interface ReceiptProps {
  sale: ReceiptSale;
  items?: ReceiptItem[];
  payments?: ReceiptPayment[];
  storeInfo?: ReceiptStoreInfo | null;
  cashierName?: string;
  /** Fallback method when payments[] is empty (POS pre-hydrate). */
  method?: string;
  at?: Date | null;
  onClose?: () => void;
  closeLabel?: string;
  printLabel?: string;
  /** Extra action-bar buttons (grid is already closed when this is set with footer). */
  secondaryAction?: ReactNode;
  /** Replace default New sale + Print footer entirely. */
  footer?: ReactNode;
  onCloseExtra?: () => void;
}

export function Receipt({
  sale,
  items = [],
  payments = [],
  storeInfo,
  cashierName = '',
  method,
  at,
  onClose,
  closeLabel = 'Close',
  printLabel = 'Print',
  secondaryAction,
  footer,
  onCloseExtra,
}: ReceiptProps) {
  const moment = at ?? (sale.created_at ? new Date(sale.created_at) : new Date());
  const tax = Number(sale.tax_amount ?? 0);
  const rate = Number(sale.tax_rate ?? 0);
  const subtotal =
    sale.subtotal != null
      ? Number(sale.subtotal)
      : Math.round((sale.total - tax) * 100) / 100;
  const addressLines = (storeInfo?.address ?? '')
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
  const qtyOf = (i: ReceiptItem) => i.unit_quantity ?? i.quantity ?? 0;
  const unitOf = (i: ReceiptItem) => i.unit_name ?? 'pc';

  const close = () => {
    onCloseExtra?.();
    onClose?.();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, onCloseExtra]);

  return createPortal(
    <div
      id="rcpt-portal"
      role="dialog"
      aria-modal="true"
      aria-label={`Receipt ${sale.receipt_number}`}
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/40 print:static print:block print:bg-transparent sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="receipt-80 relative w-full max-w-sm rounded-t-2xl bg-white p-6 sm:rounded-2xl print:max-w-none print:rounded-none print:p-0 print:shadow-none">
        <button
          type="button"
          aria-label="Close receipt"
          onClick={close}
          className="absolute right-3 top-3 z-10 rounded-lg p-1.5 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600 print:hidden"
        >
          ×
        </button>
        <div className="flex justify-between text-[11px] leading-tight">
          <span>
            {shortDate(moment)}, {shortTime(moment)}
          </span>
          <span>{sale.receipt_number}</span>
        </div>

        <div className="mt-2 text-center leading-tight">
          <p className="font-bold uppercase tracking-wide">
            {storeInfo?.name ?? 'Store'}
          </p>
          {addressLines.map((line: string, idx: number) => (
            <p key={idx} className="text-[11px]">
              {line}
            </p>
          ))}
        </div>

        <div className="rcpt-sep" />

        <div className="rcpt-row">
          <span>Receipt #:</span>
          <span>{sale.receipt_number}</span>
        </div>
        <div className="rcpt-row">
          <span>Date:</span>
          <span>{longDate(moment)}</span>
        </div>
        <div className="rcpt-row">
          <span>Time:</span>
          <span>{longTime(moment)}</span>
        </div>
        <div className="rcpt-row">
          <span>Cashier:</span>
          <span>{cashierName || '—'}</span>
        </div>

        <div className="rcpt-sep" />

        {items.length === 0 && (
          <p className="py-1 text-center text-[11px] text-gray-500">
            Loading items…
          </p>
        )}
        {items.map((i, idx) => (
          <div key={i.id ?? idx} className="mb-1">
            <div className="rcpt-row">
              <span className="min-w-0 truncate pr-2">
                {i.product_name_snapshot}
              </span>
              <span className="shrink-0">{formatPHP(i.line_total ?? 0)}</span>
            </div>
            <div className="pl-3 text-[11px]">
              {formatQty(Number(qtyOf(i)))} × {formatPHP(i.unit_price ?? 0)}{' '}
              {unitOf(i) !== 'pc' ? unitOf(i) : ''}
            </div>
          </div>
        ))}

        <div className="rcpt-sep" />

        <div className="rcpt-row">
          <span>Subtotal:</span>
          <span>{formatPHP(subtotal)}</span>
        </div>
        {tax > 0 && (
          <div className="rcpt-row">
            <span>VAT (Added {rate || 12}%):</span>
            <span>{formatPHP(tax)}</span>
          </div>
        )}
        {(sale.discount_amount ?? 0) > 0 && (
          <div className="rcpt-row">
            <span>Discount:</span>
            <span>−{formatPHP(sale.discount_amount ?? 0)}</span>
          </div>
        )}
        <div className="rcpt-row font-bold">
          <span>TOTAL:</span>
          <span>{formatPHP(sale.total)}</span>
        </div>

        <div className="rcpt-sep" />

        {(payments.length
          ? payments
          : [{ payment_method: method, amount: sale.paid }]
        ).map((p, idx) => (
          <div key={idx} className="rcpt-row">
            <span>{idx === 0 ? 'Payment:' : ''}</span>
            <span className="capitalize">
              {p.payment_method ?? method ?? '—'}
            </span>
          </div>
        ))}
        <div className="rcpt-row">
          <span>Cash:</span>
          <span>{formatPHP(sale.paid ?? sale.total)}</span>
        </div>
        {(sale.change ?? 0) > 0 && (
          <div className="rcpt-row">
            <span>Change:</span>
            <span>{formatPHP(sale.change ?? 0)}</span>
          </div>
        )}
        {(sale.utang ?? 0) > 0 && (
          <div className="rcpt-row">
            <span>Balance:</span>
            <span>{formatPHP(sale.balance ?? 0)}</span>
          </div>
        )}

        <div className="rcpt-sep" />

        <p className="mt-1 text-center text-[11px]">
          Thank you for your business!
        </p>
        <p className="mt-3 text-center text-[11px] leading-snug">
          Not valid for tax claim.
          <br />
          For internal record only.
        </p>
        <p className="mt-3 text-center text-[10px] leading-snug text-gray-500">
          Powered by VentaPOS
          <br />
          Multi-unit selling ready
        </p>

        {footer ?? (
          <div className="mt-5 grid grid-cols-2 gap-2 print:hidden">
            <button
              className="h-10 rounded-lg border border-gray-300 text-sm font-medium"
              onClick={close}
            >
              {closeLabel}
            </button>
            <button
              className="h-10 rounded-lg bg-primary text-sm font-medium text-white"
              onClick={() => window.print()}
            >
              {printLabel}
            </button>
            {secondaryAction}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
