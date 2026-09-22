import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import {
  Badge,
  Button,
  Field,
  Modal,
  PageHeader,
  Section,
  Select,
  Spinner,
  TextInput,
  toast,
} from '../components/ui';

interface StoreRow {
  id: string;
  name: string;
  code: string;
  role: string;
  address?: string | null;
  phone?: string | null;
  tax_status?: string;
  vat_rate?: number;
  tin?: string | null;
}

export default function SettingsPage() {
  const sessionStoreId = useSessionStore((s) => s.storeId);
  const [stores, setStores] = useState<StoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [storeId, setStoreId] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [taxStatus, setTaxStatus] = useState('non_vat');
  const [vatRate, setVatRate] = useState('12');
  const [tin, setTin] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const setStore = useSessionStore((s) => s.setStore);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCode, setNewCode] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [createErr, setCreateErr] = useState('');
  const [limitHit, setLimitHit] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .get('/stores')
      .then((r) => {
        const list: StoreRow[] = r.data.data ?? [];
        setStores(list);
        const cur = list.find((s) => s.id === sessionStoreId) ?? list[0];
        if (cur) fill(cur);
      })
      .catch(() => setMsg('Could not load stores.'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fill = (s: StoreRow) => {
    setStoreId(s.id);
    setName(s.name ?? '');
    setAddress(s.address ?? '');
    setPhone(s.phone ?? '');
    setTaxStatus(s.tax_status ?? 'non_vat');
    setVatRate(String(s.vat_rate ?? 12));
    setTin(s.tin ?? '');
    setMsg('');
  };

  const current = stores.find((s) => s.id === storeId) ?? null;
  const canEdit = current && current.role !== 'cashier';
  const isOwner = stores.some((s) => s.role === 'owner');

  const resetCreate = () => {
    setNewName('');
    setNewCode('');
    setNewAddress('');
    setNewPhone('');
    setCreateErr('');
    setLimitHit(false);
  };

  const createStore = async () => {
    const name = newName.trim();
    const code = newCode.trim().toUpperCase();
    if (!name || !code) {
      setCreateErr('Store name and code are required.');
      return;
    }
    setCreating(true);
    setCreateErr('');
    setLimitHit(false);
    try {
      const res = await api.post('/stores', {
        name,
        code,
        address: newAddress.trim() || undefined,
        phone: newPhone.trim() || undefined,
      });
      const created: StoreRow = res.data.data;
      setStores([...stores, created]);
      fill(created);
      setStore(created.id);
      setShowCreate(false);
      resetCreate();
      toast('success', 'Store created');
    } catch (e: any) {
      if (e.response?.status === 403) setLimitHit(true);
      setCreateErr(
        e.response?.status === 409
          ? 'Store code already exists.'
          : (e.response?.data?.error?.message ?? 'Could not create store'),
      );
    } finally {
      setCreating(false);
    }
  };

  const save = async () => {
    if (!current || !canEdit) return;
    if (
      taxStatus === 'vat' &&
      current.tax_status !== 'vat' &&
      !window.confirm(
        'Switch to VAT-registered? Future sales will carve VAT out of vatable totals (prices stay as-is).',
      )
    )
      return;
    setSaving(true);
    setMsg('');
    try {
      const res = await api.patch('/stores/settings', {
        name: name.trim() || undefined,
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        tax_status: taxStatus,
        vat_rate: taxStatus === 'vat' ? Number(vatRate) : undefined,
        tin: tin.trim() || undefined,
      });
      const updated: StoreRow = res.data.data;
      setStores(stores.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
      toast('success', 'Settings saved');
    } catch (e: any) {
      setMsg(e.response?.data?.error?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="w-full p-4 md:p-6">
      <PageHeader
        title="Settings"
        sub="Store profile and tax"
        actions={
          <div className="flex items-center gap-2">
            {current && (
              <Badge tone={current.role === 'cashier' ? 'gray' : 'green'}>
                {current.role}
              </Badge>
            )}
            {isOwner && (
              <Button
                variant="secondary"
                onClick={() => {
                  resetCreate();
                  setShowCreate(true);
                }}
              >
                Add store
              </Button>
            )}
          </div>
        }
      />
      {loading ? (
        <Spinner label="Loading settings…" />
      ) : !current ? (
        <p className="text-sm text-gray-500">No store assigned yet.</p>
      ) : (
        <div className="grid max-w-2xl gap-4">
          {stores.length > 1 && (
            <Section title="Store">
              <Select value={storeId} onChange={(e) => {
                const s = stores.find((x) => x.id === e.target.value);
                if (s) fill(s);
              }}>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Section>
          )}
          {!canEdit && (
            <p className="rounded-xl bg-amber-50 p-4 text-sm text-amber-700">
              Owner or manager role required to change settings.
            </p>
          )}
          <Section title="Store profile">
            <div className="grid gap-3">
              <Field label="Store name">
                <TextInput value={name} disabled={!canEdit} onChange={(e) => setName(e.target.value)} />
              </Field>
              <Field label="Address" hint="Shown on printed receipts.">
                <TextInput value={address} disabled={!canEdit} onChange={(e) => setAddress(e.target.value)} />
              </Field>
              <Field label="Phone">
                <TextInput value={phone} disabled={!canEdit} onChange={(e) => setPhone(e.target.value)} />
              </Field>
            </div>
          </Section>
          <Section title="Tax (BIR)">
            <div className="grid gap-3">
              <Field label="Tax status">
                <Select value={taxStatus} disabled={!canEdit} onChange={(e) => setTaxStatus(e.target.value)}>
                  <option value="non_vat">Non-VAT</option>
                  <option value="vat">VAT-registered</option>
                </Select>
              </Field>
              {taxStatus === 'vat' && (
                <>
                  <Field label="VAT rate (%)" hint="12% standard. Shelf prices stay as-is; VAT is carved out of vatable totals.">
                    <TextInput
                      value={vatRate}
                      disabled={!canEdit}
                      inputMode="decimal"
                      onChange={(e) => setVatRate(e.target.value)}
                    />
                  </Field>
                  <Field label="TIN" hint="Shown on printed receipts.">
                    <TextInput value={tin} disabled={!canEdit} onChange={(e) => setTin(e.target.value)} />
                  </Field>
                </>
              )}
              <p className="text-[13px] text-gray-500">
                Mark VAT-exempt products on the Products page — they stay out of
                the VAT base. This app computes VAT for receipts and reports;
                it is not BIR accreditation.
              </p>
            </div>
          </Section>
          {msg && <p className="text-[13px] text-red-600">{msg}</p>}
          <div>
            <Button disabled={!canEdit || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
      {showCreate && (
        <Modal title="Add store" onClose={() => setShowCreate(false)}>
          <div className="grid gap-3">
            <Field label="Store name">
              <TextInput
                value={newName}
                autoFocus
                onChange={(e) => setNewName(e.target.value)}
              />
            </Field>
            <Field
              label="Store code"
              hint="Unique within your organization, e.g. BRANCH1."
            >
              <TextInput
                value={newCode}
                onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Address" hint="Shown on printed receipts.">
              <TextInput
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
            </Field>
            <Field label="Phone">
              <TextInput
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
              />
            </Field>
            {limitHit && (
              <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
                Plan limit reached — upgrade to add another store.{' '}
                <Link to="/billing" className="font-medium text-primary">
                  View plans →
                </Link>
              </p>
            )}
            {createErr && (
              <p className="text-[13px] text-red-600">{createErr}</p>
            )}
            <div className="flex gap-2">
              <Button
                disabled={creating || !newName.trim() || !newCode.trim()}
                onClick={createStore}
              >
                {creating ? 'Creating…' : 'Create store'}
              </Button>
              <Button variant="secondary" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
