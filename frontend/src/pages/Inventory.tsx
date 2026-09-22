import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  ListFooter,
  PageHeader,
  Section,
  Select,
  Spinner,
  Table,
  TextInput,
  toast,
} from '../components/ui';
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
  const [moveType, setMoveType] = useState('AUTO');
  const [msg, setMsg] = useState('');
  const [moves, setMoves] = useState<any[]>([]);
  // Forecast: trailing-velocity restock estimates (see /reports/forecast).
  // Paid-plan feature (advanced_reports); 403 renders an upgrade lock.
  const [forecast, setForecast] = useState<any>(null);
  const [forecastLocked, setForecastLocked] = useState(false);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [poSupplier, setPoSupplier] = useState('');
  const [poBusy, setPoBusy] = useState('');

  useEffect(() => {
    api
      .get('/inventory/movements')
      .then((r) => setMoves((r.data.data ?? []).slice(0, 20)))
      .catch(() => undefined);
    api
      .get('/reports/forecast')
      .then((r) => setForecast(r.data.data))
      .catch((e: any) => {
        if (e.response?.status === 403) setForecastLocked(true);
      });
    api
      .get('/suppliers')
      .then((r) => setSuppliers(r.data.data ?? []))
      .catch(() => undefined);
  }, []);

  const draftPO = async (row: any) => {
    if (!poSupplier || !row.suggested_qty) return;
    setMsg('');
    setPoBusy(row.product_id);
    try {
      await api.post('/purchase-orders', {
        supplier_id: poSupplier,
        items: [
          {
            product_id: row.product_id,
            quantity: row.suggested_qty,
            unit_cost: row.cost_price ?? 0,
          },
        ],
      });
      toast('success', `PO drafted for ${row.product_name}`);
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'PO draft failed');
    } finally {
      setPoBusy('');
    }
  };

  const adjustM = useMutation({
    mutationFn: () => {
      const n = Number(qty);
      const type =
        moveType === 'AUTO'
          ? n >= 0
            ? 'PURCHASE'
            : 'ADJUSTMENT'
          : moveType;
      // Damage/Expired write-offs must be negative.
      const signed =
        (type === 'DAMAGE' || type === 'EXPIRED') && n > 0 ? -n : n;
      return api.post('/inventory/adjust', {
        product_id: productId,
        quantity: signed,
        movement_type: type,
        reason: reason.trim(),
      });
    },
    onSuccess: () => {
      setProductId('');
      setQty('');
      setReason('');
      setMsg('');
      toast('success', 'Stock adjusted');
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
        <div className="grid content-start gap-4">
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
              <Field label="Type">
                <Select value={moveType} onChange={(e) => setMoveType(e.target.value)}>
                  <option value="AUTO">Auto (receive if +, correction if −)</option>
                  <option value="PURCHASE">Received</option>
                  <option value="ADJUSTMENT">Correction</option>
                  <option value="DAMAGE">Damage write-off</option>
                  <option value="EXPIRED">Expired write-off</option>
                </Select>
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
          <Section title="Recent movements">
            {moves.length === 0 ? (
              <p className="py-2 text-sm text-gray-400">No movements yet.</p>
            ) : (
              <ul className="divide-y text-sm">
                {moves.map((m: any) => (
                  <li key={m.id} className="flex justify-between py-2">
                    <span>
                      <Badge tone="gray">{m.movement_type}</Badge>
                    </span>
                    <span className={Number(m.quantity) < 0 ? 'text-red-700' : ''}>
                      {Number(m.quantity) > 0 ? '+' : ''}
                      {m.quantity}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Section>
        </div>
        <Section
          title="Stock levels"
          action={
            <span className="text-[13px] text-gray-500">
              {rows.length} line{rows.length === 1 ? '' : 's'}
            </span>
          }
        >
          {inventoryQ.isPending ? (
            <Spinner label="Loading stock…" />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No stock rows yet"
              hint="Receive stock with an adjustment to create the first row."
            />
          ) : (
            <>
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
              <ListFooter count={rows.length} noun="line" />
            </>
          )}
        </Section>
      </div>
      <div className="mt-4">
        <Section
          title="Restock forecast"
          action={
            <span className="text-[13px] text-gray-500">
              {forecast
                ? `14-day velocity · as of ${forecast.as_of} · estimates`
                : 'Loading…'}
            </span>
          }
        >
          {!forecast || forecast.rows.length === 0 ? (
            forecastLocked ? (
              <div className="py-4 text-center">
                <p className="font-semibold">Restock forecast is a paid feature</p>
                <p className="mt-1 text-sm text-gray-500">
                  Upgrade to unlock demand forecasting.
                </p>
                <p className="mt-3">
                  <Link to="/billing" className="font-medium text-primary">
                    View plans →
                  </Link>
                </p>
              </div>
            ) : (
              <p className="py-2 text-sm text-gray-400">
                No restock signals — nothing is selling faster than its cover, or no
                sales in the last 14 days.
              </p>
            )
          ) : (
            <>
              <Field label="PO supplier" hint="One-click drafts order from this supplier.">
                <div className="max-w-xs">
                  <Select value={poSupplier} onChange={(e) => setPoSupplier(e.target.value)}>
                    <option value="">Select supplier…</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </Field>
              <Table head={['Product', 'On hand', 'Sells/day', 'Cover', 'Suggest', '']}>
                {forecast.rows.slice(0, 20).map((r: any) => (
                  <tr key={r.product_id}>
                    <td className="px-3 py-2 first:pl-0">{r.product_name}</td>
                    <td className="px-3 py-2 text-right">{r.on_hand}</td>
                    <td className="px-3 py-2 text-right">{r.daily_velocity}</td>
                    <td className="px-3 py-2 text-right">
                      {r.days_cover == null ? (
                        <Badge tone="gray">no sales</Badge>
                      ) : r.days_cover < 3 ? (
                        <Badge tone="red">{r.days_cover}d</Badge>
                      ) : r.days_cover < 7 ? (
                        <Badge tone="amber">{r.days_cover}d</Badge>
                      ) : (
                        <Badge tone="green">{r.days_cover}d</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {r.suggested_qty > 0 ? r.suggested_qty : '—'}
                    </td>
                    <td className="px-3 py-2 text-right last:pr-0">
                      {r.suggested_qty > 0 && (
                        <Button
                          variant="secondary"
                          disabled={!poSupplier || poBusy === r.product_id}
                          onClick={() => draftPO(r)}
                        >
                          {poBusy === r.product_id ? '…' : 'PO draft'}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </Table>
              <ListFooter count={Math.min(forecast.rows.length, 20)} noun="signal" />
            </>
          )}
        </Section>
      </div>
    </div>
  );
}
