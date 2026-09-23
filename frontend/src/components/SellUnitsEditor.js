import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Button, Field, TextInput } from './ui';
function draftKey(u, index) {
    return u.id ?? `new-${index}`;
}
export function emptyUnitDraft() {
    return {
        unit_name: '',
        conversion_factor: '1',
        selling_price: '',
        barcode: '',
    };
}
export default function SellUnitsEditor({ units, onChange, baseUnit = 'pc', disabled, errors = {}, }) {
    const update = (index, patch) => {
        onChange(units.map((u, i) => (i === index ? { ...u, ...patch } : u)));
    };
    const remove = (index) => {
        onChange(units.filter((_, i) => i !== index));
    };
    const add = () => {
        onChange([...units, emptyUnitDraft()]);
    };
    return (_jsxs("div", { className: "grid gap-3", children: [_jsxs("p", { className: "text-[13px] text-gray-500", children: ["Base unit is always", ' ', _jsx("span", { className: "font-medium text-gray-700", children: baseUnit }), ". Add sell units like ", _jsx("span", { className: "font-medium", children: "case" }), ",", ' ', _jsx("span", { className: "font-medium", children: "pack" }), ", or", ' ', _jsx("span", { className: "font-medium", children: "bundle" }), ". Example: 1 case = 24", ' ', baseUnit, ". Leave selling price blank to price linearly (base \u00D7 factor). Inventory is deducted in base units."] }), errors[''] && (_jsx("p", { className: "rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700", children: errors[''] })), units.length === 0 && (_jsxs("p", { className: "text-sm text-gray-400", children: ["No extra sell units yet \u2014 the product sells as", ' ', _jsx("span", { className: "font-medium", children: baseUnit }), " only."] })), _jsx("ul", { className: "grid gap-3", children: units.map((u, i) => {
                    const key = draftKey(u, i);
                    const err = errors[key];
                    return (_jsxs("li", { className: "rounded-xl border border-gray-200 bg-gray-50/60 p-3", children: [_jsxs("div", { className: "grid gap-2 sm:grid-cols-2 lg:grid-cols-4", children: [_jsx(Field, { label: "Unit name", children: _jsx(TextInput, { value: u.unit_name, onChange: (e) => update(i, { unit_name: e.target.value }), placeholder: "e.g. case", maxLength: 32, disabled: disabled }) }), _jsx(Field, { label: `Factor (÷ ${baseUnit})`, hint: `1 unit = N ${baseUnit}`, children: _jsx(TextInput, { value: u.conversion_factor, onChange: (e) => update(i, { conversion_factor: e.target.value }), inputMode: "decimal", placeholder: "24", disabled: disabled }) }), _jsx(Field, { label: "Selling price (\u20B1)", hint: "Optional fixed price", children: _jsx(TextInput, { value: u.selling_price, onChange: (e) => update(i, { selling_price: e.target.value }), inputMode: "decimal", placeholder: "Linear", disabled: disabled }) }), _jsx(Field, { label: "Unit barcode", hint: "Optional", children: _jsx(TextInput, { value: u.barcode, onChange: (e) => update(i, { barcode: e.target.value }), placeholder: "Optional", maxLength: 64, disabled: disabled }) })] }), _jsxs("div", { className: "mt-2 flex items-center justify-between gap-2", children: [_jsx("p", { className: "text-[13px] text-gray-500", children: Number(u.conversion_factor) > 0
                                            ? `1 ${u.unit_name.trim() || 'unit'} = ${u.conversion_factor} ${baseUnit}`
                                            : 'Enter a conversion factor' }), _jsx(Button, { size: "compact", variant: "ghost", onClick: () => remove(i), disabled: disabled, type: "button", children: "Remove" })] }), err && _jsx("p", { className: "mt-1 text-xs text-red-600", children: err })] }, key));
                }) }), _jsx("div", { children: _jsx(Button, { type: "button", variant: "secondary", size: "compact", onClick: add, disabled: disabled, children: "+ Add sell unit" }) })] }));
}
