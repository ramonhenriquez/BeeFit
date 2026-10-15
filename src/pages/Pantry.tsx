import { useState, type FormEvent } from 'react';
import { Plus, Trash2, Warehouse } from 'lucide-react';
import { useStore } from '../store';
import type { Unit } from '../types';
import { CATEGORY_LABELS } from '../types';
import { uid } from '../lib/id';
import { Button, EmptyState, FoodSelect, IconButton, NumberInput, UnitSelect } from '../components/ui';

export function PantryPage() {
  const { data, update, foodById, toast } = useStore();
  const [foodId, setFoodId] = useState('');
  const [qty, setQty] = useState<number>(NaN);
  const [unit, setUnit] = useState<Unit>('piece');
  const [error, setError] = useState('');

  const pickFood = (id: string) => {
    setFoodId(id);
    const f = foodById.get(id);
    if (f) { setUnit(f.defaultUnit); setQty(f.defaultQuantity); }
  };

  const add = (e: FormEvent) => {
    e.preventDefault();
    if (!foodId) return setError('Choose a food.');
    if (!(qty >= 0)) return setError('Enter how much you have (0 or more).');
    setError('');
    update((d) => ({ ...d, pantry: [...d.pantry, { id: uid(), foodId, quantity: qty, unit, available: qty > 0 }] }));
    toast(`Added ${foodById.get(foodId)?.name} to your pantry.`);
    setFoodId(''); setQty(NaN);
  };

  const set = (id: string, patch: Partial<(typeof data.pantry)[number]>) =>
    update((d) => ({ ...d, pantry: d.pantry.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));

  const items = [...data.pantry].sort((a, b) => (foodById.get(a.foodId)?.name ?? '').localeCompare(foodById.get(b.foodId)?.name ?? ''));

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Pantry</h1>
          <p className="muted">What you already have. Available items are subtracted from new shopping lists; nothing else is assumed.</p>
        </div>
      </header>

      <form className="add-item" onSubmit={add} noValidate>
        <FoodSelect foods={data.foods} value={foodId} onChange={pickFood} aria-label="Food" className="add-name" />
        <NumberInput value={qty} onChange={setQty} aria-label="Quantity on hand" className="add-qty" />
        <UnitSelect value={unit} onChange={(u) => u && setUnit(u)} aria-label="Unit" className="add-unit" />
        <Button type="submit" icon={<Plus size={18} />}>Add to pantry</Button>
        {error && <span className="field-error full" role="alert">{error}</span>}
      </form>

      {items.length === 0 ? (
        <EmptyState icon={<Warehouse size={28} />} title="Your pantry is empty">
          Add staples you keep at home, like rice or olive oil, so they don’t end up on your list.
        </EmptyState>
      ) : (
        <ul className="pantry-list">
          {items.map((p) => {
            const f = foodById.get(p.foodId);
            return (
              <li key={p.id} className={`pantry-row ${p.available ? '' : 'is-out'}`}>
                <div className="food-main">
                  <span className="food-name">{f?.name ?? 'Unknown food'}</span>
                  <span className="muted small">{f ? CATEGORY_LABELS[f.category] : ''}</span>
                </div>
                <div className="item-qty">
                  <NumberInput value={p.quantity} aria-label={`Quantity of ${f?.name}`} onChange={(n) => set(p.id, { quantity: Number.isNaN(n) ? 0 : Math.max(0, n) })} />
                  <UnitSelect value={p.unit} onChange={(u) => u && set(p.id, { unit: u })} aria-label={`Unit for ${f?.name}`} />
                </div>
                <label className="switch">
                  <input type="checkbox" role="switch" checked={p.available} onChange={(e) => set(p.id, { available: e.target.checked })} />
                  <span>{p.available ? 'In stock' : 'Out'}</span>
                </label>
                <IconButton label={`Remove ${f?.name} from pantry`} onClick={() => update((d) => ({ ...d, pantry: d.pantry.filter((x) => x.id !== p.id) }))}><Trash2 size={16} /></IconButton>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
