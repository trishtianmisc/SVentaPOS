import { useEffect, useState } from 'react';
import { api } from '../lib/api-client';
import { formatPHP } from '../utils/currency';

interface Sale {
  id: string;
  receipt_number: string;
  total: number;
  status: string;
}

export default function SalesPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [detail, setDetail] = useState<any>(null);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    api
      .get('/sales')
      .then((r) => setSales(r.data.data))
      .catch((e) => setMsg(e.response?.data?.error?.message ?? 'Load failed'));
  }, []);

  const open = async (id: string) => {
    const res = await api.get(`/sales/${id}`);
    setDetail(res.data.data);
  };

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Sales history</h1>
      {msg && <p className="mt-2 text-sm">{msg}</p>}
      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border bg-white p-4">
          <ul className="divide-y">
        {sales.map((s) => (
          <li key={s.id} className="flex justify-between py-2">
            <button className="text-teal-700" onClick={() => open(s.id)}>
              {s.receipt_number}
            </button>
            <span>
              {formatPHP(s.total)} · {s.status}
            </span>
          </li>
        ))}
      </ul>
        </section>
        <section className="h-fit rounded-xl border bg-white p-4">
          {detail ? (
            <>
              <p className="font-bold">Receipt {detail.receipt_number}</p>
              {detail.items?.map((i: any) => (
                <p key={i.id}>
                  {i.product_name_snapshot} × {i.quantity} — {formatPHP(i.line_total)}
                </p>
              ))}
              <p className="mt-2">Total: {formatPHP(detail.total)}</p>
            </>
          ) : (
            <p className="text-sm text-gray-400">Select a receipt to view details.</p>
          )}
        </section>
      </div>
    </div>
  );
}
