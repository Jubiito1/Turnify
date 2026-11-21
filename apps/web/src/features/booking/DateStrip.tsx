import { clsx } from 'clsx';
import { DateTime } from 'luxon';

interface DateStripProps {
  days: { date: string; slotCount: number }[];
  timezone: string;
  selected: string | null;
  onSelect: (date: string) => void;
}

/** Horizontally scrollable day picker; days without free slots are disabled. */
export function DateStrip({ days, timezone, selected, onSelect }: DateStripProps) {
  return (
    <div
      className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2"
      role="group"
      aria-label="Elegir día"
    >
      {days.map(({ date, slotCount }) => {
        const d = DateTime.fromISO(date, { zone: timezone }).setLocale('es');
        const disabled = slotCount === 0;
        const isSelected = date === selected;
        return (
          <button
            key={date}
            type="button"
            disabled={disabled}
            aria-pressed={isSelected}
            aria-label={`${d.toFormat("cccc d 'de' LLLL")}: ${disabled ? 'sin horarios' : `${slotCount} horarios libres`}`}
            onClick={() => onSelect(date)}
            className={clsx(
              'flex w-16 shrink-0 snap-start flex-col items-center rounded-2xl border px-2 py-2.5 transition-colors',
              isSelected
                ? 'border-pine-700 bg-pine-700 text-white'
                : disabled
                  ? 'cursor-not-allowed border-sand-200 bg-sand-100 text-sand-400'
                  : 'border-sand-300 bg-white text-sand-800 hover:border-pine-400',
            )}
          >
            <span className="text-xs font-semibold uppercase">{d.toFormat('ccc')}</span>
            <span className="font-display text-xl font-bold">{d.day}</span>
            <span className={clsx('text-[11px]', isSelected ? 'text-pine-100' : 'text-sand-500')}>
              {d.toFormat('LLL')}
            </span>
          </button>
        );
      })}
    </div>
  );
}
