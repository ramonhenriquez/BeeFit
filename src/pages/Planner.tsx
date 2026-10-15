import { useState } from 'react';
import { CalendarRange, Copy, Plus, Repeat, ShoppingBasket, Trash2, X, Zap } from 'lucide-react';
import { useStore } from '../store';
import type { Day, MealSelection, Slot, WeekPlan } from '../types';
import { DAYS, DAY_LABELS, SLOTS, SLOT_LABELS } from '../types';
import { uid } from '../lib/id';
import { emptyWeek } from '../lib/storage';
import { Button, Chips, EmptyState, IconButton, Modal, Stepper, useConfirm } from '../components/ui';
import { RecipePicker } from '../components/RecipePicker';
import { useGenerateList } from '../hooks';

export type PlannerTab = 'quick' | 'week';

export function todayKey(): Day {
  return DAYS[(new Date().getDay() + 6) % 7];
}

function mapWeek(week: WeekPlan, fn: (list: MealSelection[], day: Day, slot: Slot) => MealSelection[]): WeekPlan {
  const out = {} as WeekPlan;
  for (const d of DAYS) {
    out[d] = {} as WeekPlan[Day];
    for (const s of SLOTS) out[d][s] = fn(week[d][s], d, s);
  }
  return out;
}

function QuickSelection({ onGenerate }: { onGenerate: () => void }) {
  const { data, update, recipeById } = useStore();
  const [picking, setPicking] = useState(false);
  const setQuick = (fn: (q: MealSelection[]) => MealSelection[]) => update((d) => ({ ...d, quick: fn(d.quick) }));

  return (
    <div className="quick">
      {data.quick.length === 0 ? (
        <EmptyState icon={<Zap size={28} />} title="Pick a few meals"
          action={<Button variant="primary" icon={<Plus size={18} />} onClick={() => setPicking(true)}>Choose meals</Button>}>
          Choose what you want to cook, set servings, and get a shopping list right away.
        </EmptyState>
      ) : (
        <>
          <ul className="quick-list">
            {data.quick.map((m) => {
              const r = recipeById.get(m.recipeId);
              if (!r) return null;
              return (
                <li key={m.id} className="quick-item">
                  <span className="quick-emoji" aria-hidden>{r.emoji}</span>
                  <div className="quick-text">
                    <strong>{r.name}</strong>
                    <span className="muted small">Recipe serves {r.servings}</span>
                  </div>
                  <Stepper label="Servings" value={m.servings} onChange={(n) => setQuick((q) => q.map((x) => (x.id === m.id ? { ...x, servings: n } : x)))} />
                  <IconButton label={`Remove ${r.name}`} onClick={() => setQuick((q) => q.filter((x) => x.id !== m.id))}><X size={18} /></IconButton>
                </li>
              );
            })}
          </ul>
          <div className="quick-foot">
            <Button icon={<Plus size={18} />} onClick={() => setPicking(true)}>Add meal</Button>
            <Button variant="ghost" onClick={() => setQuick(() => [])}>Clear selection</Button>
            <span className="spacer" />
            <Button variant="primary" size="lg" icon={<ShoppingBasket size={20} />} onClick={onGenerate}>Generate shopping list</Button>
          </div>
        </>
      )}
      {picking && (
        <RecipePicker title="Add a meal" confirmLabel="Add meal" onClose={() => setPicking(false)}
          onPick={(recipeId, servings) => { setQuick((q) => [...q, { id: uid(), recipeId, servings }]); setPicking(false); }} />
      )}
    </div>
  );
}

type PickState = { day: Day; slot: Slot; replaceId?: string; recipeId?: string; servings?: number };
type CopyState = { day: Day; slot: Slot; entry: MealSelection };

function WeekPlanner({ onGenerate }: { onGenerate: () => void }) {
  const { data, update, recipeById, toast } = useStore();
  const confirm = useConfirm();
  const [pick, setPick] = useState<PickState | null>(null);
  const [copy, setCopy] = useState<CopyState | null>(null);
  const [copyDays, setCopyDays] = useState<Day[]>([]);
  const today = todayKey();
  const setWeek = (fn: (w: WeekPlan) => WeekPlan) => update((d) => ({ ...d, week: fn(d.week) }));
  const total = DAYS.reduce((n, d) => n + SLOTS.reduce((m, s) => m + data.week[d][s].length, 0), 0);

  const onPick = (recipeId: string, servings: number) => {
    if (!pick) return;
    setWeek((w) => mapWeek(w, (list, d, s) => {
      if (d !== pick.day || s !== pick.slot) return list;
      if (pick.replaceId) return list.map((m) => (m.id === pick.replaceId ? { ...m, recipeId, servings } : m));
      return [...list, { id: uid(), recipeId, servings }];
    }));
    setPick(null);
  };

  const doCopy = () => {
    if (!copy || !copyDays.length) return;
    setWeek((w) => mapWeek(w, (list, d, s) => (s === copy.slot && copyDays.includes(d) ? [...list, { ...copy.entry, id: uid() }] : list)));
    toast(`Repeated on ${copyDays.length} day${copyDays.length === 1 ? '' : 's'}.`);
    setCopy(null);
  };

  const clearWeek = async () => {
    if (await confirm({ title: 'Clear the whole week?', message: 'All planned meals will be removed. Your shopping list stays as it is.', confirmLabel: 'Clear week', danger: true })) {
      setWeek(() => emptyWeek());
    }
  };

  return (
    <div className="week">
      <div className="week-bar">
        <p className="muted">{total ? `${total} meal${total === 1 ? '' : 's'} planned this week.` : 'Add meals to any day. Use repeat to plan the same meal on several days.'}</p>
        <span className="spacer" />
        {total > 0 && <Button variant="ghost" icon={<Trash2 size={16} />} onClick={clearWeek}>Clear week</Button>}
        <Button variant="primary" size="lg" icon={<ShoppingBasket size={20} />} onClick={onGenerate} disabled={!total}>Generate shopping list</Button>
      </div>
      <div className="week-grid">
        {DAYS.map((d) => (
          <article key={d} className={`day ${d === today ? 'is-today' : ''}`} aria-label={DAY_LABELS[d]}>
            <h3 className="day-name">{DAY_LABELS[d]}{d === today && <span className="today-pill">Today</span>}</h3>
            {SLOTS.map((s) => (
              <div key={s} className="slot">
                <div className="slot-head">
                  <span className="slot-name">{SLOT_LABELS[s]}</span>
                  <IconButton label={`Add ${SLOT_LABELS[s].toLowerCase()} on ${DAY_LABELS[d]}`} onClick={() => setPick({ day: d, slot: s })}><Plus size={16} /></IconButton>
                </div>
                {data.week[d][s].map((m) => {
                  const r = recipeById.get(m.recipeId);
                  if (!r) return null;
                  return (
                    <div key={m.id} className="meal-chip">
                      <button type="button" className="meal-chip-name" title="Replace meal"
                        onClick={() => setPick({ day: d, slot: s, replaceId: m.id, recipeId: m.recipeId, servings: m.servings })}>
                        <span aria-hidden>{r.emoji}</span> {r.name}
                      </button>
                      <div className="meal-chip-tools">
                        <Stepper label="Servings" value={m.servings}
                          onChange={(n) => setWeek((w) => mapWeek(w, (list) => list.map((x) => (x.id === m.id ? { ...x, servings: n } : x))))} />
                        <IconButton label={`Repeat ${r.name} on other days`} onClick={() => { setCopy({ day: d, slot: s, entry: m }); setCopyDays([]); }}><Repeat size={15} /></IconButton>
                        <IconButton label={`Remove ${r.name}`} onClick={() => setWeek((w) => mapWeek(w, (list) => list.filter((x) => x.id !== m.id)))}><X size={15} /></IconButton>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </article>
        ))}
      </div>

      {pick && (
        <RecipePicker title={pick.replaceId ? `Replace ${SLOT_LABELS[pick.slot].toLowerCase()}` : `${SLOT_LABELS[pick.slot]} on ${DAY_LABELS[pick.day]}`}
          confirmLabel={pick.replaceId ? 'Replace meal' : 'Add meal'} initialRecipeId={pick.recipeId} initialServings={pick.servings}
          onPick={onPick} onClose={() => setPick(null)} />
      )}
      {copy && (
        <Modal title={`Repeat ${recipeById.get(copy.entry.recipeId)?.name ?? 'meal'}`} onClose={() => setCopy(null)}
          footer={<><Button variant="ghost" onClick={() => setCopy(null)}>Cancel</Button><Button variant="primary" icon={<Copy size={16} />} disabled={!copyDays.length} onClick={doCopy}>Repeat meal</Button></>}>
          <p className="muted">Add it as {SLOT_LABELS[copy.slot].toLowerCase()} on:</p>
          <div className="day-checks">
            {DAYS.filter((d) => d !== copy.day).map((d) => (
              <label key={d} className="check">
                <input type="checkbox" checked={copyDays.includes(d)} onChange={(e) => setCopyDays((l) => (e.target.checked ? [...l, d] : l.filter((x) => x !== d)))} />
                {DAY_LABELS[d]}
              </label>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setCopyDays(DAYS.filter((d) => d !== copy.day))}>Select every other day</Button>
        </Modal>
      )}
    </div>
  );
}

export function PlannerPage({ tab, setTab, goShopping }: { tab: PlannerTab; setTab: (t: PlannerTab) => void; goShopping: () => void }) {
  const generate = useGenerateList();
  const run = (src: 'quick' | 'week') => { if (generate(src)) goShopping(); };
  return (
    <section className="page">
      <header className="page-head">
        <div>
          <h1>Meal planner</h1>
          <p className="muted">Pick meals for a quick shop, or plan the whole week.</p>
        </div>
      </header>
      <Chips label="Planning mode" value={tab} onChange={setTab}
        options={[{ value: 'quick', label: 'Quick selection' }, { value: 'week', label: 'Weekly plan' }]} />
      <div className="tab-panel">
        {tab === 'quick' ? <QuickSelection onGenerate={() => run('quick')} /> : <WeekPlanner onGenerate={() => run('week')} />}
      </div>
      <p className="muted small tab-hint"><CalendarRange size={14} aria-hidden /> The shopping list can also combine both. Choose that on the Shopping list page.</p>
    </section>
  );
}
