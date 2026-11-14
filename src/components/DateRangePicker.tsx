import { useState } from 'react';
import { Icon } from './ui';

const DOW = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function localTodayISO(): string {
  const d = new Date();
  return isoDate(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Inline single-month calendar with range selection.
 * First click sets start and enters end-picking mode.
 * Second click (on or after start) confirms end.
 * Clicking again after a full selection restarts.
 */
export function DateRangePicker({
  start,
  end,
  onChange,
  minDate,
}: {
  start: string;
  end: string;
  onChange: (s: string, e: string) => void;
  minDate?: string;
}) {
  const today = localTodayISO();
  const [viewYear, setViewYear] = useState(() => Number(start.slice(0, 4)));
  const [viewMonth, setViewMonth] = useState(() => Number(start.slice(5, 7)) - 1);
  const [hovered, setHovered] = useState<string>();
  // 'start': next click restarts selection; 'end': next click sets end date
  const [mode, setMode] = useState<'start' | 'end'>('start');

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  }

  function handleClick(date: string) {
    if (minDate && date < minDate) return;
    if (mode === 'start') {
      onChange(date, date);
      setMode('end');
    } else {
      if (date < start) {
        onChange(date, date);
        setMode('end');
      } else {
        onChange(start, date);
        setMode('start');
      }
    }
  }

  // Range end for hover preview while in end-picking mode
  const displayEnd = mode === 'end' && hovered && hovered >= start ? hovered : end;
  const hasRange = displayEnd > start;

  const totalDays = daysInMonth(viewYear, viewMonth);
  const offset = new Date(viewYear, viewMonth, 1).getDay(); // 0 = Sunday
  const cells: (string | null)[] = Array(offset).fill(null);
  for (let d = 1; d <= totalDays; d++) cells.push(isoDate(viewYear, viewMonth, d));
  while (cells.length % 7) cells.push(null);

  const monthLabel = new Date(viewYear, viewMonth, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-lg border border-slate-200 bg-white select-none">
      {/* Month navigation */}
      <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
        <button type="button" onClick={prevMonth} aria-label="Previous month"
          className="rounded p-1 text-slate-500 hover:bg-slate-100">
          <Icon name="chevronLeft" className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <button type="button" onClick={nextMonth} aria-label="Next month"
          className="rounded p-1 text-slate-500 hover:bg-slate-100">
          <Icon name="chevronRight" className="h-4 w-4" />
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 px-2 pt-2">
        {DOW.map(d => (
          <div key={d} className="py-1 text-center text-xs font-medium text-slate-400">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 px-2 pb-2">
        {cells.map((date, i) => {
          if (!date) return <div key={i} className="h-9" />;

          const disabled = !!(minDate && date < minDate);
          const isStart = date === start;
          const isConfirmedEnd = date === end && date !== start && mode === 'start';
          const isPreviewEnd = mode === 'end' && date === displayEnd && date !== start;
          const inRange = hasRange && date > start && date < displayEnd;

          let btnCls = 'relative z-10 mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors ';
          if (isStart || isConfirmedEnd) {
            btnCls += 'bg-teal-700 text-white font-semibold ';
          } else if (isPreviewEnd) {
            btnCls += 'bg-teal-200 text-teal-900 ';
          } else if (disabled) {
            btnCls += 'text-slate-300 cursor-not-allowed ';
          } else {
            btnCls += 'text-slate-700 hover:bg-teal-100 ';
          }
          if (date === today && !isStart && !isConfirmedEnd && !isPreviewEnd) {
            btnCls += 'ring-1 ring-teal-500 ';
          }

          return (
            <div key={i} className="relative flex h-9 items-center justify-center">
              {/* Range background spans — half-cell for start/end, full for middle */}
              {hasRange && isStart && (
                <span className="absolute inset-y-1 left-1/2 right-0 bg-teal-100" />
              )}
              {hasRange && (isConfirmedEnd || isPreviewEnd) && (
                <span className="absolute inset-y-1 left-0 right-1/2 bg-teal-100" />
              )}
              {inRange && (
                <span className="absolute inset-0 bg-teal-100" />
              )}
              <button
                type="button"
                className={btnCls}
                onClick={() => !disabled && handleClick(date)}
                onMouseEnter={() => setHovered(date)}
                onMouseLeave={() => setHovered(undefined)}
                disabled={disabled}
              >
                {Number(date.slice(8))}
              </button>
            </div>
          );
        })}
      </div>

      {/* Status hint */}
      <div className="border-t border-slate-100 px-3 py-1.5 text-center text-xs text-slate-500">
        {mode === 'end' ? 'Now click the end date' : 'Click a date to set start'}
      </div>
    </div>
  );
}
