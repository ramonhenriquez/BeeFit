import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { AppData, Food, Recipe } from './types';
import { localStorageAdapter, type StorageAdapter } from './lib/storage';
import { PersistenceSession, type PersistenceStatus } from './lib/persistence';

interface Store {
  data: AppData;
  update: (fn: (d: AppData) => AppData) => void;
  replaceAll: (d: AppData) => boolean;
  persistence: PersistenceStatus;
  retrySave: () => boolean;
  retryLoad: () => void;
  readBackup: () => string | null;
  foodById: Map<string, Food>;
  recipeById: Map<string, Recipe>;
  toast: (msg: string) => void;
  toastMsg: string | null;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children, adapter = localStorageAdapter }: { children: ReactNode; adapter?: StorageAdapter }) {
  const [session] = useState(() => new PersistenceSession(adapter));
  const { data, persistence } = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<number>();

  useEffect(() => {
    // No initial/default writes, no automatic retry after failure, no writes in recovery.
    if (persistence.kind !== 'pending') return;
    const timer = window.setTimeout(session.save, 250);
    return () => window.clearTimeout(timer);
  }, [data, persistence.kind, session]);

  useEffect(() => {
    const flush = () => {
      if (session.getSnapshot().persistence.kind === 'pending') session.save();
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      flush();
      if (session.getSnapshot().persistence.kind === 'error') {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [session]);

  useEffect(() => () => window.clearTimeout(toastTimer.current), []);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(null), 2800);
  }, []);

  const foodById = useMemo(() => new Map(data.foods.map((f) => [f.id, f])), [data.foods]);
  const recipeById = useMemo(() => new Map(data.recipes.map((r) => [r.id, r])), [data.recipes]);
  const value = useMemo(() => ({
    data, persistence, update: session.update, replaceAll: session.replaceAll,
    retrySave: session.save, retryLoad: session.retryLoad, readBackup: session.readBackup,
    foodById, recipeById, toast, toastMsg,
  }), [data, persistence, session, foodById, recipeById, toast, toastMsg]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore must be used inside StoreProvider');
  return s;
}
