export default function ProgressBar({ value = 0, max = 100, label, className = '' }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const color =
    pct >= 70 ? 'bg-teal' :
    pct >= 45 ? 'bg-copper' :
    'bg-red-500';

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label !== undefined && (
        <div className="flex justify-between items-baseline">
          <span className="text-xs font-montserrat font-semibold text-ink/60 uppercase tracking-wider">{label}</span>
          <span className="text-sm font-montserrat font-bold text-ink">{Math.round(pct)}</span>
        </div>
      )}
      <div className="h-1 bg-ink/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
