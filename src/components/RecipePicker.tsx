import { useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../store';
import { Button, Modal, SearchInput, Stepper } from './ui';

/** Pick one recipe and a serving count. Used to add or replace planned meals. */
export function RecipePicker({ title, confirmLabel, initialRecipeId, initialServings, onPick, onClose }: {
  title: string;
  confirmLabel: string;
  initialRecipeId?: string;
  initialServings?: number;
  onPick: (recipeId: string, servings: number) => void;
  onClose: () => void;
}) {
  const { data, recipeById } = useStore();
  const [q, setQ] = useState('');
  const [selected, setSelected] = useState(initialRecipeId ?? '');
  const [servings, setServings] = useState(initialServings ?? recipeById.get(initialRecipeId ?? '')?.servings ?? 1);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return data.recipes
      .filter((r) => !s || r.name.toLowerCase().includes(s) || r.description.toLowerCase().includes(s))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data.recipes, q]);

  const choose = (id: string) => {
    setSelected(id);
    if (!initialServings) setServings(recipeById.get(id)?.servings ?? 1);
  };

  return (
    <Modal title={title} onClose={onClose}
      footer={<>
        <div className="picker-servings">
          <span className="muted">Servings</span>
          <Stepper value={servings} onChange={setServings} label="Servings" />
        </div>
        <Button variant="primary" disabled={!selected} onClick={() => onPick(selected, servings)}>{confirmLabel}</Button>
      </>}>
      <SearchInput value={q} onChange={setQ} placeholder="Search recipes" />
      <ul className="picker-list" role="listbox" aria-label="Recipes">
        {list.map((r) => (
          <li key={r.id}>
            <button type="button" role="option" aria-selected={selected === r.id}
              className={`picker-item ${selected === r.id ? 'is-selected' : ''}`} onClick={() => choose(r.id)}>
              <span className="picker-emoji" aria-hidden>{r.emoji}</span>
              <span className="picker-text">
                <strong>{r.name}</strong>
                <span className="muted small">Serves {r.servings}{r.prepMinutes ? `, ${r.prepMinutes} min` : ''}</span>
              </span>
              {selected === r.id && <Check size={18} aria-hidden />}
            </button>
          </li>
        ))}
        {!list.length && <li className="muted pad">No recipes match “{q}”.</li>}
      </ul>
    </Modal>
  );
}
