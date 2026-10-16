/** Link-based tab bar: each tab is a route, so views are bookmarkable and survive reloads. */
export function Tabs<T extends string>({
  tabs,
  current,
  label,
}: {
  tabs: { id: T; label: string; href: string }[];
  current: T;
  label: string;
}) {
  return (
    <nav aria-label={label} className="no-print border-b border-slate-200">
      <ul className="-mb-px flex gap-1" role="tablist">
        {tabs.map((t) => {
          const active = t.id === current;
          return (
            <li key={t.id} role="presentation">
              <a
                href={t.href}
                role="tab"
                aria-selected={active}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-t-lg border px-4 py-2 text-sm font-medium ${
                  active ? 'border-slate-200 border-b-slate-50 bg-slate-50 text-teal-800' : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                }`}
              >
                {t.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
