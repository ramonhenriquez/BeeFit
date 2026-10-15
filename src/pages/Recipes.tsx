import { useMemo, useState } from 'react';
import { Clock, Copy, ListPlus, Pencil, Plus, Trash2, Users, X } from 'lucide-react';
import { useStore } from '../store';
import type { Food, Recipe, RecipeIngredient } from '../types';
import { formatQuantity } from '../lib/units';
import { uid } from '../lib/id';
import { Button, EmptyState, Field, FoodSelect, IconButton, Modal, NumberInput, SearchInput, UnitSelect, useConfirm } from '../components/ui';
import { FoodEditor } from './Foods';

const EMOJIS = ['🍽️', '🍗', '🍝', '🐟', '🌯', '🍳', '🥣', '🥢', '🍲', '🥗', '🍕', '🍔', '🌮', '🥪', '🍛', '🍜', '🥘', '🍓', '🥕', '🧆'];

function RecipeEditor({ recipe, onSave, onClose }: { recipe?: Recipe; onSave: (r: Recipe) => void; onClose: () => void }) {
  const { data, update, foodById } = useStore();
  const [name, setName] = useState(recipe?.name ?? '');
  const [emoji, setEmoji] = useState(recipe?.emoji ?? '🍽️');
  const [description, setDescription] = useState(recipe?.description ?? '');
  const [servings, setServings] = useState(recipe?.servings ?? 2);
  const [prep, setPrep] = useState<number>(recipe?.prepMinutes ?? NaN);
  const [instructions, setInstructions] = useState(recipe?.instructions ?? '');
  const [ings, setIngs] = useState<RecipeIngredient[]>(recipe?.ingredients.map((i) => ({ ...i })) ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newFoodFor, setNewFoodFor] = useState<number | null>(null);

  const setIng = (idx: number, patch: Partial<RecipeIngredient>) => setIngs((l) => l.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const pickFood = (idx: number, foodId: string) => {
    const f = foodById.get(foodId);
    setIng(idx, f ? { foodId, quantity: f.defaultQuantity, unit: f.defaultUnit } : { foodId });
  };

  const save = () => {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = 'Give the recipe a name.';
    if (!(servings >= 1)) e.servings = 'Servings must be at least 1.';
    if (!Number.isNaN(prep) && prep < 0) e.prep = 'Prep time can’t be negative.';
    if (!ings.length) e.ings = 'Add at least one ingredient.';
    ings.forEach((i, idx) => {
      if (!i.foodId) e[`ing${idx}`] = 'Choose a food.';
      else if (!(i.quantity > 0)) e[`ing${idx}`] = 'Enter an amount above 0.';
    });
    setErrors(e);
    if (Object.keys(e).length) return;
    onSave({
      id: recipe?.id ?? `r-${uid()}`, name: name.trim(), emoji, description: description.trim(),
      servings: Math.round(servings), ingredients: ings, instructions: instructions.trim() || undefined,
      prepMinutes: Number.isNaN(prep) ? undefined : Math.round(prep), custom: recipe ? recipe.custom : true,
    });
  };

  const addFood = (f: Food) => {
    update((d) => ({ ...d, foods: [...d.foods, f] }));
    if (newFoodFor !== null) setIng(newFoodFor, { foodId: f.id, quantity: f.defaultQuantity, unit: f.defaultUnit });
    setNewFoodFor(null);
  };

  return (
    <Modal wide title={recipe ? `Edit ${recipe.name}` : 'New recipe'} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={save}>{recipe ? 'Save recipe' : 'Create recipe'}</Button></>}>
      <div className="form-grid">
        <div className="row-name">
          <Field label="Icon">
            <select value={emoji} onChange={(e) => setEmoji(e.target.value)} className="emoji-select">
              {EMOJIS.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </Field>
          <Field label="Name" error={errors.name}><input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shakshuka" /></Field>
        </div>
        <Field label="Description"><input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="One line about the dish" /></Field>
        <div className="row-2">
          <Field label="Serves" error={errors.servings}><NumberInput value={servings} min={1} step={1} onChange={setServings} /></Field>
          <Field label="Prep time (minutes)" error={errors.prep} hint="Optional"><NumberInput value={prep} min={0} step={1} onChange={setPrep} /></Field>
        </div>

        <fieldset className="ing-editor">
          <legend>Ingredients for {servings >= 1 ? Math.round(servings) : '…'} serving{servings === 1 ? '' : 's'}</legend>
          {ings.map((i, idx) => (
            <div key={idx} className="ing-row-wrap">
              <div className="ing-row">
                <FoodSelect foods={data.foods} value={i.foodId} onChange={(id) => pickFood(idx, id)} aria-label={`Ingredient ${idx + 1}`} className="ing-food" />
                <NumberInput value={i.quantity} onChange={(n) => setIng(idx, { quantity: n })} aria-label={`Amount for ingredient ${idx + 1}`} className="ing-qty" />
                <UnitSelect value={i.unit} onChange={(u) => u && setIng(idx, { unit: u })} aria-label={`Unit for ingredient ${idx + 1}`} className="ing-unit" />
                <IconButton label={`Remove ingredient ${idx + 1}`} onClick={() => setIngs((l) => l.filter((_, j) => j !== idx))}><X size={16} /></IconButton>
              </div>
              {errors[`ing${idx}`] && <span className="field-error" role="alert">{errors[`ing${idx}`]}</span>}
            </div>
          ))}
          {errors.ings && <span className="field-error" role="alert">{errors.ings}</span>}
          <div className="ing-actions">
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setIngs((l) => [...l, { foodId: '', quantity: 1, unit: 'piece' }])}>Add ingredient</Button>
            <Button size="sm" variant="ghost" onClick={() => { setIngs((l) => [...l, { foodId: '', quantity: 1, unit: 'piece' }]); setNewFoodFor(ings.length); }}>Food not listed? Create it</Button>
          </div>
        </fieldset>

        <Field label="Instructions" hint="Optional. One step per line."><textarea rows={5} value={instructions} onChange={(e) => setInstructions(e.target.value)} /></Field>
      </div>
      {newFoodFor !== null && <FoodEditor onSave={addFood} onClose={() => setNewFoodFor(null)} />}
    </Modal>
  );
}

function RecipeDetail({ recipe, onClose, onEdit, onQuickAdd }: { recipe: Recipe; onClose: () => void; onEdit: () => void; onQuickAdd: () => void }) {
  const { foodById } = useStore();
  const steps = recipe.instructions?.split('\n').map((s) => s.trim()).filter(Boolean) ?? [];
  return (
    <Modal wide title={recipe.name} onClose={onClose}
      footer={<><Button icon={<Pencil size={16} />} onClick={onEdit}>Edit</Button><Button variant="primary" icon={<ListPlus size={16} />} onClick={onQuickAdd}>Add to quick selection</Button></>}>
      <div className="detail">
        <div className="detail-hero" aria-hidden>{recipe.emoji}</div>
        {recipe.description && <p className="lede">{recipe.description}</p>}
        <p className="meta"><Users size={16} aria-hidden /> Serves {recipe.servings}{recipe.prepMinutes ? <><Clock size={16} aria-hidden /> {recipe.prepMinutes} min</> : null}</p>
        <h3>Ingredients</h3>
        <ul className="detail-ings">
          {recipe.ingredients.map((i, idx) => (
            <li key={idx}><span>{foodById.get(i.foodId)?.name ?? 'Unknown food'}</span><span className="qty">{formatQuantity(i.quantity, i.unit)}</span></li>
          ))}
        </ul>
        {steps.length > 0 && <><h3>Method</h3><ol className="steps">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol></>}
      </div>
    </Modal>
  );
}

export function RecipesPage() {
  const { data, update, toast } = useStore();
  const confirm = useConfirm();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Recipe | 'new' | null>(null);
  const [viewing, setViewing] = useState<Recipe | null>(null);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.recipes.filter((r) => !s || r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name));
  }, [data.recipes, q]);

  const save = (r: Recipe) => {
    update((d) => ({ ...d, recipes: d.recipes.some((x) => x.id === r.id) ? d.recipes.map((x) => (x.id === r.id ? r : x)) : [...d.recipes, r] }));
    toast(editing === 'new' ? `Created ${r.name}.` : `Saved ${r.name}.`);
    setEditing(null);
    if (viewing?.id === r.id) setViewing(r);
  };

  const duplicate = (r: Recipe) => {
    const copy: Recipe = { ...r, id: `r-${uid()}`, name: `${r.name} (copy)`, custom: true, ingredients: r.ingredients.map((i) => ({ ...i })) };
    update((d) => ({ ...d, recipes: [...d.recipes, copy] }));
    toast(`Duplicated as “${copy.name}”.`);
  };

  const remove = async (r: Recipe) => {
    if (!(await confirm({ title: `Delete ${r.name}?`, message: 'It will also be removed from your meal plan and quick selection.', confirmLabel: 'Delete', danger: true }))) return;
    update((d) => {
      const week = structuredClone(d.week);
      for (const day of Object.values(week)) for (const k of Object.keys(day) as (keyof typeof day)[]) day[k] = day[k].filter((m) => m.recipeId !== r.id);
      return { ...d, recipes: d.recipes.filter((x) => x.id !== r.id), quick: d.quick.filter((m) => m.recipeId !== r.id), week };
    });
    toast(`Deleted ${r.name}.`);
  };

  const quickAdd = (r: Recipe) => {
    update((d) => {
      const existing = d.quick.find((m) => m.recipeId === r.id);
      return {
        ...d,
        quick: existing ? d.quick.map((m) => (m === existing ? { ...m, servings: m.servings + r.servings } : m)) : [...d.quick, { id: uid(), recipeId: r.id, servings: r.servings }],
      };
    });
    toast(`Added ${r.name} to your quick selection.`);
  };

  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Recipes</h1>
          <p className="muted">Meals you can plan. Each one knows exactly what it needs.</p>
        </div>
        <Button variant="primary" icon={<Plus size={18} />} onClick={() => setEditing('new')}>New recipe</Button>
      </header>
      <div className="toolbar"><SearchInput value={q} onChange={setQ} placeholder="Search recipes" /></div>

      {list.length === 0 ? (
        <EmptyState title={q ? 'No recipes match' : 'No recipes yet'} action={<Button variant="primary" onClick={() => setEditing('new')}>Create a recipe</Button>}>
          {q ? 'Try another search, or create it.' : 'Create your first recipe to start planning.'}
        </EmptyState>
      ) : (
        <ul className="recipe-grid">
          {list.map((r) => (
            <li key={r.id} className="recipe-card">
              <button type="button" className="recipe-open" onClick={() => setViewing(r)} aria-label={`View ${r.name}`}>
                <span className="recipe-emoji" aria-hidden>{r.emoji}</span>
                <span className="recipe-name">{r.name}</span>
                <span className="recipe-desc">{r.description}</span>
                <span className="recipe-meta">
                  <span><Users size={14} aria-hidden /> {r.servings}</span>
                  {r.prepMinutes ? <span><Clock size={14} aria-hidden /> {r.prepMinutes} min</span> : null}
                  <span>{r.ingredients.length} ingredients</span>
                </span>
              </button>
              <div className="recipe-actions">
                <Button size="sm" variant="ghost" icon={<ListPlus size={16} />} onClick={() => quickAdd(r)}>Quick add</Button>
                <span className="spacer" />
                <IconButton label={`Edit ${r.name}`} onClick={() => setEditing(r)}><Pencil size={16} /></IconButton>
                <IconButton label={`Duplicate ${r.name}`} onClick={() => duplicate(r)}><Copy size={16} /></IconButton>
                <IconButton label={`Delete ${r.name}`} onClick={() => remove(r)}><Trash2 size={16} /></IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      {viewing && !editing && <RecipeDetail recipe={viewing} onClose={() => setViewing(null)} onEdit={() => setEditing(viewing)} onQuickAdd={() => quickAdd(viewing)} />}
      {editing && <RecipeEditor recipe={editing === 'new' ? undefined : editing} onSave={save} onClose={() => setEditing(null)} />}
    </section>
  );
}
