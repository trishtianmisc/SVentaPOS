import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
} from 'react';

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
    primary: 'bg-teal-700 text-white hover:bg-teal-800',
    secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100',
    danger: 'bg-red-700 text-white hover:bg-red-800',
    ghost: 'text-teal-700 hover:bg-teal-50',
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
  'h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600';

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputCls} ${props.className ?? ''}`} />;
}

type BadgeProps = {
  tone?: 'amber' | 'red' | 'green' | 'gray' | 'teal';
  children: ReactNode;
};

export function Badge({ tone = 'gray', children }: BadgeProps) {
  const tones = {
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-800',
    green: 'bg-green-100 text-green-800',
    gray: 'bg-gray-100 text-gray-600',
    teal: 'bg-teal-50 text-teal-800',
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
