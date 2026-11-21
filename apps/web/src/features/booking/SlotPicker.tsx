import type { AvailabilitySlot } from '@turnify/shared';
import { clsx } from 'clsx';
import { formatTime, toZoned } from '../../lib/format';

const PERIODS = [
  { key: 'morning', label: 'Mañana', test: (h: number) => h < 12 },
  { key: 'afternoon', label: 'Tarde', test: (h: number) => h >= 12 && h < 19 },
  { key: 'evening', label: 'Noche', test: (h: number) => h >= 19 },
] as const;

interface SlotPickerProps {
  slots: AvailabilitySlot[];
  timezone: string;
  selected: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
}

/** Presentational grid of free start times grouped by period of the day (business time zone). */
export function SlotPicker({ slots, timezone, selected, onSelect }: SlotPickerProps) {
  return (
    <div className="flex flex-col gap-5">
      {PERIODS.map((period) => {
        const items = slots.filter((s) => period.test(toZoned(s.startsAt, timezone).hour));
        if (items.length === 0) return null;
        return (
          <fieldset key={period.key}>
            <legend className="mb-2 text-sm font-semibold text-sand-600">{period.label}</legend>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              {items.map((slot) => {
                const isSelected = slot.startsAt === selected;
                const time = formatTime(slot.startsAt, timezone);
                return (
                  <button
                    key={slot.startsAt}
                    type="button"
                    aria-pressed={isSelected}
                    aria-label={`${time} (${slot.professionalIds.length} profesional${slot.professionalIds.length === 1 ? '' : 'es'} libre${slot.professionalIds.length === 1 ? '' : 's'})`}
                    onClick={() => onSelect(slot)}
                    className={clsx(
                      'rounded-xl border px-2 py-2.5 text-sm font-semibold tabular-nums transition-colors',
                      isSelected
                        ? 'border-pine-700 bg-pine-700 text-white shadow-sm'
                        : 'border-sand-300 bg-white text-sand-800 hover:border-pine-400 hover:bg-pine-50',
                    )}
                  >
                    {time}
                  </button>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
