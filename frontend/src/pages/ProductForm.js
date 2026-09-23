import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api-client';
import { qk } from '../lib/query-keys';
import { baseUnitName, validateUnitDraft } from '../lib/units';
import { useCategories, useProducts, useProductUnits } from '../hooks/useCatalog';
import SellUnitsEditor from '../components/SellUnitsEditor';
import { Button, Field, PageHeader, Section, Select, Spinner, TextInput, toast, } from '../components/ui';
const empty = {
    name: '',
    category_id: '',
    sku: '',
    barcode: '',
    brand: '',
    cost_price: '0',
    retail_price: '0',
    wholesale_price: '',
    wholesale_min_qty: '',
    minimum_stock: '0',
    reorder_level: '0',
    track_inventory: true,
    vat_exempt: false,
    image_path: '',
};
function num(v) {
    if (v.trim() === '')
        return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
}
/** Validate all unit drafts; keys match SellUnitsEditor draft keys. */
function validateUnits(units) {
    const errors = {};
    const names = units.map((u) => u.unit_name.trim()).filter(Boolean);
    const seen = new Set();
    units.forEach((u, i) => {
        const key = u.id ?? `new-${i}`;
        const err = validateUnitDraft({
            unit_name: u.unit_name,
            conversion_factor: u.conversion_factor,
            selling_price: u.selling_price,
        }, [], u.id);
        if (err) {
            errors[key] = err;
            return;
        }
        const lower = u.unit_name.trim().toLowerCase();
        if (seen.has(lower)) {
            errors[key] = `Duplicate unit name "${u.unit_name.trim()}".`;
            return;
        }
        seen.add(lower);
    });
    // Cross-row duplicates already covered by `seen` when names non-empty.
    void names;
    return errors;
}
export default function ProductFormPage() {
    const { productId } = useParams();
    /** Set after create so sell units can be saved against the new product. */
    const [createdId, setCreatedId] = useState(null);
    const activeId = productId ?? createdId;
    const isEdit = !!productId;
    const navigate = useNavigate();
    const qc = useQueryClient();
    const { data: categories = [], isPending: catsPending } = useCategories();
    const { data: products = [], isPending: productsPending } = useProducts();
    const unitsQ = useProductUnits(isEdit ? productId : createdId ?? undefined);
    const [form, setForm] = useState(empty);
    const [unitDrafts, setUnitDrafts] = useState([]);
    const [unitErrors, setUnitErrors] = useState({});
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [loaded, setLoaded] = useState(!isEdit);
    const unitsHydrated = useRef(false);
    const existing = useMemo(() => (isEdit ? products.find((p) => p.id === productId) : undefined), [isEdit, products, productId]);
    const productBase = baseUnitName(existing);
    useEffect(() => {
        if (!isEdit) {
            setForm(empty);
            setLoaded(true);
            return;
        }
        if (productsPending)
            return;
        if (!existing) {
            if (!productsPending) {
                setMsg('Product not found.');
                setLoaded(true);
            }
            return;
        }
        setForm({
            name: existing.name ?? '',
            category_id: existing.category_id ?? '',
            sku: existing.sku ?? '',
            barcode: existing.barcode ?? '',
            brand: existing.brand ?? '',
            cost_price: String(existing.cost_price ?? 0),
            retail_price: String(existing.retail_price ?? 0),
            wholesale_price: existing.wholesale_price != null ? String(existing.wholesale_price) : '',
            wholesale_min_qty: existing.wholesale_min_qty != null ? String(existing.wholesale_min_qty) : '',
            minimum_stock: String(existing.minimum_stock ?? 0),
            reorder_level: String(existing.reorder_level ?? 0),
            track_inventory: existing.track_inventory !== false,
            vat_exempt: !!existing.vat_exempt,
            image_path: existing.image_path ?? '',
        });
        setLoaded(true);
    }, [isEdit, existing, productsPending]);
    // Hydrate unit drafts once from the server (edit or post-create retry).
    useEffect(() => {
        if (!activeId || unitsHydrated.current)
            return;
        if (unitsQ.isPending)
            return;
        const rows = unitsQ.data ?? [];
        setUnitDrafts(rows.map((u) => ({
            id: u.id,
            unit_name: u.unit_name,
            conversion_factor: String(u.conversion_factor),
            selling_price: u.selling_price != null ? String(u.selling_price) : '',
            barcode: u.barcode ?? '',
        })));
        unitsHydrated.current = true;
    }, [activeId, unitsQ.isPending, unitsQ.data]);
    const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
    /**
     * Create/update/delete unit rows after the product itself is saved.
     * Returns human-readable failures; empty array = full success.
     */
    const saveUnits = async (pid) => {
        const prior = unitsQ.data ?? [];
        const keepIds = new Set(unitDrafts.map((u) => u.id).filter(Boolean));
        const failures = [];
        // 1) Remove units the user deleted (never touch unknown rows).
        for (const old of prior) {
            if (keepIds.has(old.id))
                continue;
            try {
                await api.delete(`/products/${pid}/units/${old.id}`);
            }
            catch (e) {
                failures.push(`remove "${old.unit_name}": ${e.response?.data?.error?.message ?? 'failed'}`);
            }
        }
        // 2) Create new / update existing (never bulk-delete then reinsert).
        for (let i = 0; i < unitDrafts.length; i++) {
            const u = unitDrafts[i];
            const name = u.unit_name.trim();
            const factor = Number(u.conversion_factor);
            const sp = u.selling_price.trim() === '' ? undefined : Number(u.selling_price);
            try {
                if (u.id) {
                    await api.put(`/products/${pid}/units/${u.id}`, {
                        unit_name: name,
                        conversion_factor: factor,
                        selling_price: sp === undefined ? null : sp,
                        barcode: u.barcode.trim() || null,
                    });
                }
                else {
                    const res = await api.post(`/products/${pid}/units`, {
                        unit_name: name,
                        conversion_factor: factor,
                        selling_price: sp,
                        barcode: u.barcode.trim() || null,
                    });
                    const created = res.data.data;
                    if (created?.id) {
                        setUnitDrafts((rows) => rows.map((r, j) => j === i ? { ...r, id: created.id } : r));
                    }
                }
            }
            catch (e) {
                failures.push(`"${name || `unit ${i + 1}`}": ${e.response?.data?.error?.message ?? 'failed'}`);
            }
        }
        if (failures.length === 0) {
            await Promise.all([
                qc.invalidateQueries({ queryKey: qk.productUnits }),
                qc.invalidateQueries({ queryKey: qk.units }),
            ]);
        }
        return failures;
    };
    const submit = async () => {
        setMsg('');
        setUnitErrors({});
        if (!form.name.trim()) {
            setMsg('Product name is required.');
            return;
        }
        const retail = num(form.retail_price);
        if (retail === undefined || retail < 0) {
            setMsg('Enter a valid retail price.');
            return;
        }
        const cost = num(form.cost_price) ?? 0;
        if (cost < 0) {
            setMsg('Cost price cannot be negative.');
            return;
        }
        const uErrs = validateUnits(unitDrafts);
        if (Object.keys(uErrs).length > 0) {
            setUnitErrors(uErrs);
            setMsg('Fix sell unit errors before saving.');
            return;
        }
        const body = {
            name: form.name.trim(),
            category_id: form.category_id || null,
            sku: form.sku.trim() || null,
            barcode: form.barcode.trim() || null,
            brand: form.brand.trim() || null,
            cost_price: cost,
            retail_price: retail,
            wholesale_price: num(form.wholesale_price) ?? null,
            wholesale_min_qty: num(form.wholesale_min_qty) ?? null,
            minimum_stock: num(form.minimum_stock) ?? 0,
            reorder_level: num(form.reorder_level) ?? 0,
            track_inventory: form.track_inventory,
            vat_exempt: form.vat_exempt,
            image_path: form.image_path.trim() || null,
        };
        setBusy(true);
        let pid = activeId;
        try {
            // 1) Create or update the product row first.
            if (isEdit) {
                await api.put(`/products/${productId}`, body);
                pid = productId;
            }
            else {
                const res = await api.post('/products', body);
                pid = res.data.data?.id ?? null;
                if (pid)
                    setCreatedId(pid);
            }
            qc.invalidateQueries({ queryKey: qk.products });
            qc.invalidateQueries({ queryKey: qk.categories });
            if (!pid) {
                if (unitDrafts.length > 0) {
                    setMsg('Product saved, but sell units could not be attached (missing product id). Retry Save.');
                }
                else {
                    toast('success', 'Product created');
                    navigate('/products', { replace: true });
                }
                return;
            }
            // 2) Persist unit configuration; never report success if this fails.
            if (unitDrafts.length > 0 || (isEdit && (unitsQ.data ?? []).length > 0)) {
                const failures = await saveUnits(pid);
                if (failures.length > 0) {
                    setMsg(`Product saved, but sell units failed — ${failures.length} issue(s): ${failures.join('; ')}`);
                    return;
                }
            }
            toast('success', isEdit ? 'Product updated' : 'Product created');
            navigate('/products', { replace: true });
        }
        catch (e) {
            setMsg(e.response?.data?.error?.message ?? 'Save failed');
        }
        finally {
            setBusy(false);
        }
    };
    if (!loaded || (isEdit && productsPending)) {
        return (_jsx("div", { className: "w-full p-4 md:p-6", children: _jsx(Spinner, { label: "Loading product\u2026" }) }));
    }
    if (isEdit && !existing) {
        return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: "Product", sub: msg || 'Not found' }), _jsx(Button, { variant: "secondary", onClick: () => navigate('/products'), children: "Back to products" })] }));
    }
    const submitLabel = busy
        ? 'Saving…'
        : createdId && !isEdit
            ? 'Save sell units'
            : isEdit
                ? 'Save changes'
                : unitDrafts.length > 0
                    ? 'Create product & units'
                    : 'Create product';
    return (_jsxs("div", { className: "w-full p-4 md:p-6", children: [_jsx(PageHeader, { title: isEdit
                    ? 'Edit product'
                    : createdId
                        ? 'Finish sell units'
                        : 'Add product', sub: isEdit
                    ? 'Update catalog details, pricing, inventory, and sell units'
                    : createdId
                        ? 'Product saved — review sell units, then save again'
                        : 'Create a catalog item with pricing, inventory, and sell units', actions: _jsx(Button, { variant: "secondary", onClick: () => navigate('/products'), children: "Cancel" }) }), msg && (_jsx("p", { className: "mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700", children: msg })), _jsxs("div", { className: "grid gap-4 lg:grid-cols-2", children: [_jsx(Section, { title: "Basic info", children: _jsxs("div", { className: "grid gap-3", children: [_jsx(Field, { label: "Name", hint: "Required. Shown on receipts and POS.", children: _jsx(TextInput, { value: form.name, onChange: (e) => set('name', e.target.value), placeholder: "e.g. Coke 350ml", maxLength: 200 }) }), _jsx(Field, { label: "Category", children: _jsxs(Select, { value: form.category_id, onChange: (e) => set('category_id', e.target.value), disabled: catsPending, children: [_jsx("option", { value: "", children: "Uncategorized" }), categories.map((c) => (_jsx("option", { value: c.id, children: c.name }, c.id)))] }) }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Brand", children: _jsx(TextInput, { value: form.brand, onChange: (e) => set('brand', e.target.value), placeholder: "Optional", maxLength: 120 }) }), _jsx(Field, { label: "SKU", hint: "Must be unique per organization.", children: _jsx(TextInput, { value: form.sku, onChange: (e) => set('sku', e.target.value), placeholder: "Optional", maxLength: 64 }) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Barcode / UPC", children: _jsx(TextInput, { value: form.barcode, onChange: (e) => set('barcode', e.target.value), placeholder: "Scan or type", maxLength: 64 }) }), _jsx(Field, { label: "Image URL", hint: "Optional product photo link.", children: _jsx(TextInput, { value: form.image_path, onChange: (e) => set('image_path', e.target.value), placeholder: "https://\u2026", maxLength: 500 }) })] })] }) }), _jsx(Section, { title: "Pricing", children: _jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Cost price (\u20B1)", hint: "Used for profit reports.", children: _jsx(TextInput, { value: form.cost_price, onChange: (e) => set('cost_price', e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Retail price (\u20B1)", hint: "Selling price at POS.", children: _jsx(TextInput, { value: form.retail_price, onChange: (e) => set('retail_price', e.target.value), inputMode: "decimal" }) })] }), _jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Wholesale price (\u20B1)", hint: "Optional bulk price.", children: _jsx(TextInput, { value: form.wholesale_price, onChange: (e) => set('wholesale_price', e.target.value), inputMode: "decimal", placeholder: "\u2014" }) }), _jsx(Field, { label: "Wholesale min qty", hint: "Compared against base-unit quantity.", children: _jsx(TextInput, { value: form.wholesale_min_qty, onChange: (e) => set('wholesale_min_qty', e.target.value), inputMode: "decimal", placeholder: "\u2014" }) })] }), _jsxs("label", { className: "flex items-center gap-2 text-[13px] text-gray-600", children: [_jsx("input", { type: "checkbox", checked: form.vat_exempt, onChange: (e) => set('vat_exempt', e.target.checked) }), "VAT exempt (excluded from the VAT base)"] })] }) }), _jsx(Section, { title: "Inventory", children: _jsxs("div", { className: "grid gap-3", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsx(Field, { label: "Minimum stock", hint: "In base units.", children: _jsx(TextInput, { value: form.minimum_stock, onChange: (e) => set('minimum_stock', e.target.value), inputMode: "decimal" }) }), _jsx(Field, { label: "Reorder level", hint: "In base units.", children: _jsx(TextInput, { value: form.reorder_level, onChange: (e) => set('reorder_level', e.target.value), inputMode: "decimal" }) })] }), _jsxs("label", { className: "flex items-center gap-2 text-[13px] text-gray-600", children: [_jsx("input", { type: "checkbox", checked: form.track_inventory, onChange: (e) => set('track_inventory', e.target.checked) }), "Track inventory (stock movements for this product)"] }), _jsx("p", { className: "text-xs text-gray-400", children: "Opening stock is adjusted from the Stock page. Inventory is deducted in base units." })] }) }), _jsx(Section, { title: "Preview", children: _jsxs("div", { className: "rounded-xl border border-gray-100 bg-gray-50 p-4", children: [_jsxs("div", { className: "flex items-start gap-3", children: [_jsx("span", { "aria-hidden": "true", className: "flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-900 text-gray-500", children: form.image_path ? (_jsx("img", { src: form.image_path, alt: "", className: "h-full w-full object-cover", onError: (e) => {
                                                    e.currentTarget.style.visibility =
                                                        'hidden';
                                                } })) : (_jsxs("svg", { width: "22", height: "22", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.5", children: [_jsx("path", { d: "M5 7h14l-1.4 13H6.4L5 7Z" }), _jsx("path", { d: "M9 7V6a3 3 0 0 1 6 0v1" })] })) }), _jsxs("div", { className: "min-w-0", children: [_jsx("p", { className: "font-medium text-gray-900", children: form.name.trim() || 'Product name' }), _jsxs("p", { className: "text-sm text-gray-500", children: [categories.find((c) => c.id === form.category_id)?.name ??
                                                            'Uncategorized', form.brand ? ` · ${form.brand}` : ''] }), _jsxs("p", { className: "mt-1 text-lg font-semibold", children: ["\u20B1", (Number(form.retail_price) || 0).toFixed(2)] })] })] }), _jsxs("dl", { className: "mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500", children: [_jsxs("div", { children: [_jsx("dt", { className: "font-medium text-gray-600", children: "SKU" }), _jsx("dd", { children: form.sku || '—' })] }), _jsxs("div", { children: [_jsx("dt", { className: "font-medium text-gray-600", children: "Barcode" }), _jsx("dd", { children: form.barcode || '—' })] }), _jsxs("div", { children: [_jsx("dt", { className: "font-medium text-gray-600", children: "Min / Reorder" }), _jsxs("dd", { children: [form.minimum_stock || 0, " / ", form.reorder_level || 0] })] }), _jsxs("div", { children: [_jsx("dt", { className: "font-medium text-gray-600", children: "VAT" }), _jsx("dd", { children: form.vat_exempt ? 'Exempt' : 'Standard' })] })] }), unitDrafts.length > 0 && (_jsxs("p", { className: "mt-2 text-xs text-gray-500", children: ["Sell units:", ' ', unitDrafts
                                            .map((u) => `1 ${u.unit_name.trim() || '?'} = ${u.conversion_factor} ${productBase}`)
                                            .join(' · ')] }))] }) }), _jsx("div", { className: "lg:col-span-2", children: _jsx(Section, { title: "Sell units", children: _jsx(SellUnitsEditor, { units: unitDrafts, onChange: (next) => {
                                    setUnitDrafts(next);
                                    setUnitErrors({});
                                }, baseUnit: productBase, disabled: busy, errors: unitErrors }) }) })] }), _jsxs("div", { className: "mt-6 flex flex-wrap items-center justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => navigate('/products'), disabled: busy, children: "Cancel" }), _jsx(Button, { onClick: submit, disabled: busy, children: submitLabel })] })] }));
}
