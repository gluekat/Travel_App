import type { TempUnit } from '../db/types';

export const cToF = (c: number) => (c * 9) / 5 + 32;
export const fToC = (f: number) => ((f - 32) * 5) / 9;

export function formatTemp(c: number, unit: TempUnit): string {
  return `${Math.round(unit === 'F' ? cToF(c) : c)}°${unit}`;
}
