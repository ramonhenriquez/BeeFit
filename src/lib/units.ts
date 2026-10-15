import type { Unit } from '../types';
import { UNIT_LABELS } from '../types';

// Units are grouped into "dimensions". Quantities can only be added together
// when they share a dimension. Mass and volume are never mixed (we don't know
// an ingredient's density), and every count-style unit is its own dimension:
// 2 cans + 3 pieces stay as two separate lines rather than becoming "5 ?".

type Dimension = 'mass' | 'volume' | `count:${string}`;

/** Conversion factor to the base unit of the dimension (g for mass, ml for volume). */
const MASS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.349523125, lb: 453.59237 };
const VOLUME: Partial<Record<Unit, number>> = {
  ml: 1, l: 1000, tsp: 4.92892159375, tbsp: 14.78676478125, cup: 236.5882365, fl_oz: 29.5735295625,
};

export function dimensionOf(unit: Unit): Dimension {
  if (unit in MASS) return 'mass';
  if (unit in VOLUME) return 'volume';
  return `count:${unit}`;
}

export function areCompatible(a: Unit, b: Unit): boolean {
  return dimensionOf(a) === dimensionOf(b);
}

/** Convert to the base unit of its dimension. Count units are returned unchanged. */
export function toBase(quantity: number, unit: Unit): number {
  const f = MASS[unit] ?? VOLUME[unit] ?? 1;
  return quantity * f;
}

/** Convert between compatible units. Throws if the units are incompatible. */
export function convert(quantity: number, from: Unit, to: Unit): number {
  if (!areCompatible(from, to)) {
    throw new Error(`Cannot convert ${from} to ${to}`);
  }
  if (from === to) return quantity;
  const f = MASS[to] ?? VOLUME[to] ?? 1;
  return toBase(quantity, from) / f;
}

const METRIC = new Set<Unit>(['g', 'kg', 'ml', 'l']);
const VOLUME_ORDER: Unit[] = ['cup', 'fl_oz', 'tbsp', 'tsp'];

/**
 * Choose a readable unit for a summed quantity.
 * - If every contributing amount used the same unit, keep that unit.
 * - Mixed mass: grams (kg from 1000 g) if any metric input, else oz/lb.
 * - Mixed volume: ml/L if any metric input, else the largest kitchen unit
 *   that gives a value of at least 1.
 */
export function pickDisplayUnit(baseQuantity: number, dim: Dimension, usedUnits: Unit[]): Unit {
  const unique = Array.from(new Set(usedUnits));
  if (unique.length === 1) return unique[0];
  const anyMetric = unique.some((u) => METRIC.has(u));
  if (dim === 'mass') {
    if (anyMetric) return baseQuantity >= 1000 ? 'kg' : 'g';
    return baseQuantity >= MASS.lb! ? 'lb' : 'oz';
  }
  if (dim === 'volume') {
    if (anyMetric) return baseQuantity >= 1000 ? 'l' : 'ml';
    const candidates = VOLUME_ORDER.filter((u) => unique.includes(u));
    for (const u of candidates) {
      if (baseQuantity / VOLUME[u]! >= 1 - 1e-9) return u;
    }
    return candidates[candidates.length - 1] ?? 'tsp';
  }
  return unique[0];
}

/** Count units that are bought whole: 1.3 cans means buying 2. */
const WHOLE_UNITS = new Set<Unit>(['piece', 'can', 'pack']);

/** Round a quantity for a shopping list. */
export function roundForShopping(quantity: number, unit: Unit): number {
  if (WHOLE_UNITS.has(unit)) return Math.ceil(quantity - 1e-9);
  if (unit === 'g' || unit === 'ml') return Math.round(quantity);
  return Math.round(quantity * 100) / 100;
}

export function formatQuantity(quantity: number | null, unit: Unit | null): string {
  if (quantity === null) return unit ? UNIT_LABELS[unit] : '';
  const q = Number.isInteger(quantity) ? String(quantity) : String(Math.round(quantity * 100) / 100);
  if (!unit) return q;
  const label = UNIT_LABELS[unit];
  const plural =
    quantity !== 1 && ['piece', 'slice', 'clove', 'can', 'pack', 'cup', 'pinch'].includes(unit)
      ? unit === 'piece' ? 'pcs' : unit === 'pinch' ? 'pinches' : label + 's'
      : label;
  return `${q} ${plural}`;
}
