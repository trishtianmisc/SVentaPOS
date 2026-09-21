import { useEffect, useRef, type ReactNode } from 'react';
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
} from 'react';
import { create } from 'zustand';

/* Spacing/type scale: 4/8/12/16/20/24/32. Titles text-xl md:text-2xl semibold,
   body 14px, helper 12-13px. Buttons h-10 (compact h-9, large h-12). */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'compact' | 'normal' | 'large';
};

export function Button({
  variant = 'primary',
  size = 'normal',
  className = '',
  ...props
}: ButtonProps) {
  const heights = { compact: 'h-9', normal: 'h-10', large: 'h-12' } as const;
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    ghost: 'text-primary hover:bg-primary-soft',
  } as const;
  return (
    <button
      className={`rounded-lg px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${heights[size]} ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function Field({ label, hint, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputCls =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

type BadgeProps = {
  tone?: 'amber' | 'red' | 'green' | 'gray' | 'brand';
  children: ReactNode;
};

export function Badge({ tone = 'gray', children }: BadgeProps) {
  const tones = {
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    gray: 'bg-gray-100 text-gray-600',
    brand: 'bg-primary-soft text-primary-ink',
  } as const;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Section({
  title,
  action,
  children,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      {(title || action) && (
        <div className="mb-3 flex items-center justify-between">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  sub,
  actions,
}: {
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h1 className="text-xl font-semibold md:text-2xl">{title}</h1>
        {sub && <p className="mt-1 text-[13px] text-gray-500">{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-xs text-gray-500">
            {head.map((h, i) => (
              <th
                key={h}
                scope="col"
                className={`px-3 py-2 font-medium first:pl-0 last:pr-0 ${
                  i > 0 ? 'text-right' : ''
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <p role="status" aria-live="polite" className="py-3 text-sm text-gray-500">
      <span aria-hidden="true" className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-primary align-[-2px]" />
      {label}
    </p>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-sm font-medium text-gray-700">{title}</p>
      {hint && <p className="mt-1 text-[13px] text-gray-400">{hint}</p>}
    </div>
  );
}

export function ListFooter({ count, noun }: { count: number; noun: string }) {
  return (
    <p className="mt-3 text-xs text-gray-400">
      Showing {count} {noun}
      {count === 1 ? '' : 's'}
    </p>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  label,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  label: string;
}) {
  return (
    <div className="relative flex-1">
      <label htmlFor={`search-${label}`} className="sr-only">
        {label}
      </label>
      <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="7" cy="7" r="5" />
          <line x1="11" y1="11" x2="14.5" y2="14.5" />
        </svg>
      </span>
      <input
        id={`search-${label}`}
        className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-9 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`max-h-[90dvh] w-full overflow-auto bg-white p-4 focus:outline-none sm:rounded-2xl md:p-6 ${
          wide ? 'max-w-lg' : 'max-w-sm rounded-t-2xl'
        }`}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-xl leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  text: string;
}

let toastSeq = 0;

export const useToastStore = create<{ toasts: Toast[] }>(() => ({ toasts: [] }));

export function toast(kind: Toast['kind'], text: string) {
  const id = ++toastSeq;
  useToastStore.setState((s) => ({ toasts: [...s.toasts.slice(-2), { id, kind, text }] }));
  setTimeout(() => {
    useToastStore.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  }, 4000);
}

export function AuthShell({  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: ReactNode;
}) {
  useEffect(() => {
    document.title = `${title} — VentaPOS`;
  }, [title]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-primary-ink">VentaPOS</h1>
        <p className="mt-1 text-xl font-semibold">{title}</p>
        <p className="mt-1 text-[13px] text-gray-500">{sub}</p>
        <div className="mt-4">{children}</div>
        <ToastHost />
      </div>
    </div>
  );
}

export function ToastHost() {
  const toasts = useToastStore((s) => s.toasts);
  if (toasts.length === 0) return null;
  const tones = {
    success: 'border-green-200 bg-green-50 text-green-800',
    error: 'border-red-200 bg-red-50 text-red-800',
    info: 'border-gray-200 bg-white text-gray-700',
  } as const;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-2 z-[60] mx-auto flex w-full max-w-sm flex-col gap-2 px-4">
      {toasts.map((t) => (
        <p key={t.id} className={`rounded-xl border p-3 text-sm shadow-lg ${tones[t.kind]}`}>
          {t.text}
        </p>
      ))}
    </div>
  );
}
