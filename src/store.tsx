import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { AppData, Food, Recipe } from './types';
import { createDefaultData, localStorageAdapter, type StorageAdapter } from './lib/storage';

// One context holds all app data. `update` takes a function that returns the
// next state (never mutate the argument). Saves are debounced so typing in a
// quantity field doesn't hammer storage.

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  replaceAll: (d: AppData) => void;
  foodById: Map<string, Food>;
  recipeById: Map<string, Recipe>;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children, adapter = localStorageAdapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const [data, setData] = useState<AppData>(() => adapter.load() ?? createDefaultData());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();
  const saveTimer = useRef<number>();

  useEffect(() => {
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => adapter.save(data), 250);
  }, [data, adapter]);

  // Flush pending save when the tab is hidden or closed.
  useEffect(() => {
    const flush = () => adapter.save(dataRef.current);
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, [adapter]);
  const dataRef = useRef(data);
  dataRef.current = data;

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const replaceAll = useCallback((d: AppData) => setData(d), []);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const foodById = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const recipeById = useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);

  const value = useMemo(
    () => ({ data, update, replaceAll, foodById, recipeById, toast, toastMsg }),
    [data, update, replaceAll, foodById, recipeById, toast, toastMsg],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
