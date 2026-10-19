import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppData } from '../types';
import { PersistenceSession } from './persistence';
import { createDefaultData, localStorageAdapter, parseAppData, RECOVERY_KEY, STORAGE_KEY, type StorageAdapter } from './storage';

function memory(initial: string | null) {
  let raw = initial;
  let backup: string | null = null;
  const adapter: StorageAdapter = {
    load: vi.fn(() => raw),
    save: vi.fn((value: string) => { raw = value; }),
    backup: vi.fn((value: string) => { backup = value; }),
    loadBackup: vi.fn(() => backup),
  };
  return { adapter, raw: () => raw, backup: () => backup, externalWrite: (value: string) => { raw = value; } };
}
const valid = () => JSON.stringify(createDefaultData(), null, 2);
const withTheme = (data: AppData): AppData => ({ ...data, settings: { ...data.settings, theme: 'dark' } });
afterEach(() => vi.unstubAllGlobals());

describe('recovery-safe loading', () => {
  it('does not write defaults when storage is empty', () => {
    const m = memory(null); const s = new PersistenceSession(m.adapter);
    expect(s.getSnapshot().persistence.kind).toBe('idle');
    expect(s.getSnapshot().data.recipes.length).toBeGreaterThan(0);
    s.save();
    expect(m.raw()).toBeNull(); expect(m.adapter.save).not.toHaveBeenCalled();
  });
  it('loads valid v1 data without normalizing its original saved bytes', () => {
    const raw = valid(); const m = memory(raw); const s = new PersistenceSession(m.adapter);
    expect(s.getSnapshot().data).toEqual(createDefaultData());
    expect(s.getSnapshot().persistence.kind).toBe('saved');
    s.save(); s.retryLoad();
    expect(m.raw()).toBe(raw); expect(m.adapter.save).not.toHaveBeenCalled();
  });
  it.each(['', '{broken', JSON.stringify({ version: 1, foods: 'wrong', recipes: [] }), JSON.stringify({ ...createDefaultData(), version: -1 })])('preserves invalid saved content exactly: %j', (raw) => {
    const m = memory(raw); const s = new PersistenceSession(m.adapter);
    expect(s.getSnapshot().persistence).toMatchObject({ kind: 'recovery', reason: 'invalid', raw });
    s.update(withTheme); s.save(); s.retryLoad();
    expect(m.raw()).toBe(raw); expect(m.adapter.save).not.toHaveBeenCalled(); expect(m.adapter.backup).not.toHaveBeenCalled();
  });
  it('distinguishes newer data and never downgrades it', () => {
    const raw = JSON.stringify({ ...createDefaultData(), version: 2, futureField: 'keep' });
    const m = memory(raw); const s = new PersistenceSession(m.adapter);
    expect(s.getSnapshot().persistence).toMatchObject({ kind: 'recovery', reason: 'newer', raw });
    s.save(); expect(m.raw()).toBe(raw);
  });
  it('blocks both edits and replacement after denied reads, until a successful retry', () => {
    const raw = valid(); const m = memory(raw);
    vi.mocked(m.adapter.load).mockImplementationOnce(() => { throw new Error('denied'); });
    const s = new PersistenceSession(m.adapter);
    expect(s.getSnapshot().persistence).toMatchObject({ kind: 'recovery', reason: 'unavailable', raw: null });
    s.update(withTheme); expect(s.replaceAll(createDefaultData())).toBe(false);
    expect(m.adapter.save).not.toHaveBeenCalled(); expect(m.adapter.backup).not.toHaveBeenCalled();
    s.retryLoad(); expect(s.getSnapshot().persistence.kind).toBe('saved'); expect(m.raw()).toBe(raw);
  });
  it('can retry after the stored data is repaired outside the session', () => {
    const m = memory('{broken'); const s = new PersistenceSession(m.adapter);
    m.externalWrite(valid()); s.retryLoad();
    expect(s.getSnapshot().persistence.kind).toBe('saved');
    expect(m.adapter.save).not.toHaveBeenCalled();
  });
});

describe('saving and explicit replacement', () => {
  it('saves edits and reloads them', () => {
    const m = memory(valid()); const s = new PersistenceSession(m.adapter);
    s.update(withTheme); expect(s.getSnapshot().persistence.kind).toBe('pending');
    expect(s.save()).toBe(true);
    const reloaded = new PersistenceSession(m.adapter);
    expect(reloaded.getSnapshot().data.settings.theme).toBe('dark');
    expect(reloaded.getSnapshot().persistence.kind).toBe('saved');
  });
  it('keeps previous bytes and in-memory edits after a failed write, then retries the latest work', () => {
    const raw = valid(); const m = memory(raw); const s = new PersistenceSession(m.adapter);
    vi.mocked(m.adapter.save).mockImplementationOnce(() => { throw new Error('quota'); });
    s.update(withTheme); expect(s.save()).toBe(false);
    expect(m.raw()).toBe(raw); expect(s.getSnapshot().persistence.kind).toBe('error');
    expect(s.getSnapshot().data.settings.theme).toBe('dark');
    s.update((d) => ({ ...d, quick: [{ id: 'm', recipeId: d.recipes[0].id, servings: 3 }] }));
    expect(s.getSnapshot().persistence.kind).toBe('error');
    s.retryLoad(); expect(s.getSnapshot().data.quick).toHaveLength(1);
    expect(s.save()).toBe(true); expect(JSON.parse(m.raw()!).quick[0].servings).toBe(3);
  });
  it('does not overwrite storage changed by another tab', () => {
    const m = memory(valid()); const s = new PersistenceSession(m.adapter);
    s.update(withTheme); const other = JSON.stringify({ ...createDefaultData(), version: 9 }); m.externalWrite(other);
    expect(s.save()).toBe(false); expect(s.replaceAll(createDefaultData())).toBe(false);
    expect(m.raw()).toBe(other); expect(m.adapter.backup).not.toHaveBeenCalled();
    expect(s.getSnapshot().data.settings.theme).toBe('dark');
  });
  it('preserves previous saved data when a read fails during saving', () => {
    const raw = valid(); const m = memory(raw); const s = new PersistenceSession(m.adapter); s.update(withTheme);
    vi.mocked(m.adapter.load).mockImplementationOnce(() => { throw new Error('denied'); });
    expect(s.save()).toBe(false); expect(m.adapter.save).not.toHaveBeenCalled(); expect(m.raw()).toBe(raw);
  });
  it('archives exact corrupt bytes before a confirmed replacement', () => {
    const raw = '{unreadable\n\u2603'; const m = memory(raw); const s = new PersistenceSession(m.adapter);
    expect(s.replaceAll(withTheme(createDefaultData()))).toBe(true);
    expect(m.backup()).toBe(raw); expect(s.readBackup()).toBe(raw);
    expect(JSON.parse(m.raw()!).settings.theme).toBe('dark');
    expect(s.getSnapshot().persistence.kind).toBe('saved');
    expect(vi.mocked(m.adapter.backup).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(m.adapter.save).mock.invocationCallOrder[0]);
  });
  it('aborts replacement if preserving the old data fails', () => {
    const raw = '{corrupt'; const m = memory(raw); const s = new PersistenceSession(m.adapter);
    vi.mocked(m.adapter.backup).mockImplementation(() => { throw new Error('quota'); });
    expect(s.replaceAll(createDefaultData())).toBe(false);
    expect(m.raw()).toBe(raw); expect(m.adapter.save).not.toHaveBeenCalled();
    expect(s.getSnapshot().persistence).toMatchObject({ kind: 'recovery', raw });
  });
  it('keeps recovery data and the original if replacement write fails after backup succeeds', () => {
    const raw = '{corrupt'; const m = memory(raw); const s = new PersistenceSession(m.adapter);
    vi.mocked(m.adapter.save).mockImplementationOnce(() => { throw new Error('quota'); });
    expect(s.replaceAll(createDefaultData())).toBe(false);
    expect(m.raw()).toBe(raw); expect(m.backup()).toBe(raw);
    expect(s.getSnapshot().persistence.kind).toBe('recovery');
    expect(s.replaceAll(createDefaultData())).toBe(true);
  });
  it('preserves a valid pre-import snapshot and does not replace in-memory work on failure', () => {
    const raw = valid(); const m = memory(raw); const s = new PersistenceSession(m.adapter); s.update(withTheme);
    vi.mocked(m.adapter.save).mockImplementationOnce(() => { throw new Error('quota'); });
    expect(s.replaceAll(createDefaultData())).toBe(false);
    expect(m.raw()).toBe(raw); expect(m.backup()).toBe(raw);
    expect(s.getSnapshot().data.settings.theme).toBe('dark');
  });
  it('does not need a recovery copy for an empty store', () => {
    const m = memory(null); const s = new PersistenceSession(m.adapter);
    expect(s.replaceAll(createDefaultData())).toBe(true); expect(m.adapter.backup).not.toHaveBeenCalled();
  });
  it('rejects missing and unsupported versions rather than silently relabeling them', () => {
    expect(() => parseAppData({ ...createDefaultData(), version: undefined })).toThrow(/version/);
    expect(() => parseAppData({ ...createDefaultData(), version: 0 })).toThrow(/version/);
    expect(() => parseAppData({ ...createDefaultData(), version: 2 })).toThrow(/newer/);
  });
});

describe('browser adapter failure propagation', () => {
  it('throws when browser storage is missing instead of treating saves as successful', () => {
    vi.stubGlobal('localStorage', undefined);
    expect(() => localStorageAdapter.load()).toThrow(/unavailable/);
    expect(() => localStorageAdapter.save('data')).toThrow(/unavailable/);
    expect(() => localStorageAdapter.backup('data')).toThrow(/unavailable/);
  });
  it('propagates denied reads and quota errors without clearing existing data', () => {
    const setItem = vi.fn(() => { throw new Error('quota'); });
    const removeItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('denied'); }, setItem, removeItem });
    expect(() => localStorageAdapter.load()).toThrow('denied');
    expect(() => localStorageAdapter.save('new')).toThrow('quota');
    expect(() => localStorageAdapter.backup('old')).toThrow('quota');
    expect(setItem).toHaveBeenCalledWith(STORAGE_KEY, 'new');
    expect(setItem).toHaveBeenCalledWith(RECOVERY_KEY, 'old');
    expect(removeItem).not.toHaveBeenCalled();
  });
});
