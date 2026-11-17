/** Wear planning shared by the Trip Overview and the Packing checklist, so both show the same problems. */
import type { ClosetItem, Outfit, TripDay } from '../../db/types';
import { capacity } from '../../engine/rules';
import { toEngineItem } from '../outfits/outfitService';

export interface DayWarnings {
  messages: string[];
  itemIds: Set<number>;
}

/** Wears per item counted once per day: an item in two outfits on the same day is one wear. */
export function countWearDays(outfits: Outfit[], dateOf: (tripDayId: number) => string | undefined): Map<number, number> {
  const daysByItem = new Map<number, Set<string>>();
  for (const o of outfits) {
    const date = dateOf(o.tripDayId);
    if (date === undefined) continue;
    for (const id of o.itemIds) daysByItem.set(id, (daysByItem.get(id) ?? new Set<string>()).add(date));
  }
  return new Map([...daysByItem].map(([id, dates]) => [id, dates.size]));
}

/** Per day: the items that first exceed their wear allowance that day (laundry days reset the count). */
export function computeOverWorn(outfits: Outfit[], days: TripDay[], closet: ClosetItem[]): Map<number, DayWarnings> {
  const dayDate = new Map(days.map((d) => [d.id!, d.date]));
  const engineItems = closet.map(toEngineItem);
  const sortedDays = [...days].sort((a, b) => a.date.localeCompare(b.date));
  const laundryDates = new Set(sortedDays.filter((d) => d.laundryDay).map((d) => d.date));
  const result = new Map<number, DayWarnings>();
  const cumWears = new Map<number, number>();
  for (const day of sortedDays) {
    if (laundryDates.has(day.date)) cumWears.clear();
    const prevWears = new Map(cumWears);
    const wornToday = new Set<number>();
    for (const o of outfits) {
      if (dayDate.get(o.tripDayId) !== day.date) continue;
      for (const id of o.itemIds) wornToday.add(id);
    }
    for (const id of wornToday) cumWears.set(id, (cumWears.get(id) ?? 0) + 1);
    const messages: string[] = [];
    const itemIds = new Set<number>();
    for (const item of engineItems) {
      if (item.wearCount >= 9999) continue;
      const cap = capacity(item);
      const before = prevWears.get(item.id) ?? 0;
      const after = cumWears.get(item.id) ?? 0;
      if (after > cap && before <= cap) {
        messages.push(`${item.name}: ${after} of ${cap} wear${cap !== 1 ? 's' : ''} used — needs laundry or more copies.`);
        itemIds.add(item.id);
      }
    }
    if (messages.length > 0) result.set(day.id!, { messages, itemIds });
  }
  return result;
}
