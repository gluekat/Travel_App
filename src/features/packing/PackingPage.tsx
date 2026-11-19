import { Fragment, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { compareGeneral, generalCategory, guessGeneralCategory, type ClosetItem, type GeneralItem, type PackingItem } from '../../db/types';
import { generalQty, groupByCategory, packingStats, packLines, type PackLine } from '../../engine/packing';
import { dateRange, formatDay } from '../../lib/dates';
import { ItemThumb } from '../../components/ItemThumb';
import { Banner, Button, Chip, Icon, inputClass } from '../../components/ui';
import { toEngineItem } from '../outfits/outfitService';
import { TripTabs } from '../trips/TripTabs';
import { computeOverWorn, weatherMismatches } from '../trips/wearPlan';
import { ForecastWarning, visibleForecastItems } from '../trips/ForecastWarning';
import { GeneralIcon } from '../closet/GeneralItemForm';
import { ensureGeneralLibrary, saveToGeneralLibrary } from './generalItemsService';

function CheckRow({ row, children }: { row: PackingItem; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-1.5">
      <input
        type="checkbox"
        checked={row.packed}
        onChange={() => db.packingItems.update(row.id!, { packed: !row.packed })}
        className="h-5 w-5 shrink-0 accent-teal-700"
        aria-label="Packed"
      />
      <div className={`flex min-w-0 flex-1 items-center gap-2 ${row.packed ? 'text-slate-400 line-through' : ''}`}>{children}</div>
    </li>
  );
}

function QtyStepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <span className="no-print inline-flex items-center rounded-lg border border-slate-300">
      <button className="px-2 py-0.5 text-slate-600 hover:bg-slate-100" onClick={() => onChange(Math.max(0, value - 1))} aria-label={`Fewer ${label}`}>
        −
      </button>
      <span className="min-w-6 text-center text-sm tabular-nums">{value}</span>
      <button className="px-2 py-0.5 text-slate-600 hover:bg-slate-100" onClick={() => onChange(value + 1)} aria-label={`More ${label}`}>
        +
      </button>
    </span>
  );
}

/** Trip-level general items (underwear, socks, toiletries…) with quantities. */
function GeneralItems({ tripId, rows, days }: { tripId: number; rows: PackingItem[]; days: number }) {
  const [label, setLabel] = useState('');
  const [saveToList, setSaveToList] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  useEffect(() => {
    void ensureGeneralLibrary();
  }, []);
  const library = useLiveQuery(async () => (await db.generalItems.toArray()).sort((a, b) => a.name.localeCompare(b.name)), []);
  const listed = useMemo(() => new Set((library ?? []).map((i) => i.name.toLowerCase())), [library]);
  const libraryTags = useMemo(() => [...new Set((library ?? []).flatMap((i) => i.tags))].sort(), [library]);
  const sortedRows = useMemo(
    () =>
      rows
        .map((row) => {
          const entry = library?.find((i) => i.name.toLowerCase() === row.customLabel!.toLowerCase());
          return { row, category: entry ? generalCategory(entry) : guessGeneralCategory(row.customLabel!) };
        })
        .sort((a, b) => compareGeneral({ category: a.category, name: a.row.customLabel! }, { category: b.category, name: b.row.customLabel! })),
    [rows, library],
  );
  const onTrip = (name: string) => rows.some((r) => r.customLabel?.toLowerCase() === name.toLowerCase());
  const suggestions = (library ?? []).filter((i) => !onTrip(i.name) && (!tag || i.tags.includes(tag)));

  async function add(name: string, from?: GeneralItem) {
    const clean = name.trim();
    if (!clean || onTrip(clean)) return;
    const qty = from?.perDay != null ? undefined : (from?.qty ?? 1);
    await db.packingItems.add({ tripId, customLabel: clean, ...(from?.perDay != null ? { perDay: from.perDay } : { qty }), packed: false });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await add(label);
    if (saveToList) await saveToGeneralLibrary(label);
    setLabel('');
  }

  return (
    <section className="print-plain rounded-xl border border-slate-200 bg-white p-3" aria-label="General items">
      <h2 className="text-sm font-semibold text-slate-700">
        General items <span className="font-normal text-slate-400">(for the whole trip)</span>
      </h2>
      <ul className="divide-y divide-slate-100">
        {sortedRows.map(({ row, category }, idx) => {
          const qty = generalQty(row, days);
          return (
            <Fragment key={row.id}>
              {(idx === 0 || sortedRows[idx - 1].category !== category) && (
                <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500" aria-label={`${category} items`}>
                  {category}
                </li>
              )}
            <CheckRow row={row}>
              {(() => {
                const entry = library?.find((i) => i.name.toLowerCase() === row.customLabel!.toLowerCase());
                return entry ? <span className="no-print"><GeneralIcon item={entry} size="h-8 w-8" /></span> : null;
              })()}
              <span className="flex-1 text-sm">
                {row.customLabel} <span className="font-medium">×{qty}</span>
                {row.perDay != null && (
                  <span className="ml-1 text-xs text-slate-500">
                    ({row.perDay} per day × {days} days)
                  </span>
                )}
              </span>
              {row.perDay != null ? (
                <QtyStepper label={`${row.customLabel} per day`} value={row.perDay} onChange={(n) => db.packingItems.update(row.id!, { perDay: Math.max(1, n) })} />
              ) : (
                <QtyStepper label={row.customLabel!} value={qty} onChange={(n) => db.packingItems.update(row.id!, { qty: Math.max(1, n) })} />
              )}
              <button
                className="no-print rounded p-1 text-xs text-slate-500 hover:bg-slate-100"
                onClick={() => db.packingItems.update(row.id!, row.perDay != null ? { qty, perDay: undefined } : { perDay: 1 })}
                title={row.perDay != null ? 'Switch to a fixed quantity' : 'Switch to a quantity per day'}
              >
                {row.perDay != null ? 'per day' : 'fixed'}
              </button>
              {!listed.has(row.customLabel!.toLowerCase()) && (
                <button
                  className="no-print rounded p-1 text-xs text-slate-500 hover:bg-slate-100"
                  onClick={() => saveToGeneralLibrary(row.customLabel!, row.qty, row.perDay)}
                  title="Save to your general items list with the Default tag (added to every new trip)"
                >
                  Save to my list
                </button>
              )}
              <button className="no-print rounded p-1 text-slate-400 hover:text-red-700" onClick={() => db.packingItems.delete(row.id!)} aria-label={`Remove ${row.customLabel}`}>
                <Icon name="x" />
              </button>
            </CheckRow>
            </Fragment>
          );
        })}
      </ul>
      <form onSubmit={submit} className="no-print mt-2 flex gap-2">
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item (chargers, pajamas…)" aria-label="New general item" />
        <Button type="submit">Add</Button>
      </form>
      <label className="no-print mt-1.5 flex items-center gap-2 text-xs text-slate-600">
        <input type="checkbox" className="h-3.5 w-3.5 accent-teal-700" checked={saveToList} onChange={(e) => setSaveToList(e.target.checked)} />
        Also save to my general items list (Default tag — added to every new trip)
      </label>
      {libraryTags.length > 0 && (
        <div className="no-print mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">Trip type:</span>
          {libraryTags.map((t) => (
            <Chip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}
      <div className="no-print mt-2 flex flex-wrap gap-1.5">
        {suggestions.map((i) => (
          <button key={i.id} className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50" onClick={() => add(i.name, i)}>
            + {i.name}
          </button>
        ))}
      </div>
    </section>
  );
}

export function PackingPage({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(() => db.trips.get(tripId), [tripId]);
  const rows = useLiveQuery(() => db.packingItems.where('tripId').equals(tripId).toArray(), [tripId]);
  const outfits = useLiveQuery(() => db.outfits.where('tripId').equals(tripId).toArray(), [tripId]);
  const closet = useLiveQuery(() => db.closetItems.toArray(), []);
  const tripDays = useLiveQuery(() => db.tripDays.where('tripId').equals(tripId).toArray(), [tripId]);

  if (!rows || !outfits || !closet || !trip || !tripDays) return <p className="text-sm text-slate-500">Loading…</p>;

  const days = dateRange(trip.startDate, trip.endDate).length;
  const engineItems = closet.map(toEngineItem);
  const lines = packLines(engineItems, outfits);
  const byId = new Map(closet.map((i) => [i.id!, i]));
  const clothing = rows
    .filter((r) => r.itemId != null && byId.has(r.itemId) && lines.has(r.itemId))
    .map((r) => ({ row: r, item: byId.get(r.itemId!)!, line: lines.get(r.itemId!)!, category: byId.get(r.itemId!)!.category }));
  const general = rows.filter((r) => r.customLabel != null);
  const stats = packingStats(engineItems, outfits);
  const generalCount = general.reduce((n, r) => n + generalQty(r, days), 0);
  const packedCount = rows.filter((r) => r.packed).length;
  const sortedDays = [...tripDays].sort((a, b) => a.date.localeCompare(b.date));
  const overWorn = computeOverWorn(outfits, tripDays, closet);
  const exceeded = new Set([...overWorn.values()].flatMap((w) => [...w.itemIds]));
  const warningDays = sortedDays.map((d, i) => ({ day: d, n: i + 1, warnings: overWorn.get(d.id!) })).filter((x) => x.warnings);
  const laundryDays = sortedDays.map((d, i) => ({ day: d, n: i + 1 })).filter((x) => x.day.laundryDay);
  const mismatched = weatherMismatches(closet, outfits, tripDays);
  const flagged = visibleForecastItems(mismatched, trip);
  const tripTitle = trip.name ?? trip.placeLabel ?? trip.destination;

  return (
    <div className="space-y-4">
      <div>
        <a href="#/trips" className="no-print text-sm text-teal-700">← Trips</a>
        <h1 className="text-xl font-semibold">{tripTitle}</h1>
        <p className="text-sm text-slate-600">
          {formatDay(trip.startDate)} to {formatDay(trip.endDate)} · {days} day{days !== 1 ? 's' : ''}
        </p>
      </div>
      <TripTabs tripId={tripId} current="packing" />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          Packing Checklist<span className="hidden print:inline">: {tripTitle}</span>
        </h2>
        <Button className="no-print" onClick={() => window.print()}>
          <Icon name="print" /> Print
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">{stats.pieceCount + generalCount}</p>
          <p className="text-xs text-slate-500">
            pieces total ({packedCount} of {rows.length} lines packed)
          </p>
        </div>
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">
            {stats.outfitCount} <span className="text-base font-normal text-slate-500">from</span> {stats.pieceCount}
          </p>
          <p className="text-xs text-slate-500">outfits from clothing pieces</p>
        </div>
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">{stats.wearsPerPiece}×</p>
          <p className="text-xs text-slate-500">mix-and-match: avg. wears per piece</p>
        </div>
      </div>

      {warningDays.map(({ day, n, warnings }) => (
        <Banner key={day.id} tone="warn">
          ⚠️ Day {n} ({formatDay(day.date)}): {warnings!.messages.join(' ')}
        </Banner>
      ))}
      <ForecastWarning trip={trip} mismatched={mismatched} closet={closet} />

      {laundryDays.length > 0 && (
        <section className="print-plain rounded-xl border border-sky-100 bg-sky-50 p-3" aria-label="Laundry plan">
          <h2 className="text-sm font-semibold text-sky-800">🧺 Laundry planned</h2>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {laundryDays.map(({ day, n }) => {
              const names = (day.laundryItems ?? []).map((id) => byId.get(id)?.name).filter(Boolean);
              return (
                <li key={day.id}>
                  <span className="font-medium">Day {n} ({formatDay(day.date)}):</span>{' '}
                  {names.length ? `wash ${names.join(', ')}` : 'no items selected yet'}
                </li>
              );
            })}
          </ul>
          <p className="mt-1 text-xs text-slate-500">Washed items are available to wear again after each laundry day.</p>
        </section>
      )}

      <GeneralItems tripId={tripId} rows={general} days={days} />

      {clothing.length === 0 && (
        <p className="text-sm text-slate-600">
          No clothes picked yet. <a className="underline" href={`#/trips/${tripId}`}>Choose outfits</a> in the Trip Overview first.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groupByCategory(clothing).map(([category, list]) => (
          <section key={category} className="print-plain rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold capitalize text-slate-700">
              {category} <span className="font-normal text-slate-400">({list.reduce((n, c) => n + c.line.copies, 0)})</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {list.map(({ row, item, line }: { row: PackingItem; item: ClosetItem; line: PackLine }) => (
                <CheckRow key={row.id} row={row}>
                  <span className="no-print">
                    <ItemThumb item={item} size="h-8 w-8" />
                  </span>
                  <span className="truncate text-sm">
                    {item.name} {line.copies > 1 && <span className="font-medium">×{line.copies}</span>}
                  </span>
                  <span className="text-xs text-slate-400">
                    {line.wears} wear{line.wears > 1 ? 's' : ''}
                    {exceeded.has(item.id!) && <span className="text-amber-700"> · needs laundry</span>}
                  </span>
                  {flagged.has(item.id!) && (
                    <span title="May not suit the forecast for one or more days" className="text-amber-500">
                      <Icon name="alert" className="h-4 w-4" />
                    </span>
                  )}
                </CheckRow>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
