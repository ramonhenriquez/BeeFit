import type { AppData } from '../types';
import { createDefaultData, NewerVersionError, parseAppData, type StorageAdapter } from './storage';

export type PersistenceStatus =
  | { kind: 'idle' | 'saved' | 'pending' }
  | { kind: 'error'; message: string }
  | { kind: 'recovery'; reason: 'invalid' | 'newer' | 'unavailable'; raw: string | null; message: string };

interface Snapshot {
  data: AppData;
  persistence: PersistenceStatus;
}

const SAVE_ERROR = 'Changes could not be saved. Your work is still open here, but may be lost if you close or reload. Export a backup, or free browser storage and retry.';

/** One tab's synchronous persistence boundary. Construction and load never write. */
export class PersistenceSession {
  private snapshot!: Snapshot;
  private expectedRaw: string | null | undefined;
  private listeners = new Set<() => void>();

  constructor(private adapter: StorageAdapter) {
    this.read();
  }

  getSnapshot = (): Snapshot => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(snapshot: Snapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  private read() {
    let raw: string | null;
    try {
      raw = this.adapter.load();
    } catch {
      this.expectedRaw = undefined;
      this.publish({
        data: createDefaultData(),
        persistence: { kind: 'recovery', reason: 'unavailable', raw: null,
          message: 'Saved data could not be read. Nothing has been overwritten. Allow browser storage and retry before restoring or starting over.' },
      });
      return;
    }
    this.expectedRaw = raw;
    try {
      const data = raw === null ? createDefaultData() : parseAppData(JSON.parse(raw));
      this.publish({ data, persistence: { kind: raw === null ? 'idle' : 'saved' } });
    } catch (error) {
      this.publish({
        data: createDefaultData(),
        persistence: {
          kind: 'recovery', raw, reason: error instanceof NewerVersionError ? 'newer' : 'invalid',
          message: error instanceof NewerVersionError
            ? 'Saved data belongs to a newer version of Larder. Use that version to open it, or export the original before choosing a replacement.'
            : 'Saved data could not be opened. The original is untouched. Export it for recovery, retry loading, or explicitly choose a replacement.',
        },
      });
    }
  }

  retryLoad = () => {
    // Never discard unsaved work through a load retry on an ordinary page.
    if (this.snapshot.persistence.kind === 'recovery') this.read();
  };

  update = (fn: (data: AppData) => AppData) => {
    if (this.snapshot.persistence.kind === 'recovery') return;
    const data = fn(this.snapshot.data);
    if (data === this.snapshot.data) return;
    this.publish({ data, persistence: this.snapshot.persistence.kind === 'error'
      ? this.snapshot.persistence : { kind: 'pending' } });
  };

  private ensureUnchanged() {
    if (this.expectedRaw === undefined) throw new Error('Saved data must be read before it can be replaced.');
    if (this.adapter.load() !== this.expectedRaw) throw new Error('Saved data changed in another tab.');
  }

  save = (): boolean => {
    const { data, persistence } = this.snapshot;
    if (persistence.kind !== 'pending' && persistence.kind !== 'error') return false;
    try {
      this.ensureUnchanged();
    } catch {
      this.publish({ data, persistence: { kind: 'error', message: 'Saved data could not be checked, or has changed in another tab. Nothing was overwritten. Export your open work before reloading; retry if storage access was temporarily blocked.' } });
      return false;
    }
    try {
      const raw = JSON.stringify(data);
      this.adapter.save(raw);
      this.expectedRaw = raw;
      this.publish({ data, persistence: { kind: 'saved' } });
      return true;
    } catch {
      this.publish({ data, persistence: { kind: 'error', message: SAVE_ERROR } });
      return false;
    }
  };

  /** Call only after the user confirms import/reset. Back up before replacing. */
  replaceAll = (data: AppData): boolean => {
    const previous = this.snapshot;
    try {
      this.ensureUnchanged();
      const raw = JSON.stringify(data);
      // A failed backup aborts replacement; never clear the primary key first.
      if (this.expectedRaw !== null) this.adapter.backup(this.expectedRaw!);
      this.adapter.save(raw);
      this.expectedRaw = raw;
      this.publish({ data, persistence: { kind: 'saved' } });
      return true;
    } catch {
      const message = 'Replacement was not saved. The original saved data is unchanged. Export a backup and check browser storage access or available space, then retry. If another tab changed the data, export your open work before reloading.';
      this.publish({ ...previous, persistence: previous.persistence.kind === 'recovery'
        ? { ...previous.persistence, message } : { kind: 'error', message } });
      return false;
    }
  };

  readBackup = () => this.adapter.loadBackup();
}
