import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import type { Category, Food, Unit } from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';
import { formatQuantity } from '../lib/units';
import { uid } from '../lib/id';
import { Button, CategorySelect, Chips, EmptyState, Field, IconButton, Modal, NumberInput, SearchInput, UnitSelect, useConfirm } from '../components/ui';

export function FoodEditor({ food, onSave, onClose }: { food?: Food; onSave: (f: Food) => void; onClose: () => void }) {
  const { data } = useStore();
  const [name, setName] = useState(food?.name ?? '');
  const [category, setCategory] = useState<Category>(food?.category ?? 'other');
  const [qty, setQty] = useState(food?.defaultQuantity ?? 1);
  const [unit, setUnit] = useState<Unit>(food?.defaultUnit ?? 'piece');
  const [notes, setNotes] = useState(food?.notes ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const save = () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (!n) e.name = 'Enter a name.';
    else if (data.foods.some((f) => f.id !== food?.id && f.name.toLowerCase() === n.toLowerCase())) e.name = `“${n}” is already in your foods.`;
    if (!(qty > 0)) e.qty = 'Enter a quantity above 0.';
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({ id: food?.id ?? `f-${uid()}`, name: n, category, defaultQuantity: qty, defaultUnit: unit, notes: notes.trim() || undefined, custom: food ? food.custom : true });
  };

  return (
    <Modal title={food ? `Edit ${food.name}` : 'Add a food'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{food ? 'Save changes' : 'Add food'}</Button></>}>
      <div className="form-grid">
        <Field label="Name" error={errors.name}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Feta cheese" /></Field>
        <Field label="Category"><CategorySelect value={category} onChange={setCategory} /></Field>
        <div className="row-2">
          <Field label="Usual quantity" error={errors.qty}><NumberInput value={qty} onChange={setQty} /></Field>
          <Field label="Unit"><UnitSelect value={unit} onChange={(u) => u && setUnit(u)} /></Field>
        </div>
        <Field label="Notes" hint="Optional, e.g. brand or where to find it."><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

export function FoodsPage() {
  const { data, update, toast } = useStore();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<Category | 'all'>('all');
  const [editing, setEditing] = useState<Food | 'new' | null>(null);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.foods
      .filter((f) => (cat === 'all' || f.category === cat) && (!s || f.name.toLowerCase().includes(s) || f.notes?.toLowerCase().includes(s)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.foods, q, cat]);

  const saveFood = (f: Food) => {
    update((d) => ({
      ...d,
      foods: d.foods.some((x) => x.id === f.id) ? d.foods.map((x) => (x.id === f.id ? f : x)) : [...d.foods, f],
      // Keep names/categories on the grocery list in sync with the food.
      grocery: d.grocery.map((g) => (g.foodId === f.id ? { ...g, name: f.name, category: f.category } : g)),
    }));
    toast(editing === 'new' ? `Added ${f.name}.` : `Saved ${f.name}.`);
    setEditing(null);
  };

  const remove = async (f: Food) => {
    const usedIn = data.recipes.filter((r) => r.ingredients.some((i) => i.foodId === f.id));
    if (usedIn.length) {
      await confirm({
        title: `${f.name} is used in recipes`,
        message: `Remove it from ${usedIn.map((r) => r.name).join(', ')} first, then delete it.`,
        confirmLabel: 'OK',
      });
      return;
    }
    if (!(await confirm({ title: `Delete ${f.name}?`, message: 'It will also be removed from your pantry.', confirmLabel: 'Delete', danger: true }))) return;
    update((d) => ({ ...d, foods: d.foods.filter((x) => x.id !== f.id), pantry: d.pantry.filter((p) => p.foodId !== f.id) }));
    toast(`Deleted ${f.name}.`);
  };

  const grouped = CATEGORIES.map((c) => ({ c, items: filtered.filter((f) => f.category === c) })).filter((g) => g.items.length);

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Foods</h1>
          <p className="muted">{data.foods.length} ingredients your recipes and lists draw from.</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing('new')}>Add food</Button>
      </header>

      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search foods" />
        <Chips label="Filter by category" value={cat} onChange={setCat}
          options={[{ value: 'all', label: 'All' }, ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c].split(',')[0] }))]} />
      </div>

      {grouped.length === 0 ? (
        <EmptyState title="No foods match" action={<Button onClick={() => { setQ(''); setCat('all'); }}>Clear filters</Button>}>
          Try a different search, or add it as a new food.
        </EmptyState>
      ) : grouped.map(({ c, items }) => (
        <div key={c} className="group">
          <h2 className="group-title">{CATEGORY_LABELS[c]} <span className="count">{items.length}</span></h2>
          <ul className="food-list">
            {items.map((f) => (
              <li key={f.id} className="food-row">
                <div className="food-main">
                  <span className="food-name">{f.name}{f.custom && <span className="tag">Yours</span>}</span>
                  <span className="muted small">Usually {formatQuantity(f.defaultQuantity, f.defaultUnit)}{f.notes ? `. ${f.notes}` : ''}</span>
                </div>
                <IconButton label={`Edit ${f.name}`} onClick={() => setEditing(f)}><Pencil size={16} /></IconButton>
                <IconButton label={`Delete ${f.name}`} onClick={() => remove(f)}><Trash2 size={16} /></IconButton>
              </li>
            ))}
          </ul>
        </div>
      ))}

      {editing && <FoodEditor food={editing === 'new' ? undefined : editing} onSave={saveFood} onClose={() => setEditing(null)} />}
    </section>
  );
}
