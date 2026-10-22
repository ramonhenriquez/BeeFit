import { BeeMark } from './BeeMark';

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="bee-brand-icon"><BeeMark size={compact ? 34 : 48} /></span>
      <span className="brand-type">
        <span className="brand-name">Bee<span>Fit</span><span className="brand-dot" aria-hidden="true">.</span></span>
        {!compact && <span className="brand-tagline">Fuel. Train. Repeat.</span>}
      </span>
    </div>
  );
}
