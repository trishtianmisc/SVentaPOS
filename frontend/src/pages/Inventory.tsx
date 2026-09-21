import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { Badge, Button, Field, PageHeader, Section, Select, Table, TextInput } from '../components/ui';
import { useInventory, useProducts } from '../hooks/useCatalog';

export default function InventoryPage() {
  // Shared keys: product list comes from the same cache as POS (no extra
  // request); stock list is the store-scoped inventory cache.
  const inventoryQ = useInventory();
  const productsQ = useProducts();
  const qc = useQueryClient();
  const rows = inventoryQ.data ?? [];
  const products = productsQ.data ?? [];

  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState('');

  const adjustM = useMutation({
    mutationFn: () =>
      api.post('/inventory/adjust', {
        product_id: productId,
        quantity: Number(qty),
        movement_type: Number(qty) >= 0 ? 'PURCHASE' : 'ADJUSTMENT',
        reason: reason.trim(),
      }),
    onSuccess: () => {
      setProductId('');
      setQty('');
      setReason('');
      setMsg('');
      qc.invalidateQueries({ queryKey: qk.inventory });
    },
    onError: (e: any) =>
      setMsg(e.response?.data?.error?.message ?? 'Adjust failed'),
  });

  const err = msg || (inventoryQ.error ? 'Could not load inventory.' : '');

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader title="Inventory" sub="Stock levels and adjustments by store" />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Section title="Adjust stock">
          <div className="grid gap-3">
            <Field label="Product">
              <Select value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">Select product…</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Quantity" hint="Positive receives stock, negative removes it.">
              <TextInput
                placeholder="+/- qty"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Reason">
              <TextInput
                placeholder="Required, e.g. delivery from supplier"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Button
              disabled={adjustM.isPending || !productId || !qty || !reason.trim()}
              onClick={() => adjustM.mutate()}
            >
              {adjustM.isPending ? 'Adjusting…' : 'Adjust stock'}
            </Button>
          </div>
          {err && <p className="mt-3 text-[13px] text-red-600">{err}</p>}
        </Section>
        <Section title="Stock levels">
          <Table head={['Product', 'On hand', 'Status']}>
            {rows.map((r) => {
              const low =
                (r.reorder_level ?? 0) > 0 && r.quantity <= (r.reorder_level ?? 0);
              return (
                <tr key={r.product_id}>
                  <td className="px-3 py-2 first:pl-0">{r.product_name ?? r.product_id}</td>
                  <td className="px-3 py-2 text-right">{r.quantity}</td>
                  <td className="px-3 py-2 text-right last:pr-0">
                    {r.quantity <= 0 ? (
                      <Badge tone="red">Out of stock</Badge>
                    ) : low ? (
                      <Badge tone="amber">Low</Badge>
                    ) : (
                      <Badge tone="green">OK</Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </Table>
          {rows.length === 0 && !inventoryQ.isPending && (
            <p className="py-2 text-sm text-gray-400">No stock rows yet.</p>
          )}
        </Section>
      </div>
    </div>
  );
}
