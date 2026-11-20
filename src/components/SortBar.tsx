import { Chip } from './ui';

export type SortDir = 'asc' | 'desc';

/**
 * A row of sort buttons. Choosing a method sorts ascending; choosing the active one again reverses the order.
 */
export function SortBar<K extends string>({ options, value, dir, onChange, label = 'Sort by' }: { options: { key: K; label: string }[]; value: K; dir: SortDir; onChange: (key: K, dir: SortDir) => void; label?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="text-xs font-medium text-slate-500">Sort:</span>
      {options.map((o) => {
        const active = o.key === value;
        return (
          <Chip key={o.key} active={active} onClick={() => onChange(o.key, active ? (dir === 'asc' ? 'desc' : 'asc') : 'asc')}>
            {o.label}
            {active && <span aria-label={dir === 'asc' ? 'ascending' : 'descending'}> {dir === 'asc' ? '▲' : '▼'}</span>}
          </Chip>
        );
      })}
    </div>
  );
}
