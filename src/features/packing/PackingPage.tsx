import { useState, type FormEvent, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { ClosetItem, PackingItem } from '../../db/types';
import { groupByCategory, packingStats } from '../../engine/packing';
import { formatDay } from '../../lib/dates';
import { ItemThumb } from '../../components/ItemThumb';
import { Button, Icon, inputClass } from '../../components/ui';

const EXTRA_SUGGESTIONS = ['Toothbrush & toiletries', 'Phone charger', 'Passport / ID', 'Medications', 'Sunscreen', 'Travel adapter'];

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

export function PackingPage({ tripId }: { tripId: number }) {
  const trip = useLiveQuery(() => db.trips.get(tripId), [tripId]);
  const rows = useLiveQuery(() => db.packingItems.where('tripId').equals(tripId).toArray(), [tripId]);
  const outfits = useLiveQuery(() => db.outfits.where('tripId').equals(tripId).filter((o) => o.selected).toArray(), [tripId]);
  const closet = useLiveQuery(() => db.closetItems.toArray(), []);
  const [extra, setExtra] = useState('');

  if (!rows || !outfits || !closet) return <p className="text-sm text-slate-500">Loading…</p>;

  const byId = new Map(closet.map((i) => [i.id!, i]));
  const clothing = rows
    .filter((r) => r.itemId != null && byId.has(r.itemId))
    .map((r) => ({ row: r, item: byId.get(r.itemId!)!, category: byId.get(r.itemId!)!.category }));
  const extras = rows.filter((r) => r.customLabel != null);
  const stats = packingStats(outfits);
  const packedCount = rows.filter((r) => r.packed).length;

  async function addExtra(label: string) {
    const clean = label.trim();
    if (!clean || extras.some((e) => e.customLabel?.toLowerCase() === clean.toLowerCase())) return;
    await db.packingItems.add({ tripId, customLabel: clean, packed: false });
  }

  async function submitExtra(e: FormEvent) {
    e.preventDefault();
    await addExtra(extra);
    setExtra('');
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-2">
        <a href={`#/trips/${tripId}`} className="text-sm text-teal-700">← Back to trip</a>
        <Button onClick={() => window.print()}>
          <Icon name="print" /> Print
        </Button>
      </div>
      <div>
        <h1 className="text-xl font-semibold">Packing list{trip ? `: ${trip.placeLabel ?? trip.destination}` : ''}</h1>
        {trip && (
          <p className="text-sm text-slate-600">
            {formatDay(trip.startDate)} to {formatDay(trip.endDate)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">{stats.itemCount + extras.length}</p>
          <p className="text-xs text-slate-500">items total ({packedCount} packed)</p>
        </div>
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">
            {stats.outfitCount} <span className="text-base font-normal text-slate-500">from</span> {stats.itemCount}
          </p>
          <p className="text-xs text-slate-500">outfits from clothing items</p>
        </div>
        <div className="print-plain rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-2xl font-semibold">{stats.wearsPerItem}×</p>
          <p className="text-xs text-slate-500">mix-and-match: avg. wears per item</p>
        </div>
      </div>

      {clothing.length === 0 && (
        <p className="text-sm text-slate-600">
          No outfits selected yet. <a className="underline" href={`#/trips/${tripId}`}>Suggest outfits</a> first.
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {groupByCategory(clothing).map(([category, list]) => (
          <section key={category} className="print-plain rounded-xl border border-slate-200 bg-white p-3">
            <h2 className="text-sm font-semibold capitalize text-slate-700">
              {category} <span className="font-normal text-slate-400">({list.length})</span>
            </h2>
            <ul className="divide-y divide-slate-100">
              {list.map(({ row, item }: { row: PackingItem; item: ClosetItem }) => (
                <CheckRow key={row.id} row={row}>
                  <span className="no-print">
                    <ItemThumb item={item} size="h-8 w-8" />
                  </span>
                  <span className="truncate text-sm">{item.name}</span>
                  <span className="text-xs text-slate-400">{item.color}</span>
                </CheckRow>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <section className="print-plain rounded-xl border border-slate-200 bg-white p-3">
        <h2 className="text-sm font-semibold text-slate-700">Extras</h2>
        <ul className="divide-y divide-slate-100">
          {extras.map((row) => (
            <CheckRow key={row.id} row={row}>
              <span className="flex-1 text-sm">{row.customLabel}</span>
              <button className="no-print rounded p-1 text-slate-400 hover:text-red-700" onClick={() => db.packingItems.delete(row.id!)} aria-label={`Remove ${row.customLabel}`}>
                <Icon name="x" />
              </button>
            </CheckRow>
          ))}
        </ul>
        <form onSubmit={submitExtra} className="no-print mt-2 flex gap-2">
          <input className={inputClass} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add an extra (toiletries, chargers…)" aria-label="New extra item" />
          <Button type="submit">Add</Button>
        </form>
        <div className="no-print mt-2 flex flex-wrap gap-1.5">
          {EXTRA_SUGGESTIONS.filter((s) => !extras.some((e) => e.customLabel === s)).map((s) => (
            <button key={s} className="rounded-full border border-dashed border-slate-300 px-2.5 py-0.5 text-xs text-slate-600 hover:bg-slate-50" onClick={() => addExtra(s)}>
              + {s}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
