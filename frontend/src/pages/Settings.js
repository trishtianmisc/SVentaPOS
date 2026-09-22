import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api-client';
import { useSessionStore } from '../stores/session';
import { Badge, Button, Field, Modal, PageHeader, Section, Select, Spinner, TextInput, toast, } from '../components/ui';
export default function SettingsPage() {
    const sessionStoreId = useSessionStore((s) => s.storeId);
    const [stores, setStores] = useState([]);
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
            const list = r.data.data ?? [];
            setStores(list);
            const cur = list.find((s) => s.id === sessionStoreId) ?? list[0];
            if (cur)
                fill(cur);
        })
            .catch(() => setMsg('Could not load stores.'))
            .finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const fill = (s) => {
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
            const created = res.data.data;
            setStores([...stores, created]);
            fill(created);
            setStore(created.id);
            setShowCreate(false);
            resetCreate();
            toast('success', 'Store created');
        }
        catch (e) {
            if (e.response?.status === 403)
                setLimitHit(true);
            setCreateErr(e.response?.status === 409
                ? 'Store code already exists.'
                : (e.response?.data?.error?.message ?? 'Could not create store'));
        }
        finally {
            setCreating(false);
        }
    };
    const save = async () => {
        if (!current || !canEdit)
            return;
        if (taxStatus === 'vat' &&
            current.tax_status !== 'vat' &&
            !window.confirm('Switch to VAT-registered? Future sales will carve VAT out of vatable totals (prices stay as-is).'))
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
            const updated = res.data.data;
            setStores(stores.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)));
            toast('success', 'Settings saved');
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Save failed');
        }
        finally {
            setSaving(false);
        }
    };
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Settings", sub: "Store profile and tax", actions: _jsxs("div", { className: "flex items-center gap-2", children: [current && (_jsx(Badge, { tone: current.role === 'cashier' ? 'gray' : 'green', children: current.role })), isOwner && (_jsx(Button, { variant: "secondary", onClick: () => {
                                resetCreate();
                                setShowCreate(true);
                            }, children: "Add store" }))] }) }), loading ? (_jsx(Spinner, { label: "Loading settings\u2026" })) : !current ? (_jsx("p", { className: "text-sm text-gray-500", children: "No store assigned yet." })) : (_jsxs("div", { className: "grid max-w-2xl gap-4", children: [stores.length > 1 && (_jsx(Section, { title: "Store", children: _jsx(Select, { value: storeId, onChange: (e) => {
                                const s = stores.find((x) => x.id === e.target.value);
                                if (s)
                                    fill(s);
                            }, children: stores.map((s) => (_jsx("option", { value: s.id, children: s.name }, s.id))) }) })), !canEdit && (_jsx("p", { className: "rounded-xl bg-amber-50 p-4 text-sm text-amber-700", children: "Owner or manager role required to change settings." })), _jsx(Section, { title: "Store profile", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Store name", children: _jsx(TextInput, { value: name, disabled: !canEdit, onChange: (e) => setName(e.target.value) }) }), _jsx(Field, { label: "Address", hint: "Shown on printed receipts.", children: _jsx(TextInput, { value: address, disabled: !canEdit, onChange: (e) => setAddress(e.target.value) }) }), _jsx(Field, { label: "Phone", children: _jsx(TextInput, { value: phone, disabled: !canEdit, onChange: (e) => setPhone(e.target.value) }) })] }) }), _jsx(Section, { title: "Tax (BIR)", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Tax status", children: _jsxs(Select, { value: taxStatus, disabled: !canEdit, onChange: (e) => setTaxStatus(e.target.value), children: [_jsx("option", { value: "non_vat", children: "Non-VAT" }), _jsx("option", { value: "vat", children: "VAT-registered" })] }) }), taxStatus === 'vat' && (_jsxs(_Fragment, { children: [_jsx(Field, { label: "VAT rate (%)", hint: "12% standard. Shelf prices stay as-is; VAT is carved out of vatable totals.", children: _jsx(TextInput, { value: vatRate, disabled: !canEdit, inputMode: "decimal", onChange: (e) => setVatRate(e.target.value) }) }), _jsx(Field, { label: "TIN", hint: "Shown on printed receipts.", children: _jsx(TextInput, { value: tin, disabled: !canEdit, onChange: (e) => setTin(e.target.value) }) })] })), _jsx("p", { className: "text-[13px] text-gray-500", children: "Mark VAT-exempt products on the Products page \u2014 they stay out of the VAT base. This app computes VAT for receipts and reports; it is not BIR accreditation." })] }) }), msg && _jsx("p", { className: "text-[13px] text-red-600", children: msg }), _jsx("div", { children: _jsx(Button, { disabled: !canEdit || saving, onClick: save, children: saving ? 'Saving…' : 'Save changes' }) })] })), showCreate && (_jsx(Modal, { title: "Add store", onClose: () => setShowCreate(false), children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Store name", children: _jsx(TextInput, { value: newName, autoFocus: true, onChange: (e) => setNewName(e.target.value) }) }), _jsx(Field, { label: "Store code", hint: "Unique within your organization, e.g. BRANCH1.", children: _jsx(TextInput, { value: newCode, onChange: (e) => setNewCode(e.target.value.toUpperCase()) }) }), _jsx(Field, { label: "Address", hint: "Shown on printed receipts.", children: _jsx(TextInput, { value: newAddress, onChange: (e) => setNewAddress(e.target.value) }) }), _jsx(Field, { label: "Phone", children: _jsx(TextInput, { value: newPhone, onChange: (e) => setNewPhone(e.target.value) }) }), limitHit && (_jsxs("p", { className: "rounded-xl bg-amber-50 p-3 text-sm text-amber-700", children: ["Plan limit reached \u2014 upgrade to add another store.", ' ', _jsx(Link, { to: "/billing", className: "font-medium text-primary", children: "View plans \u2192" })] })), createErr && (_jsx("p", { className: "text-[13px] text-red-600", children: createErr })), _jsxs("div", { className: "flex gap-2", children: [_jsx(Button, { disabled: creating || !newName.trim() || !newCode.trim(), onClick: createStore, children: creating ? 'Creating…' : 'Create store' }), _jsx(Button, { variant: "secondary", onClick: () => setShowCreate(false), children: "Cancel" })] })] }) }))] }));
}
