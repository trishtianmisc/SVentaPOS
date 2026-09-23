import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';
import { useSessionStore } from '../stores/session';
import {
  Badge,
  EmptyState,
  PageHeader,
  Section,
  Spinner,
  Table,
} from '../components/ui';

interface ShiftRow {
  id: string;
  opened_at?: string;
  closed_at?: string | null;
  opened_by_name?: string | null;
  closed_by_name?: string | null;
  opening_float?: number;
  expected_cash?: number | null;
  counted_cash?: number | null;
  variance?: number | null;
  status?: string;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
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

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Shifts"
        sub="Opening float, close-out, and cash variance"
      />
      {msg && <p className="mb-4 text-[13px] text-red-600">{msg}</p>}
      <Section
        action={
          <span className="text-[13px] text-gray-500">
            {shifts.length} shift{shifts.length === 1 ? '' : 's'}
          </span>
        }
      >
        {loading ? (
          <Spinner label="Loading shifts…" />
        ) : shifts.length === 0 ? (
          <EmptyState
            title="No shifts yet"
            hint="Open one from the POS register to start selling."
          />
        ) : (
          <Table
            head={[
              'Opened by',
              'Opened',
              'Float',
              'Closed by',
              'Closed',
              'Expected',
              'Counted',
              'Variance',
            ]}
          >
            {shifts.map((s) => (
              <tr key={s.id}>
                <td className="px-3 py-2 text-[13px] text-gray-500 first:pl-0">
                  {s.opened_by_name || '—'}
                </td>
                <td className="px-3 py-2">
                  {s.opened_at
                    ? new Date(s.opened_at).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {formatPHP(s.opening_float ?? 0)}
                </td>
                <td className="px-3 py-2 text-[13px] text-gray-500">
                  {s.closed_by_name || '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {s.closed_at ? (
                    new Date(s.closed_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  ) : (
                    <Badge tone="green">OPEN</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {s.expected_cash != null ? formatPHP(s.expected_cash) : '—'}
                </td>
                <td className="px-3 py-2 text-right">
                  {s.counted_cash != null ? formatPHP(s.counted_cash) : '—'}
                </td>
                <td className="px-3 py-2 text-right last:pr-0">
                  {s.variance != null ? (
                    <Badge tone={Number(s.variance) === 0 ? 'green' : 'red'}>
                      {formatPHP(s.variance)}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Section>
    </div>
  );
}
