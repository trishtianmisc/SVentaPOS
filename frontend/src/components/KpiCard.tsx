import type { ReactNode } from 'react';

export type KpiTone = 'green' | 'teal' | 'blue' | 'rose' | 'amber';

const TONES: Record<KpiTone, string> = {
  green: 'bg-emerald-50 text-emerald-700 dark:bg-[#123528] dark:text-[#3dd68c]',
  teal: 'bg-teal-50 text-teal-700 dark:bg-[#0f2e2c] dark:text-[#2dd4bf]',
  blue: 'bg-blue-50 text-blue-700 dark:bg-[#15243a] dark:text-[#60a5fa]',
  rose: 'bg-rose-50 text-rose-700 dark:bg-[#2a1a1c] dark:text-[#f08a8a]',
  amber: 'bg-amber-50 text-amber-700 dark:bg-[#2a2210] dark:text-[#e8c86a]',
};

export function KpiCard({
  label,
  value,
  hint,
  badge,
  tone,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  badge?: string;
  tone: KpiTone;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-5 dark:border-[#1e1e22] dark:bg-[#121214]">
      <div className="flex items-start justify-between gap-2">
        <span
          aria-hidden
          className={`flex h-11 w-11 items-center justify-center rounded-2xl ${TONES[tone]}`}
        >
          {icon}
        </span>
        {badge && (
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-500 dark:bg-[#1a1a1e] dark:text-[#9b958c]">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-[#6f6a62]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
        {value}
      </p>
      <p className="mt-1 text-[13px] text-gray-500 dark:text-[#6f6a62]">{hint}</p>
    </div>
  );
}
