import { Button, Field, TextInput } from './ui';

export type UnitDraft = {
  /** Server id when editing an existing unit; undefined for new rows. */
  id?: string;
  unit_name: string;
  conversion_factor: string;
  selling_price: string;
  barcode: string;
};

type Props = {
  units: UnitDraft[];
  onChange: (next: UnitDraft[]) => void;
  /** Implicit base unit label (today always 'pc'; Phase C may pass product.base_unit_name). */
  baseUnit?: string;
  disabled?: boolean;
  /** Shared validation errors keyed by draft key ("" for form-level). */
  errors?: Record<string, string>;
};

function draftKey(u: UnitDraft, index: number): string {
  return u.id ?? `new-${index}`;
}

export function emptyUnitDraft(): UnitDraft {
  return {
    unit_name: '',
    conversion_factor: '1',
    selling_price: '',
    barcode: '',
  };
}

export default function SellUnitsEditor({
  units,
  onChange,
  baseUnit = 'pc',
  disabled,
  errors = {},
}: Props) {
  const update = (index: number, patch: Partial<UnitDraft>) => {
    onChange(units.map((u, i) => (i === index ? { ...u, ...patch } : u)));
  };

  const remove = (index: number) => {
    onChange(units.filter((_, i) => i !== index));
  };

  const add = () => {
    onChange([...units, emptyUnitDraft()]);
  };

  return (
    <div className="grid gap-3">
      <p className="text-[13px] text-gray-500">
        Base unit is always{' '}
        <span className="font-medium text-gray-700">{baseUnit}</span>. Add sell
        units like <span className="font-medium">case</span>,{' '}
        <span className="font-medium">pack</span>, or{' '}
        <span className="font-medium">bundle</span>. Example: 1 case = 24{' '}
        {baseUnit}. Leave selling price blank to price linearly (base ×
        factor). Inventory is deducted in base units.
      </p>

      {errors[''] && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {errors['']}
        </p>
      )}

      {units.length === 0 && (
        <p className="text-sm text-gray-400">
          No extra sell units yet — the product sells as{' '}
          <span className="font-medium">{baseUnit}</span> only.
        </p>
      )}

      <ul className="grid gap-3">
        {units.map((u, i) => {
          const key = draftKey(u, i);
          const err = errors[key];
          return (
            <li
              key={key}
              className="rounded-xl border border-gray-200 bg-gray-50/60 p-3"
            >
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Unit name">
                  <TextInput
                    value={u.unit_name}
                    onChange={(e) => update(i, { unit_name: e.target.value })}
                    placeholder="e.g. case"
                    maxLength={32}
                    disabled={disabled}
                  />
                </Field>
                <Field
                  label={`Factor (÷ ${baseUnit})`}
                  hint={`1 unit = N ${baseUnit}`}
                >
                  <TextInput
                    value={u.conversion_factor}
                    onChange={(e) =>
                      update(i, { conversion_factor: e.target.value })
                    }
                    inputMode="decimal"
                    placeholder="24"
                    disabled={disabled}
                  />
                </Field>
                <Field label="Selling price (₱)" hint="Optional fixed price">
                  <TextInput
                    value={u.selling_price}
                    onChange={(e) => update(i, { selling_price: e.target.value })}
                    inputMode="decimal"
                    placeholder="Linear"
                    disabled={disabled}
                  />
                </Field>
                <Field label="Unit barcode" hint="Optional">
                  <TextInput
                    value={u.barcode}
                    onChange={(e) => update(i, { barcode: e.target.value })}
                    placeholder="Optional"
                    maxLength={64}
                    disabled={disabled}
                  />
                </Field>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[13px] text-gray-500">
                  {Number(u.conversion_factor) > 0
                    ? `1 ${u.unit_name.trim() || 'unit'} = ${u.conversion_factor} ${baseUnit}`
                    : 'Enter a conversion factor'}
                </p>
                <Button
                  size="compact"
                  variant="ghost"
                  onClick={() => remove(i)}
                  disabled={disabled}
                  type="button"
                >
                  Remove
                </Button>
              </div>
              {err && <p className="mt-1 text-xs text-red-600">{err}</p>}
            </li>
          );
        })}
      </ul>

      <div>
        <Button
          type="button"
          variant="secondary"
          size="compact"
          onClick={add}
          disabled={disabled}
        >
          + Add sell unit
        </Button>
      </div>
    </div>
  );
}
