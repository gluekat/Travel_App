import { useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { ClosetItem, PackingItem } from '../../db/types';
import { generalQty, groupByCategory, packingStats, packLines, type PackLine } from '../../engine/packing';
import { dateRange, formatDay } from '../../lib/dates';
import { ItemThumb } from '../../components/ItemThumb';
import { Banner, Button, Icon, inputClass } from '../../components/ui';
import { toEngineItem } from '../outfits/outfitService';

const GENERAL_SUGGESTIONS = ['Phone charger', 'Passport / ID', 'Medications', 'Sunscreen', 'Travel adapter', 'Pajamas'];

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

  async function add(name: string) {
    const clean = name.trim();
    if (!clean || rows.some((r) => r.customLabel?.toLowerCase() === clean.toLowerCase())) return;
    await db.packingItems.add({ tripId, customLabel: clean, qty: 1, packed: false });
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    await add(label);
    setLabel('');
  }

  return (
    <section className="print-plain rounded-xl border border-slate-200 bg-white p-3" aria-label="General items">
      <h2 className="text-sm font-semibold text-slate-700">
        General items <span className="font-normal text-slate-400">(for the whole trip)</span>
      </h2>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => {
          const qty = generalQty(row, days);
          return (
            <CheckRow key={row.id} row={row}>
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
              <button className="no-print rounded p-1 text-slate-400 hover:text-red-700" onClick={() => db.packingItems.delete(row.id!)} aria-label={`Remove ${row.customLabel}`}>
                <Icon name="x" />
              </button>
            </CheckRow>
          );
        })}
      </ul>
      <form onSubmit={submit} className="no-print mt-2 flex gap-2">
        <input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add an item (chargers, pajamas…)" aria-label="New general item" />
        <Button type="submit">Add</Button>
      </form>
      <div className="no-print mt-2 flex flex-wrap gap-1.5">
        {GENERAL_SUGGESTIONS.filter((s) => !rows.some((r) => r.customLabel === s)).map((s) => (
          <button key={s} className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50" onClick={() => add(s)}>
            + {s}
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

  if (!rows || !outfits || !closet || !trip) return <p className="text-sm text-slate-500">Loading…</p>;

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
  const short = clothing.filter((c) => c.line.shortfall > 0);

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <a href={`#/trips/${tripId}`} className="text-sm text-teal-700">← Back to trip</a>
        <Button onClick={() => window.print()}>
          <Icon name="print" /> Print
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Packing list: {trip.placeLabel ?? trip.destination}</h1>
        <p className="text-sm text-slate-600">
          {formatDay(trip.startDate)} to {formatDay(trip.endDate)} · {days} days
        </p>
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

      {short.map(({ item, line }) => (
        <Banner key={item.id} tone="warn">
          ⚠️ {item.name}: {line.wears} wears planned, but only {line.wears - line.shortfall} clean ({item.quantity} owned × {item.wearCount} wear
          {item.wearCount > 1 ? 's' : ''} before washing).
        </Banner>
      ))}

      <GeneralItems tripId={tripId} rows={general} days={days} />

      {clothing.length === 0 && (
        <p className="text-sm text-slate-600">
          No clothes picked yet. <a className="underline" href={`#/trips/${tripId}`}>Choose outfits</a> for your days first.
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
                    {line.shortfall > 0 && <span className="text-amber-700"> · short {line.shortfall}</span>}
                  </span>
                </CheckRow>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
