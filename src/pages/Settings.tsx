import { useRef, useState } from 'react';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { useStore } from '../store';
import type { ThemePref } from '../types';
import { createDefaultData, ImportError, parseAppData } from '../lib/storage';
import { Button, Chips, useConfirm } from '../components/ui';

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
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'fallback';
}

export function SettingsPage() {
  const { data, update, replaceAll, toast } = useStore();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const [paste, setPaste] = useState('');
  const [error, setError] = useState('');
  const [showJson, setShowJson] = useState(false);
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
    if (!(await confirm({ title: 'Replace all your data?', message: `This loads ${parsed.recipes.length} recipes and ${parsed.foods.length} foods and replaces everything currently saved.`, confirmLabel: 'Import backup', danger: true }))) return;
    replaceAll(parsed);
    setPaste('');
    toast('Backup imported.');
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    try { await doImport(await f.text()); } catch { setError('Couldn’t read that file.'); }
    if (fileRef.current) fileRef.current.value = '';
  };

  const exportData = async () => {
    const r = await saveFile(`larder-backup-${new Date().toISOString().slice(0, 10)}.json`, json);
    if (r === 'saved') toast('Backup saved.');
    if (r === 'declined') toast('Backup not saved. You can copy the JSON below instead.');
    setShowJson(true);
  };

  const reset = async () => {
    if (await confirm({ title: 'Reset everything?', message: 'Your recipes, foods, plans, list, and pantry go back to the starting set. Export a backup first if you want to keep them.', confirmLabel: 'Reset app', danger: true })) {
      replaceAll(createDefaultData());
      toast('App reset.');
    }
  };

  return (
    <section className="page narrow">
      <header className="page-head"><div><h1>Settings & backup</h1><p className="muted">Your data is saved in this browser only. No account needed.</p></div></header>

      <div className="settings-block">
        <h2>Appearance</h2>
        <Chips<ThemePref> label="Theme" value={data.settings.theme} onChange={(theme) => update((d) => ({ ...d, settings: { ...d.settings, theme } }))}
          options={[{ value: 'system', label: 'Match device' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </div>

      <div className="settings-block">
        <h2>Back up your data</h2>
        <p className="muted">Download everything as a JSON file to keep a copy or move it to another browser.</p>
        <div className="btn-row">
          <Button variant="primary" icon={<Download size={18} />} onClick={exportData}>Export backup</Button>
          <Button variant="ghost" onClick={() => setShowJson((s) => !s)}>{showJson ? 'Hide JSON' : 'Show JSON'}</Button>
        </div>
        {showJson && <textarea className="json" readOnly rows={8} value={json} onFocus={(e) => e.currentTarget.select()} aria-label="Backup JSON" />}
      </div>

      <div className="settings-block">
        <h2>Restore a backup</h2>
        <p className="muted">Importing replaces all current data.</p>
        <div className="btn-row">
          <Button icon={<Upload size={18} />} onClick={() => fileRef.current?.click()}>Choose backup file</Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
        <textarea rows={4} value={paste} onChange={(e) => setPaste(e.target.value)} placeholder="…or paste backup JSON here" aria-label="Paste backup JSON" />
        <div className="btn-row"><Button disabled={!paste.trim()} onClick={() => doImport(paste)}>Import pasted JSON</Button></div>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>

      <div className="settings-block">
        <h2>Start over</h2>
        <div className="btn-row"><Button variant="danger" icon={<RotateCcw size={18} />} onClick={reset}>Reset app</Button></div>
      </div>
    </section>
  );
}
