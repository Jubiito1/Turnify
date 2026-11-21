import { useState } from 'react';
import { formatDayLabel } from '../../lib/format';

interface DailyBarChartProps {
  data: { date: string; bookings: number }[];
  timezone: string;
}

/**
 * Single-series column chart (bookings per day). One hue, no legend (the title names the series),
 * recessive grid, thin bars with 4px rounded tops and a 2px gap, and a per-bar tooltip on hover/focus.
 */
export function DailyBarChart({ data, timezone }: DailyBarChartProps) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.bookings));
  const ticks = [max, Math.round(max / 2), 0];
  const labelEvery = Math.ceil(data.length / 8);

  return (
    <div className="relative">
      <div className="flex gap-2">
        <div
          className="flex h-48 flex-col justify-between pb-6 text-right text-xs text-sand-500 tabular-nums"
          aria-hidden="true"
        >
          {ticks.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <div className="relative flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between"
            aria-hidden="true"
          >
            {ticks.map((_, i) => (
              <span key={i} className="border-t border-dashed border-sand-200" />
            ))}
          </div>
          <ul className="relative flex h-48 items-end gap-[2px] pb-6" aria-label="Reservas por día">
            {data.map((d, i) => (
              <li key={d.date} className="relative flex h-full flex-1 flex-col justify-end">
                <button
                  type="button"
                  className="group flex h-full w-full items-end justify-center focus:outline-none"
                  aria-label={`${formatDayLabel(d.date, timezone)}: ${d.bookings} reservas`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <span
                    className={`block w-full max-w-6 rounded-t-[4px] transition-colors ${active === i ? 'bg-pine-800' : 'bg-pine-500'} group-focus-visible:ring-2 group-focus-visible:ring-pine-300`}
                    style={{
                      height: `${(d.bookings / max) * 100}%`,
                      minHeight: d.bookings > 0 ? 3 : 0,
                    }}
                  />
                </button>
                {i % labelEvery === 0 && (
                  <span
                    className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] whitespace-nowrap text-sand-500"
                    aria-hidden="true"
                  >
                    {formatDayLabel(d.date, timezone).split(' ')[1]}
                  </span>
                )}
                {active === i && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-sand-900 px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-pop"
                  >
                    <span className="block font-semibold">{formatDayLabel(d.date, timezone)}</span>
                    {d.bookings} reserva{d.bookings === 1 ? '' : 's'}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
