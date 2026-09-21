import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { useProducts, type Product } from '../hooks/useCatalog';
import {
  Button,
  EmptyState,
  Field,
  ListFooter,
  Modal,
  PageHeader,
  SearchInput,
  Section,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';
import { formatPHP } from '../utils/currency';

export default function ProductsPage() {
  // Shared with POS: one network request no matter which pages mount.
  const { data: items = [], error, isPending } = useProducts();
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [msg, setMsg] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<Product | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCost, setEditCost] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.barcode ?? '').toLowerCase().includes(q),
    );
  }, [items, search]);

  const createM = useMutation({
    mutationFn: () =>
      api.post('/products', { name, retail_price: Number(price) }),
    onSuccess: () => {
      setName('');
      setPrice('');
      setMsg('');
      toast('success', 'Product created');
      // Writers invalidate; readers (here + POS) refetch once on next read.
      qc.invalidateQueries({ queryKey: qk.products });
    },
    onError: (e: any) =>
      setMsg(e.response?.data?.error?.message ?? 'Create failed'),
  });

  const openEdit = (p: Product) => {
    setEditing(p);
    setEditPrice(String(p.retail_price ?? ''));
    setEditCost(String((p as any).cost_price ?? ''));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setMsg('');
    try {
      await api.put(`/products/${editing.id}`, {
        retail_price: Number(editPrice),
        cost_price: editCost === '' ? undefined : Number(editCost),
      });
      setEditing(null);
      toast('success', 'Price updated');
      qc.invalidateQueries({ queryKey: qk.products });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Update failed');
    }
  };

  const deactivate = async (p: Product) => {
    if (!window.confirm(`Deactivate ${p.name}? It stays in past sales history.`))
      return;
    setMsg('');
    try {
      await api.delete(`/products/${p.id}`);
      toast('success', 'Product deactivated');
      qc.invalidateQueries({ queryKey: qk.products });
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Deactivate failed');
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Products"
        sub="Manage your product catalog"
        actions={
          <span className="text-[13px] text-gray-500">
            {items.length} product{items.length === 1 ? '' : 's'}
          </span>
        }
      />
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Section title="Add product">
          <div className="grid gap-3">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Retail price (₱)">
              <TextInput
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Button
              disabled={createM.isPending}
              onClick={() => createM.mutate()}
            >
              {createM.isPending ? 'Adding…' : 'Add product'}
            </Button>
          </div>
          {msg && <p className="mt-3 text-[13px] text-red-600">{msg}</p>}
        </Section>
        <Section
          title="Catalog"
          action={
            <div className="w-56">
              <SearchInput
                label="Search products"
                placeholder="Search name or barcode"
                value={search}
                onChange={setSearch}
              />
            </div>
          }
        >
          {isPending ? (
            <Spinner label="Loading products…" />
          ) : error ? (
            <p className="py-2 text-sm text-red-600">Could not load products.</p>
          ) : visible.length === 0 ? (
            <EmptyState
              title={search ? 'No products match' : 'No products yet'}
              hint={search ? 'Try a different search.' : 'Add your first product on the left.'}
            />
          ) : (
            <>
              <Table head={['Product', 'Price', 'Barcode', '']}>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 first:pl-0">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.id.slice(0, 8)}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{formatPHP(p.retail_price)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">
                      {p.barcode ?? '—'}
                    </td>
                    <td className="px-3 py-2 text-right last:pr-0">
                      <span className="inline-flex gap-1">
                        <Button size="compact" variant="secondary" onClick={() => openEdit(p)}>
                          Edit
                        </Button>
                        <Button size="compact" variant="ghost" onClick={() => deactivate(p)}>
                          Off
                        </Button>
                      </span>
                    </td>
                  </tr>
                ))}
              </Table>
              <ListFooter count={visible.length} noun="product" />
            </>
          )}
        </Section>
      </div>

      {editing && (
        <Modal title={`Edit ${editing.name}`} onClose={() => setEditing(null)}>
          <div className="grid gap-3">
            <Field label="Retail price (₱)">
              <TextInput
                value={editPrice}
                onChange={(e) => setEditPrice(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Cost price (₱)" hint="Used for profit reports.">
              <TextInput
                value={editCost}
                onChange={(e) => setEditCost(e.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Button onClick={saveEdit}>Save changes</Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
