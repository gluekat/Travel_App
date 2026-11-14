/** 12-hour time picker backed by an HH:mm string. */

const sel = 'rounded border border-slate-300 bg-white py-1 px-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500';

function parseTime(value: string): { h: number; m: number; period: 'AM' | 'PM' } | null {
  const parts = value.split(':');
  const h24 = parseInt(parts[0] ?? '', 10);
  const m = parseInt(parts[1] ?? '', 10);
  if (isNaN(h24) || isNaN(m)) return null;
  const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
  const h = h24 % 12 || 12;
  return { h, m, period };
}

function to24h(h: number, m: number, period: 'AM' | 'PM'): string {
  let h24 = h % 12;
  if (period === 'PM') h24 += 12;
  return `${String(h24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function TimeInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseTime(value);

  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(to24h(12, 0, 'PM'))}
        className="rounded border border-slate-300 px-2 py-1 text-sm text-slate-400 hover:border-teal-500 hover:text-teal-700"
      >
        Set time
      </button>
    );
  }

  const h = parsed?.h ?? 12;
  const m = parsed?.m ?? 0;
  const period = parsed?.period ?? 'AM';

  return (
    <div className="flex items-center gap-1">
      <select className={sel} value={h} onChange={(e) => onChange(to24h(Number(e.target.value), m, period))}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((v) => (
          <option key={v} value={v}>{v}</option>
        ))}
      </select>
      <span className="text-slate-400">:</span>
      <select className={sel} value={m} onChange={(e) => onChange(to24h(h, Number(e.target.value), period))}>
        {Array.from({ length: 60 }, (_, i) => i).map((v) => (
          <option key={v} value={v}>{String(v).padStart(2, '0')}</option>
        ))}
      </select>
      <select className={sel} value={period} onChange={(e) => onChange(to24h(h, m, e.target.value as 'AM' | 'PM'))}>
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
      <button
        type="button"
        onClick={() => onChange('')}
        className="ml-0.5 text-slate-400 hover:text-slate-600"
        aria-label="Clear time"
      >
        ×
      </button>
    </div>
  );
}
