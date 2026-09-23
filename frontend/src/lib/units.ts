/**
 * Reusable sell-unit helpers for multi-unit products.
 *
 * Stock and wholesale always run in BASE units (today: implicit 'pc').
 * New code should read base_unit_name when the product has it (Phase C);
 * never hardcode 'pc' as the only possible base label.
 */

export interface UnitLike {
  id?: string;
  product_id?: string;
  unit_name: string;
  conversion_factor: number | string;
  selling_price?: number | string | null;
  cost_price?: number | string | null;
  barcode?: string | null;
}

export type UnitKind = 'measurement' | 'count';

/** Measurement / weight units — allow decimal quantities. */
export const MEASUREMENT_UNITS = [
  'kg',
  'g',
  'mg',
  'l',
  'lt',
  'liter',
  'litre',
  'liter',
  'ml',
  'm',
  'cm',
  'mm',
] as const;

/** Count / package units — whole-number quantities by default. */
export const COUNT_UNITS = [
  'pc',
  'pcs',
  'piece',
  'pieces',
  'pack',
  'packs',
  'box',
  'boxes',
  'case',
  'cases',
  'bundle',
  'bundles',
  'dozen',
  'dozens',
  'carton',
  'cartons',
  'sack',
  'sacks',
] as const;

const MEASUREMENT_SET = new Set<string>(MEASUREMENT_UNITS);
const COUNT_SET = new Set<string>(COUNT_UNITS);

/** Default base unit label until products.base_unit_name ships (Phase C). */
export const DEFAULT_BASE_UNIT = 'pc';

/**
 * Classify a unit name. Unknown names default to 'count' (safe: whole steps).
 * Extend MEASUREMENT_UNITS / COUNT_UNITS rather than branching in POS.
 */
export function classifyUnit(unitName: string | null | undefined): UnitKind {
  const n = (unitName ?? '').trim().toLowerCase();
  if (!n) return 'count';
  if (MEASUREMENT_SET.has(n)) return 'measurement';
  if (COUNT_SET.has(n)) return 'count';
  return 'count';
}

export function isMeasurementUnit(unitName: string | null | undefined): boolean {
  return classifyUnit(unitName) === 'measurement';
}

/** +/- step for a unit: 0.01 for kg/L-style, 1 for packs/cases. */
export function qtyStep(unitName: string): number {
  return isMeasurementUnit(unitName) ? 0.01 : 1;
}

/**
 * Round for display / cart storage.
 * Measurement: 2 decimal places. Count: snap near-integers; otherwise keep
 * decimals (e.g. 15 pc → 1.5 pack after a unit switch — do not lose stock
 * accuracy by force-rounding).
 */
export function roundQty(qty: number, unitName: string): number {
  if (!Number.isFinite(qty)) return 0;
  if (isMeasurementUnit(unitName)) {
    return Math.round(qty * 100) / 100;
  }
  const nearest = Math.round(qty);
  if (Math.abs(qty - nearest) < 1e-9) return nearest;
  // Preserve conversion fractions (avoid 0.4999999999 display artifacts).
  return Math.round(qty * 10000) / 10000;
}

/** Display string without float noise: 48 → "48", 1.5 → "1.5". */
export function formatQty(qty: number): string {
  if (!Number.isFinite(qty)) return '0';
  const r = Math.round(qty * 10000) / 10000;
  if (Number.isInteger(r)) return String(r);
  return String(r);
}

/**
 * Conversion factor for a sell unit relative to base.
 * The product's base unit always has factor 1 (implicit row).
 */
export function unitFactor(
  unitName: string,
  units?: Array<{ unit_name: string; conversion_factor: number | string }> | null,
  baseUnit: string = DEFAULT_BASE_UNIT,
): number {
  if (!unitName) return 1;
  if (unitName.trim().toLowerCase() === baseUnit.trim().toLowerCase()) return 1;
  const match = units?.find(
    (u) => u.unit_name.toLowerCase() === unitName.toLowerCase(),
  );
  if (!match) return 1;
  const f = Number(match.conversion_factor);
  return Number.isFinite(f) && f > 0 ? f : 1;
}

/**
 * Convert line quantity between units while preserving base quantity:
 *   base = qty * fromFactor
 *   next = base / toFactor
 */
export function convertQtyBetween(
  qty: number,
  fromUnit: string,
  toUnit: string,
  units?: Array<{ unit_name: string; conversion_factor: number | string }> | null,
  baseUnit: string = DEFAULT_BASE_UNIT,
): number {
  if (fromUnit.toLowerCase() === toUnit.toLowerCase()) {
    return roundQty(qty, toUnit);
  }
  const fromFactor = unitFactor(fromUnit, units, baseUnit);
  const toFactor = unitFactor(toUnit, units, baseUnit);
  const baseQty = qty * fromFactor;
  const next = baseQty / (toFactor || 1);
  return roundQty(next, toUnit);
}

/** Base-unit equivalent of a cart line: qty × factor. */
export function baseEquivalent(
  qty: number,
  unitName: string,
  units?: Array<{ unit_name: string; conversion_factor: number | string }> | null,
  baseUnit: string = DEFAULT_BASE_UNIT,
): number {
  const f = unitFactor(unitName, units, baseUnit);
  // Round in base-unit style (integer-friendly bases like pc; else 4 dp).
  const scaled = qty * f;
  const nearest = Math.round(scaled);
  if (Math.abs(scaled - nearest) < 1e-9) return nearest;
  return Math.round(scaled * 10000) / 10000;
}

/**
 * Product base unit label. Reads base_unit_name when Phase C lands;
 * falls back to DEFAULT_BASE_UNIT today.
 */
export function baseUnitName(
  product?: { base_unit_name?: string | null } | null,
): string {
  const n = product?.base_unit_name;
  return n && n.trim() ? n.trim() : DEFAULT_BASE_UNIT;
}

/** Validate a unit draft row (product form). Returns error or null. */
export function validateUnitDraft(row: {
  unit_name: string;
  conversion_factor: string;
  selling_price?: string;
  barcode?: string;
  id?: string;
}, existingNames: string[], selfId?: string): string | null {
  const name = row.unit_name.trim();
  if (!name) return 'Unit name is required.';
  if (name.toLowerCase() === 'pc') {
    return "'pc' is the implicit base unit — use a different name.";
  }
  const factor = Number(row.conversion_factor);
  if (!row.conversion_factor.trim() || !Number.isFinite(factor) || factor <= 0) {
    return `Conversion factor for "${name}" must be greater than 0.`;
  }
  if (row.selling_price != null && row.selling_price.trim() !== '') {
    const sp = Number(row.selling_price);
    if (!Number.isFinite(sp) || sp < 0) {
      return `Selling price for "${name}" must be 0 or greater.`;
    }
  }
  const lower = name.toLowerCase();
  const dup = existingNames.some(
    (n) => n.toLowerCase() === lower && n !== (selfId ? undefined : undefined),
  );
  // Duplicate check against other rows (caller passes other names).
  if (dup) return `Duplicate unit name "${name}".`;
  return null;
}

/** Names of all other rows except this draft (for duplicate detection). */
export function otherUnitNames(
  rows: Array<{ unit_name: string; id?: string }>,
  excludeId: string | undefined,
  idFactory: (row: { unit_name: string; id?: string }) => string,
): string[] {
  return rows
    .filter((r) => idFactory(r) !== excludeId)
    .map((r) => r.unit_name.trim())
    .filter(Boolean);
}
