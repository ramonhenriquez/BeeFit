import { useEffect, useState } from 'react';
import { BookOpen, CalendarDays, Carrot, Home, Settings, ShoppingBasket, Warehouse } from 'lucide-react';
import { useStore } from './store';
import { DashboardPage } from './pages/Dashboard';
import { FoodsPage } from './pages/Foods';
import { RecipesPage } from './pages/Recipes';
import { PlannerPage, type PlannerTab } from './pages/Planner';
import { ShoppingPage } from './pages/Shopping';
import { PantryPage } from './pages/Pantry';
import { SettingsPage } from './pages/Settings';
import { Button } from './components/ui';
import { BeeMark } from './components/BeeMark';
import { applyBeeFitTheme, readBeeFitTheme } from './lib/appearance';

export type Page = 'dashboard' | 'foods' | 'recipes' | 'planner' | 'shopping' | 'pantry' | 'settings';

const NAV: { page: Page; label: string; short: string; icon: typeof Home }[] = [
  { page: 'dashboard', label: 'Dashboard', short: 'Home', icon: Home },
  { page: 'planner', label: 'Meal planner', short: 'Plan', icon: CalendarDays },
  { page: 'shopping', label: 'Shopping list', short: 'List', icon: ShoppingBasket },
  { page: 'recipes', label: 'Recipes', short: 'Recipes', icon: BookOpen },
  { page: 'foods', label: 'Foods', short: 'Foods', icon: Carrot },
  { page: 'pantry', label: 'Pantry', short: 'Pantry', icon: Warehouse },
];

const pageFromHash = (): Page => {
  const h = window.location.hash.replace('#/', '') as Page;
  return ['dashboard', 'foods', 'recipes', 'planner', 'shopping', 'pantry', 'settings'].includes(h) ? h : 'dashboard';
};

export function App() {
  const { data, toastMsg, persistence, retrySave } = useStore();
  const [page, setPage] = useState<Page>(pageFromHash);
  const [plannerTab, setPlannerTab] = useState<PlannerTab>('week');

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => { applyBeeFitTheme(readBeeFitTheme()); }, []);

  useEffect(() => {
    const t = data.settings.theme;
    if (t === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', t);
  }, [data.settings.theme]);

  const go = (p: Page, tab?: PlannerTab) => {
    if (tab) setPlannerTab(tab);
    setPage(p);
    try { history.replaceState(null, '', `#/${p}`); } catch { /* sandboxed */ }
    window.scrollTo({ top: 0 });
  };

  const left = data.grocery.filter((g) => !g.checked).length;

  // A failed load must be resolved explicitly before any ordinary editing.
  if (persistence.kind === 'recovery') {
    return <main className="main"><SettingsPage /></main>;
  }

  return (
    <div className="shell">
      <a href="#main" className="skip">Skip to content</a>
      <nav className="sidebar" aria-label="Main">
        <div className="brand"><span className="bee-brand-icon"><BeeMark size={38} /></span><span className="brand-name">BeeFit</span></div>
        <ul>
          {NAV.map(({ page: p, label, short, icon: Icon }) => (
            <li key={p}>
              <button type="button" className={`nav-item ${page === p ? 'is-active' : ''}`} aria-current={page === p ? 'page' : undefined} onClick={() => go(p)}>
                <Icon size={20} aria-hidden />
                <span className="nav-label">{label}</span>
                <span className="nav-short">{short}</span>
                {p === 'shopping' && left > 0 && <span className="badge" aria-label={`${left} to buy`}>{left}</span>}
              </button>
            </li>
          ))}
          <li className="nav-settings">
            <button type="button" className={`nav-item ${page === 'settings' ? 'is-active' : ''}`} aria-current={page === 'settings' ? 'page' : undefined} onClick={() => go('settings')}>
              <Settings size={20} aria-hidden /><span className="nav-label">Settings & backup</span><span className="nav-short">More</span>
            </button>
          </li>
        </ul>
      </nav>
      <main id="main" className="main">
        {persistence.kind === 'error' && (
          <aside className="persistence-warning" role="alert">
            <strong>Changes are not saved</strong>
            <p>{persistence.message}</p>
            <div className="btn-row">
              <Button onClick={() => retrySave()}>Retry saving</Button>
              <Button onClick={() => go('settings')}>Open backup options</Button>
            </div>
          </aside>
        )}
        {page === 'dashboard' && <DashboardPage go={go} />}
        {page === 'foods' && <FoodsPage />}
        {page === 'recipes' && <RecipesPage />}
        {page === 'planner' && <PlannerPage tab={plannerTab} setTab={setPlannerTab} goShopping={() => go('shopping')} />}
        {page === 'shopping' && <ShoppingPage goPlanner={() => go('planner')} />}
        {page === 'pantry' && <PantryPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      <div className="toast" role="status" aria-live="polite">{toastMsg && <span key={toastMsg}>{toastMsg}</span>}</div>
    </div>
  );
}
