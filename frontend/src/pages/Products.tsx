import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useProducts } from '../hooks/useCatalog';

export default function ProductsPage() {
  // Shared with POS: one network request no matter which pages mount.
  const { data: items = [], error } = useProducts();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState('');

  const createM = useMutation({
    mutationFn: () =>
      api.post('/products', { name, retail_price: Number(price) }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setMsg('');
      // Writers invalidate; readers (here + POS) refetch once on next read.
      qc.invalidateQueries({ queryKey: qk.products });
    },
    onError: (e: any) =>
      setMsg(e.response?.data?.error?.message ?? 'Create failed'),
  });

  return (
    <div className="w-full p-4 md:p-6">
      <h1 className="text-xl font-bold">Products</h1>
      <div className="mt-4 grid gap-6 lg:grid-cols-[320px_1fr]">
        <section className="h-fit rounded-xl border bg-white p-4">
          <h2 className="text-sm font-semibold text-gray-700">Add product</h2>
          <div className="mt-2 grid gap-2">
            <input className="rounded-lg border p-2" placeholder="Name" value={name}
              onChange={(e) => setName(e.target.value)} />
            <input className="rounded-lg border p-2" placeholder="Price" value={price}
              onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
            <button
              className="rounded-lg bg-teal-700 p-2 text-white disabled:opacity-40"
              disabled={createM.isPending}
              onClick={() => createM.mutate()}
            >
              {createM.isPending ? 'Adding…' : 'Add'}
            </button>
          </div>
          {(msg || error) && (
            <p className="mt-2 text-sm text-red-600">
              {msg || 'Could not load products.'}
            </p>
          )}
        </section>
        <section className="rounded-xl border bg-white p-4">
          <ul className="divide-y">
        {items.map((p) => (
          <li key={p.id} className="flex justify-between py-2">
            <span>{p.name}</span>
            <span className="truncate text-xs text-gray-400">{p.id.slice(0, 8)}</span>
            <span>₱{Number(p.retail_price).toFixed(2)}</span>
          </li>
        ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
