import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useStore } from '../store';
import type { ThemePref } from '../types';
import { createDefaultData, ImportError, parseAppData } from '../lib/storage';
import { Button, Chips, useConfirm } from '../components/ui';
import { applyBeeFitTheme, BEEFIT_THEMES, readBeeFitTheme, type BeeFitTheme } from '../lib/appearance';

// When hosted on claude.ai the page runs in a sandbox where plain download
// links do nothing, so we use the host's `downloads` capability if present
// and fall back to a normal browser download everywhere else.
type DownloadsNs = { save(r: { filename: string; data: string }): Promise<unknown> };
declare global {
  interface Window { claude?: { use(name: string): Promise<unknown> } }
}

async function saveFile(filename: string, text: string): Promise<'saved' | 'declined' | 'fallback'> {
  try {
    const dl = (await window.claude?.use('downloads')) as DownloadsNs | null | undefined;
    if (dl) {
      try { await dl.save({ filename, data: text }); return 'saved'; } catch { return 'declined'; }
    }
  } catch { /* fall through */ }
  const url = URL.createObjectURL(new Blob([text], { type: filename.endsWith('.json') ? 'application/json' : 'text/plain;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'fallback';
}

export function SettingsPage() {
  const { data, update, replaceAll, toast, persistence, retryLoad, readBackup } = useStore();
  const recovery = persistence.kind === 'recovery' ? persistence : null;
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [appearance, setAppearance] = useState<BeeFitTheme>(readBeeFitTheme);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(false);
  const [previousCopy, setPreviousCopy] = useState<string | null>(null);
  const json = JSON.stringify(data, null, 2);

  const doImport = async (text: string) => {
    setError('');
    let parsed;
    try {
      parsed = parseAppData(JSON.parse(text));
    } catch (e) {
      setError(e instanceof ImportError ? e.message : 'That isn’t valid JSON. Check the file and try again.');
      return;
    }
    if (!(await confirm({ title: 'Replace all your data?', message: `This loads ${parsed.recipes.length} recipes and ${parsed.foods.length} foods and replaces everything currently open. Export your open work first. A copy of the previously stored data will be kept before replacement; it replaces the older recovery copy, if any.`, confirmLabel: 'Import backup', danger: true }))) return;
    if (!replaceAll(parsed)) {
      setError('Backup was not imported. Resolve the storage warning and try again.');
      return;
    }
    setPaste('');
    toast('Backup imported.');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try { await doImport(await f.text()); } catch { setError('Couldn’t read that file.'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportData = async () => {
    setShowJson(true);
    try {
      const r = await saveFile(`beefit-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
      if (r === 'saved') toast('Backup saved.');
      if (r === 'declined') toast('Backup not saved. You can copy the JSON below instead.');
    } catch { setError('Download could not start. Copy the backup JSON below instead.'); }
  };

  const exportRaw = async (raw: string) => {
    try {
      const result = await saveFile(`beefit-recovery-${new Date().toISOString().slice(0, 10)}.txt`, raw);
      if (result === 'declined') setError('Download was declined. Copy the original text below instead.');
    } catch { setError('Download could not start. Copy the original text below instead.'); }
  };

  const exportPrevious = async () => {
    try {
      const raw = readBackup();
      setPreviousCopy(raw);
      if (raw === null) { setError('There is no previous saved copy in this browser.'); return; }
      await exportRaw(raw);
    } catch { setError('The previous saved copy could not be read. Check browser storage access and retry.'); }
  };

  const reset = async () => {
    if (await confirm({ title: 'Reset everything?', message: 'Your open recipes, foods, plans, list, and pantry go back to the starting set. Export a backup first. The previously stored data will be kept as a recovery copy before replacement; it replaces the older recovery copy, if any.', confirmLabel: 'Reset app', danger: true })) {
      if (replaceAll(createDefaultData())) { setError(''); toast('App reset.'); }
      else setError('Reset was not saved. Resolve the storage warning and try again.');
    }
  };

  return (
    <section className="page narrow">
      <header className="page-head"><div><h1>{recovery ? 'Recover saved data' : 'Settings & backup'}</h1><p className="muted">Data stays in this browser. Export a backup to keep an independent copy.</p></div></header>

      {recovery && <div className="settings-block">
        <p role="alert">{recovery.message}</p>
        <Button onClick={retryLoad}>Retry loading saved data</Button>
        {recovery.raw !== null && <>
          <p>The original text is shown exactly as stored, even if it is not valid JSON. Keep a copy before restoring or resetting.</p>
          <Button icon={<Download size={18} />} onClick={() => exportRaw(recovery.raw!)}>Export original saved data</Button>
          <textarea className="json" readOnly rows={8} value={recovery.raw} aria-label="Original saved data" onFocus={(e) => e.currentTarget.select()} />
        </>}
      </div>}

      {!recovery && <div className="settings-block">
        <h2>Appearance</h2>
        <p className="muted">Choose a gym-inspired BeeFit theme. Your choice stays in this browser.</p>
        <div className="beefit-theme-grid" role="group" aria-label="BeeFit theme preset">
          {BEEFIT_THEMES.map((theme) => (
            <button key={theme.id} type="button" className={`beefit-theme-card ${appearance === theme.id ? 'is-selected' : ''}`} aria-pressed={appearance === theme.id} onClick={() => { setAppearance(theme.id); applyBeeFitTheme(theme.id); }}>
              <span className={`beefit-theme-swatch swatch-${theme.id}`} aria-hidden="true" />
              <strong>{theme.label}</strong><small>{theme.description}</small>
            </button>
          ))}
        </div>
        <Chips<ThemePref> label="Display mode" value={data.settings.theme} onChange={(theme) => update((d) => ({ ...d, settings: { ...d.settings, theme } }))}
          options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>}

      {!recovery && <div className="settings-block">
        <h2>Back up your data</h2>
        <p className="muted">Download everything as a JSON file to keep a copy or move it to another browser.</p>
        <div className="btn-row">
          <Button variant="primary" icon={<Download size={18} />} onClick={exportData}>Export backup</Button>
          <Button variant="ghost" onClick={() => setShowJson((s) => !s)}>{showJson ? 'Hide JSON' : 'Show JSON'}</Button>
        </div>
        {showJson && <textarea className="json" readOnly rows={8} value={json} onFocus={(e) => e.currentTarget.select()} aria-label="Backup JSON" />}
      </div>}

      <div className="settings-block">
        <h2>Previous saved copy</h2>
        <p className="muted">A restore or reset keeps one copy of the data it replaced. This is separate from your current work and may need recovery.</p>
        <Button onClick={exportPrevious}>Export previous saved copy</Button>
        {previousCopy !== null && <textarea className="json" readOnly rows={6} value={previousCopy} aria-label="Previous saved copy" onFocus={(e) => e.currentTarget.select()} />}
      </div>

      <div className="settings-block">
        <h2>Restore a backup</h2>
        <p className="muted">Importing requires confirmation. If the original saved copy cannot be preserved, replacement is stopped.</p>
        <div className="btn-row">
          <Button disabled={recovery?.reason === 'unavailable'} icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>Choose backup file</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="…or paste backup JSON here" aria-label="Paste backup JSON" />
        <div className="btn-row"><Button disabled={!paste.trim() || recovery?.reason === 'unavailable'} onClick={() => doImport(paste)}>Import pasted JSON</Button></div>
      </div>

      <div className="settings-block">
        <h2>Start over</h2>
        <div className="btn-row"><Button disabled={recovery?.reason === 'unavailable'} variant="danger" icon={<RotateCcw size={18} />} onClick={reset}>Reset app</Button></div>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
    </section>
  );
}
