import { useEffect, useRef, useState, type ReactNode } from 'react';
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
      <span className="mb-1.5 block text-sm font-medium text-gray-700">{label}</span>
      {children}
      {hint && !error && <span className="mt-1.5 block text-xs text-gray-400">{hint}</span>}
      {error && <span className="mt-1.5 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

const inputCls =
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function PasswordInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input
        {...props}
        type={show ? 'text' : 'password'}
        className={`${inputCls} pr-10 ${className}`}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={(e) => {
          e.preventDefault();
          setShow((v) => !v);
        }}
        className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-1 focus:ring-primary"
      >
        {show ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M2 2l12 12" />
            <path d="M6.4 6.4a2 2 0 002.8 2.8" />
            <path d="M4.1 4.1C2.7 5 1.7 6.4 1 8c1.4 2.7 4 4.5 7 4.5 1.1 0 2.2-.2 3.2-.7" />
            <path d="M6.6 3.7c.5-.1 1-.2 1.4-.2 3 0 5.6 1.8 7 4.5-.4.8-1 1.6-1.7 2.3" />
          </svg>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M1 8s2.5-4.5 7-4.5S15 8 15 8s-2.5 4.5-7 4.5S1 8 1 8z" />
            <circle cx="8" cy="8" r="2" />
          </svg>
        )}
      </button>
    </span>
  );
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

function BrandMark({ tone = 'onDark' }: { tone?: 'onDark' | 'onLight' }) {
  const tones = {
    onDark: 'bg-white/15 text-white',
    onLight: 'bg-primary-soft text-primary',
  } as const;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}
    >
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 7h14l-1.4 13H6.4L5 7Z" />
        <path d="M9 7V6a3 3 0 0 1 6 0v1" />
      </svg>
    </span>
  );
}

export function AuthShell({
  title,
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
  const perks = [
    'Ring up sales in seconds with a touch-first checkout.',
    'Track inventory and staff across every store.',
    'Live reports so you always know where you stand.',
  ];
  return (
    <div className="flex min-h-dvh bg-gray-50">
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary via-primary-hover to-[#312e81] p-12 text-white lg:flex">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/10"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-white/5"
        />
        <div className="relative flex items-center gap-2.5">
          <BrandMark />
          <span className="text-base font-semibold tracking-tight">VentaPOS</span>
        </div>
        <div className="relative max-w-md space-y-7">
          <h2 className="text-[28px] font-semibold leading-[1.25] tracking-[-0.02em]">
            The point of sale that keeps your store moving.
          </h2>
          <ul className="space-y-4 text-[15px] leading-relaxed text-white/80">
            {perks.map((item) => (
              <li key={item} className="flex gap-3">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 20 20"
                  fill="none"
                  className="mt-0.5 shrink-0"
                  aria-hidden="true"
                >
                  <circle cx="10" cy="10" r="9" fill="currentColor" fillOpacity="0.2" />
                  <path
                    d="M6 10.2l2.4 2.4L14 7.5"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">© {new Date().getFullYear()} VentaPOS</p>
      </aside>
      <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-6 flex items-center gap-2.5 lg:hidden">
            <BrandMark tone="onLight" />
            <span className="font-semibold tracking-tight text-primary-ink">VentaPOS</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{sub}</p>
          <div className="mt-6">{children}</div>
          <ToastHost />
        </div>
      </main>
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
