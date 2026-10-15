import { useMemo, useState, type FormEvent } from 'react';
import { ClipboardCopy, PackageCheck, Plus, RefreshCw, ShoppingBasket, Trash2, X } from 'lucide-react';
import { useStore } from '../store';
import type { Category, GroceryItem, ListSource, Unit } from '../types';
import { CATEGORIES, CATEGORY_LABELS } from '../types';
import { collectSelections, groceryListToText, type PantryCoverage } from '../lib/grocery';
import { formatQuantity } from '../lib/units';
import { uid } from '../lib/id';
import { Button, CategorySelect, Chips, EmptyState, IconButton, NumberInput, UnitSelect, useConfirm } from '../components/ui';
import { useGenerateList } from '../hooks';

function pantrySummary(c: PantryCoverage[]): string {
  const full = c.filter((x) => x.fullyCovered).length;
  const part = c.length - full;
  const plural = (n: number) => `${n} item${n === 1 ? '' : 's'}`;
  if (full && part) return `Your pantry covers ${plural(full)} and part of ${plural(part)}`;
  if (full) return `Your pantry covers ${plural(full)}, so they're off the list`;
  return `Your pantry covers part of ${plural(part)}`;
}

function AddItemForm() {
  const { data, update, toast } = useStore();
  const [name, setName] = useState('');
  const [qty, setQty] = useState<number>(NaN);
  const [unit, setUnit] = useState<Unit | null>(null);
  const [category, setCategory] = useState<Category>('other');
  const [error, setError] = useState('');

  const match = data.foods.find((f) => f.name.toLowerCase() === name.trim().toLowerCase());

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const n = name.trim();
    if (!n) return setError('Type an item name.');
    if (!Number.isNaN(qty) && qty <= 0) return setError('Quantity must be above 0, or leave it blank.');
    setError('');
    const item: GroceryItem = {
      id: uid(), name: match?.name ?? n, foodId: match?.id, category: match?.category ?? category,
      quantity: Number.isNaN(qty) ? null : qty, unit: Number.isNaN(qty) ? unit : unit ?? match?.defaultUnit ?? null,
      checked: false, source: 'manual',
    };
    update((d) => ({ ...d, grocery: [...d.grocery, item] }));
    toast(`Added ${item.name}.`);
    setName(''); setQty(NaN); setUnit(null);
  };

  return (
    <form className="add-item" onSubmit={submit} noValidate>
      <input list="food-names" value={name} onChange={(e) => {
        setName(e.target.value);
        const f = data.foods.find((x) => x.name.toLowerCase() === e.target.value.trim().toLowerCase());
        if (f) { setCategory(f.category); if (!unit) setUnit(f.defaultUnit); }
      }} placeholder="Add an item, e.g. paper towels" aria-label="Item name" className="add-name" />
      <datalist id="food-names">{data.foods.map((f) => <option key={f.id} value={f.name} />)}</datalist>
      <NumberInput value={qty} onChange={setQty} aria-label="Quantity (optional)" className="add-qty" />
      <UnitSelect value={unit} onChange={setUnit} allowNone aria-label="Unit" className="add-unit" />
      {!match && <CategorySelect value={category} onChange={setCategory} aria-label="Category" />}
      <Button variant="secondary" icon={<Plus size={18} />} type="submit">Add</Button>
      {error && <span className="field-error full" role="alert">{error}</span>}
    </form>
  );
}

function ItemRow({ item }: { item: GroceryItem }) {
  const { update } = useStore();
  const set = (patch: Partial<GroceryItem>) => update((d) => ({ ...d, grocery: d.grocery.map((g) => (g.id === item.id ? { ...g, ...patch } : g)) }));
  return (
    <li className={`item ${item.checked ? 'is-checked' : ''}`}>
      <label className="item-check">
        <input type="checkbox" checked={item.checked} onChange={(e) => set({ checked: e.target.checked })} />
        <span className="item-name">
          <span className="item-mark">{item.name}</span>
          {item.fromRecipes?.length ? <span className="item-from">For {item.fromRecipes.join(', ')}</span> : item.source === 'manual' ? <span className="item-from">Added by you</span> : null}
        </span>
      </label>
      <div className="item-qty">
        <NumberInput value={item.quantity} aria-label={`Quantity of ${item.name}`}
          onChange={(n) => set({ quantity: Number.isNaN(n) || n < 0 ? null : n })} />
        <UnitSelect value={item.unit} allowNone onChange={(u) => set({ unit: u })} aria-label={`Unit for ${item.name}`} />
      </div>
      <IconButton label={`Remove ${item.name}`} onClick={() => update((d) => ({ ...d, grocery: d.grocery.filter((g) => g.id !== item.id) }))}><X size={16} /></IconButton>
    </li>
  );
}

export function ShoppingPage({ goPlanner }: { goPlanner: () => void }) {
  const { data, update, toast } = useStore();
  const confirm = useConfirm();
  const generate = useGenerateList();
  const [coverage, setCoverage] = useState<PantryCoverage[] | null>(null);
  const { settings, grocery } = data;
  const setSettings = (patch: Partial<typeof settings>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));

  const mealCount = collectSelections(data.quick, data.week, settings.listSource).length;
  const done = grocery.filter((g) => g.checked).length;
  const groups = useMemo(
    () => CATEGORIES.map((c) => ({ c, items: grocery.filter((g) => g.category === c).sort((a, b) => Number(a.checked) - Number(b.checked) || a.name.localeCompare(b.name)) })).filter((g) => g.items.length),
    [grocery],
  );

  const run = () => {
    const r = generate();
    if (r) setCoverage(r.coveredByPantry);
  };

  const clearCompleted = () => {
    update((d) => ({ ...d, grocery: d.grocery.filter((g) => !g.checked) }));
    toast(`Cleared ${done} purchased item${done === 1 ? '' : 's'}.`);
  };

  const clearAll = async () => {
    if (await confirm({ title: 'Clear the whole list?', message: 'This removes every item, including ones you added yourself.', confirmLabel: 'Clear list', danger: true })) {
      update((d) => ({ ...d, grocery: [] }));
      setCoverage(null);
    }
  };

  const copy = async () => {
    const text = groceryListToText(grocery, (c) => CATEGORY_LABELS[c], (i) => formatQuantity(i.quantity, i.unit));
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied the list. Paste it into notes or a message.');
    } catch {
      toast('Copying isn’t allowed here. Select the items and copy them manually.');
    }
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Shopping list</h1>
          <p className="muted">
            {grocery.length ? `${done} of ${grocery.length} in the basket.` : 'Generate a list from your planned meals, or add items by hand.'}
          </p>
        </div>
      </header>

      <div className="generate-panel">
        <div className="generate-options">
          <div className="opt">
            <span className="opt-label" id="src-label">Use meals from</span>
            <Chips<ListSource> label="Use meals from" value={settings.listSource} onChange={(v) => setSettings({ listSource: v })}
              options={[{ value: 'quick', label: 'Quick selection' }, { value: 'week', label: 'Weekly plan' }, { value: 'both', label: 'Both' }]} />
          </div>
          <label className="check"><input type="checkbox" checked={settings.subtractPantry} onChange={(e) => setSettings({ subtractPantry: e.target.checked })} /> Subtract what’s in my pantry</label>
          <label className="check"><input type="checkbox" checked={settings.keepManualItems} onChange={(e) => setSettings({ keepManualItems: e.target.checked })} /> Keep items I added myself</label>
        </div>
        <div className="generate-cta">
          <Button variant="primary" size="lg" icon={grocery.some((g) => g.source === 'generated') ? <RefreshCw size={20} /> : <ShoppingBasket size={20} />} onClick={run} disabled={!mealCount}>
            {grocery.some((g) => g.source === 'generated') ? 'Regenerate shopping list' : 'Generate shopping list'}
          </Button>
          <span className="muted small">{mealCount ? `From ${mealCount} meal${mealCount === 1 ? '' : 's'}` : <>No meals chosen yet. <button type="button" className="link" onClick={goPlanner}>Open the planner</button></>}</span>
        </div>
      </div>

      {coverage && coverage.length > 0 && (
        <div className="notice" role="status">
          <PackageCheck size={18} aria-hidden />
          <div>
            <strong>{pantrySummary(coverage)}</strong>
            <span className="muted small">
              {coverage.map((c) => `${c.name} (${formatQuantity(Math.round(c.quantity * 100) / 100, c.unit)}${c.fullyCovered ? '' : ', partly'})`).join(', ')}
            </span>
          </div>
          <IconButton label="Dismiss" onClick={() => setCoverage(null)}><X size={16} /></IconButton>
        </div>
      )}

      <AddItemForm />

      {grocery.length > 0 && (
        <>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={grocery.length} aria-valuenow={done} aria-label="Items purchased">
            <span style={{ width: `${(done / grocery.length) * 100}%` }} />
          </div>
          <div className="list-tools">
            <Button size="sm" variant="ghost" icon={<ClipboardCopy size={16} />} onClick={copy}>Copy list</Button>
            <span className="spacer" />
            <Button size="sm" disabled={!done} onClick={clearCompleted}>Clear purchased ({done})</Button>
            <Button size="sm" variant="ghost" icon={<Trash2 size={16} />} onClick={clearAll}>Clear list</Button>
          </div>
        </>
      )}

      {grocery.length === 0 ? (
        <EmptyState icon={<ShoppingBasket size={28} />} title="Your list is empty">
          Choose meals in the planner, then press Generate shopping list.
        </EmptyState>
      ) : (
        <div className="list">
          {groups.map(({ c, items }) => (
            <section key={c} className="aisle">
              <h2 className="aisle-title">{CATEGORY_LABELS[c]} <span className="count">{items.filter((i) => !i.checked).length} left</span></h2>
              <ul>{items.map((i) => <ItemRow key={i.id} item={i} />)}</ul>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}
