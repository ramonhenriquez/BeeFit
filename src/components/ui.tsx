import {
  createContext, useCallback, useContext, useEffect, useId, useRef, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react';
import { Minus, Plus, Search, X } from 'lucide-react';
import type { Category, Food, Unit } from '../types';
import { CATEGORIES, CATEGORY_LABELS, UNITS, UNIT_LABELS } from '../types';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary', size, icon, children, className = '', ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'lg'; icon?: ReactNode }) {
  return (
    <button type="button" className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} {...rest}>
      {icon}
      {children && <span>{children}</span>}
    </button>
  );
}

export function IconButton({ label, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className={`icon-btn ${className}`} aria-label={label} title={label} {...rest}>
      {children}
    </button>
  );
}

export function Modal({ title, onClose, children, footer, wide }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const first = ref.current?.querySelector<HTMLElement>('input, select, textarea, button:not(.modal-close)');
    (first ?? ref.current)?.focus();
    // Only the top-most modal reacts to Escape (modals can stack).
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      const all = document.querySelectorAll('.modal');
      if (all[all.length - 1] === ref.current) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('no-scroll');
    return () => {
      document.removeEventListener('keydown', onKey);
      if (document.querySelectorAll('.modal').length <= 1) document.body.classList.remove('no-scroll');
      prev?.focus?.();
    };
  }, [onClose]);
  return (
    <div className="modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref} tabIndex={-1}>
        <header className="modal-head">
          <h2 id={titleId}>{title}</h2>
          <IconButton label="Close" className="modal-close" onClick={onClose}><X size={20} /></IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className={`field ${error ? 'has-error' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error" role="alert">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

/** Number input that lets people type freely and reports NaN for blanks. */
export function NumberInput({ value, onChange, min = 0, step = 'any', ...rest }: {
  value: number | null; onChange: (n: number) => void; min?: number; step?: number | 'any';
  'aria-label'?: string; className?: string; id?: string;
}) {
  const [text, setText] = useState(value === null || Number.isNaN(value) ? '' : String(value));
  useEffect(() => {
    if (Number(text) !== value) setText(value === null || Number.isNaN(value) ? '' : String(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return (
    <input
      type="number" inputMode="decimal" min={min} step={step} value={text}
      onChange={(e) => { setText(e.target.value); onChange(e.target.value === '' ? NaN : Number(e.target.value)); }}
      {...rest}
    />
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: {
  value: number; onChange: (n: number) => void; min?: number; max?: number; label: string;
}) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <IconButton label={`Fewer ${label.toLowerCase()}`} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))}><Minus size={14} /></IconButton>
      <span className="stepper-value" aria-live="polite">{value}</span>
      <IconButton label={`More ${label.toLowerCase()}`} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))}><Plus size={14} /></IconButton>
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (s: string) => void; placeholder: string }) {
  return (
    <div className="search">
      <Search size={18} aria-hidden />
      <input type="search" value={value} placeholder={placeholder} aria-label={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && <IconButton label="Clear search" onClick={() => onChange('')}><X size={16} /></IconButton>}
    </div>
  );
}

export function UnitSelect({ value, onChange, allowNone, ...rest }: {
  value: Unit | null; onChange: (u: Unit | null) => void; allowNone?: boolean; 'aria-label'?: string; className?: string;
}) {
  return (
    <select value={value ?? ''} onChange={(e) => onChange((e.target.value || null) as Unit | null)} {...rest}>
      {allowNone && <option value="">—</option>}
      <optgroup label="Weight">{(['g', 'kg', 'oz', 'lb'] as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}</optgroup>
      <optgroup label="Volume">{(['ml', 'l', 'tsp', 'tbsp', 'cup', 'fl_oz'] as Unit[]).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}</optgroup>
      <optgroup label="Count">{UNITS.slice(10).map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}</optgroup>
    </select>
  );
}

export function CategorySelect({ value, onChange, ...rest }: { value: Category; onChange: (c: Category) => void; 'aria-label'?: string }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value as Category)} {...rest}>
      {CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>)}
    </select>
  );
}

export function FoodSelect({ foods, value, onChange, ...rest }: {
  foods: Food[]; value: string; onChange: (id: string) => void; 'aria-label'?: string; className?: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
      {!value && <option value="">Choose a food…</option>}
      {CATEGORIES.map((c) => {
        const list = foods.filter((f) => f.category === c).sort((a, b) => a.name.localeCompare(b.name));
        if (!list.length) return null;
        return <optgroup key={c} label={CATEGORY_LABELS[c]}>{list.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</optgroup>;
      })}
    </select>
  );
}

export function Chips<T extends string>({ options, value, onChange, label }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string;
}) {
  return (
    <div className="chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={`chip ${value === o.value ? 'is-active' : ''}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon" aria-hidden>{icon}</div>}
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

// ---- Confirm dialog -------------------------------------------------------
// window.confirm is blocked in some sandboxed iframes, so we use our own.

interface ConfirmOpts { title: string; message?: string; confirmLabel: string; danger?: boolean }
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOpts & { resolve: (b: boolean) => void }) | null>(null);
  const confirm = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (b: boolean) => { state?.resolve(b); setState(null); };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <Modal title={state.title} onClose={() => close(false)}
          footer={<>
            <Button variant="ghost" onClick={() => close(false)}>Cancel</Button>
            <Button variant={state.danger ? 'danger' : 'primary'} onClick={() => close(true)}>{state.confirmLabel}</Button>
          </>}>
          {state.message && <p className="muted">{state.message}</p>}
        </Modal>
      )}
    </ConfirmCtx.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmCtx);
