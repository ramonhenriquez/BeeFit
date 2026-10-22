import { CalendarDays, ShoppingBasket, Zap } from 'lucide-react';
import { useStore } from '../store';
import { DAYS, DAY_LABELS, SLOTS, SLOT_LABELS } from '../types';
import { Button } from '../components/ui';
import { todayKey, type PlannerTab } from './Planner';
import type { Page } from '../App';
import { BeeMark } from '../components/BeeMark';

export function DashboardPage({ go }: { go: (p: Page, tab?: PlannerTab) => void }) {
  const { data, recipeById } = useStore();
  const today = todayKey();
  const todays = SLOTS.flatMap((s) => data.week[today][s].map((m) => ({ slot: s, m, r: recipeById.get(m.recipeId) }))).filter((x) => x.r);
  const dinner = todays.find((x) => x.slot === 'dinner') ?? todays[todays.length - 1];
  const weekCount = DAYS.reduce((n, d) => n + SLOTS.reduce((k, s) => k + data.week[d][s].length, 0), 0);
  const left = data.grocery.filter((g) => !g.checked).length;
  const total = data.grocery.length;

  const steps = [
    { label: 'Choose meals', done: weekCount + data.quick.length > 0 },
    { label: 'Adjust servings', done: weekCount + data.quick.length > 0 },
    { label: 'Generate the list', done: data.grocery.some((g) => g.source === 'generated') },
    { label: 'Go shopping', done: total > 0 && left === 0 },
  ];

  return (
    <section className="page dashboard-page">
      <div className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Better meals. Stronger habits.</p>
          <p className="hero-date">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
          {dinner ? (
            <>
              <h1 className="hero-title"><span className="hero-emoji" aria-hidden>{dinner.r!.emoji}</span>{dinner.r!.name}</h1>
              <p className="hero-sub">{SLOT_LABELS[dinner.slot]} today, for {dinner.m.servings}.{todays.length > 1 ? ` Plus ${todays.length - 1} more meal${todays.length > 2 ? 's' : ''} planned.` : ''}</p>
            </>
          ) : (
            <>
              <h1 className="hero-title">Fuel your<br /><span>next rep.</span></h1>
              <p className="hero-sub">Good weeks start with a plan. Choose your meals. We’ll handle the shopping list.</p>
            </>
          )}
          <div className="btn-row">
            <Button variant="primary" size="lg" icon={<CalendarDays size={20} />} onClick={() => go('planner', 'week')}>Plan the week</Button>
            <Button size="lg" icon={<Zap size={20} />} onClick={() => go('planner', 'quick')}>Quick pick</Button>
          </div>
        </div>
        <div className="hero-art" aria-hidden="true"><div className="hero-orbit" /><BeeMark size={200} /><span className="hero-art-caption">BUILT ONE MEAL AT A TIME</span></div>
      </div>

      <section className="dashboard-metrics" aria-label="Your kitchen at a glance">
        <div><span className="metric-number">{weekCount.toString().padStart(2, '0')}</span><span className="metric-label">Meals this week</span><CalendarDays size={19} aria-hidden /></div>
        <div><span className="metric-number">{data.recipes.length.toString().padStart(2, '0')}</span><span className="metric-label">Recipes to explore</span><Zap size={19} aria-hidden /></div>
        <div><span className="metric-number">{left.toString().padStart(2, '0')}</span><span className="metric-label">Items left to buy</span><ShoppingBasket size={19} aria-hidden /></div>
      </section>

      <ol className="flow" aria-label="How it works">
        {steps.map((s, i) => (
          <li key={s.label} className={s.done ? 'is-done' : ''}><span className="flow-n">{i + 1}</span>{s.label}</li>
        ))}
      </ol>

      <div className="dash-grid">
        <article className="panel">
          <header className="panel-head"><h2>This week</h2><button type="button" className="link" onClick={() => go('planner', 'week')}>Edit plan</button></header>
          <ul className="week-glance">
            {DAYS.map((d) => {
              const meals = SLOTS.flatMap((s) => data.week[d][s]).map((m) => recipeById.get(m.recipeId)).filter(Boolean);
              return (
                <li key={d} className={d === today ? 'is-today' : ''}>
                  <span className="wg-day">{DAY_LABELS[d].slice(0, 3)}</span>
                  <span className="wg-meals">{meals.length ? meals.map((r, i) => <span key={i} title={r!.name} aria-label={r!.name}>{r!.emoji}</span>) : <span className="muted small">—</span>}</span>
                </li>
              );
            })}
          </ul>
          <p className="muted small">{weekCount ? `${weekCount} meals planned.` : 'Nothing planned yet.'}</p>
        </article>

        <article className="panel panel-list">
          <header className="panel-head"><h2>Shopping</h2><button type="button" className="link" onClick={() => go('shopping')}>Open list</button></header>
          {total ? (
            <>
              <p className="big-line">{left === 0 ? 'Everything’s in the basket.' : `${left} item${left === 1 ? '' : 's'} to buy`}</p>
              <div className="progress" aria-hidden><span style={{ width: `${((total - left) / total) * 100}%` }} /></div>
              <ul className="peek">
                {data.grocery.filter((g) => !g.checked).slice(0, 5).map((g) => <li key={g.id}>{g.name}</li>)}
              </ul>
            </>
          ) : (
            <>
              <p className="muted">No list yet.</p>
              <Button variant="primary" icon={<ShoppingBasket size={18} />} onClick={() => go('shopping')}>Go to shopping list</Button>
            </>
          )}
        </article>

        <article className="panel">
          <header className="panel-head"><h2>Kitchen</h2></header>
          <ul className="kitchen-stats">
            <li><button type="button" className="link" onClick={() => go('recipes')}>{data.recipes.length} recipes</button></li>
            <li><button type="button" className="link" onClick={() => go('foods')}>{data.foods.length} foods</button></li>
            <li><button type="button" className="link" onClick={() => go('pantry')}>{data.pantry.filter((p) => p.available).length} pantry items in stock</button></li>
            <li><button type="button" className="link" onClick={() => go('planner', 'quick')}>{data.quick.length} in quick selection</button></li>
          </ul>
        </article>
      </div>
    </section>
  );
}
