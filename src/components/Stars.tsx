/** 0-5 star favorite score. Read-only unless `onChange` is given; clicking the current score clears it. */
export function Stars({
  value = 0,
  onChange,
  size = 'md',
  label = 'Favorite score',
}: {
  value?: number;
  onChange?: (n: number) => void;
  size?: 'sm' | 'md';
  label?: string;
}) {
  const cls = size === 'sm' ? 'text-xs' : 'text-lg';
  if (!onChange) {
    return (
      <span className={`${cls} leading-none text-amber-500`} aria-label={`${label}: ${value} of 5`} title={`${value} of 5`}>
        {'★'.repeat(value)}
        <span className="text-slate-300">{'★'.repeat(5 - value)}</span>
      </span>
    );
  }
  return (
    <span role="radiogroup" aria-label={label} className={`inline-flex ${cls} leading-none`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onChange(value === n ? 0 : n)}
          className={`px-0.5 ${n <= value ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'}`}
        >
          ★
        </button>
      ))}
    </span>
  );
}
