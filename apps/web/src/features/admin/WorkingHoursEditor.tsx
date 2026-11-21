import {
  WEEKDAY_LABELS,
  hhmmToMinutes,
  minutesToHHMM,
  workingHoursSchema,
  type WorkingHourDTO,
} from '@turnify/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';

interface Row {
  key: number;
  weekday: number;
  start: string;
  end: string;
}

// Monday first, Sunday last (local convention), stored as 0 = Sunday.
const ORDER = [1, 2, 3, 4, 5, 6, 0];
let nextKey = 1;

/** Weekly schedule editor with split shifts; validated with the shared schema before saving (RN-030). */
export function WorkingHoursEditor({
  initial,
  saving,
  onSave,
}: {
  initial: WorkingHourDTO[];
  saving: boolean;
  onSave: (hours: WorkingHourDTO[]) => void;
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial.map((h) => ({
      key: nextKey++,
      weekday: h.weekday,
      start: minutesToHHMM(h.startMinute),
      end: minutesToHHMM(h.endMinute),
    })),
  );
  const [error, setError] = useState<string | null>(null);

  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const add = (weekday: number) =>
    setRows((rs) => [
      ...rs,
      {
        key: nextKey++,
        weekday,
        start: rs.some((r) => r.weekday === weekday) ? '14:00' : '09:00',
        end: rs.some((r) => r.weekday === weekday) ? '18:00' : '13:00',
      },
    ]);
  const remove = (key: number) => setRows((rs) => rs.filter((r) => r.key !== key));
  const copyMondayToWeekdays = () => {
    const monday = rows.filter((r) => r.weekday === 1);
    setRows((rs) => [
      ...rs.filter((r) => ![2, 3, 4, 5].includes(r.weekday)),
      ...[2, 3, 4, 5].flatMap((weekday) => monday.map((m) => ({ ...m, key: nextKey++, weekday }))),
    ]);
  };

  const save = () => {
    const hours = rows.map((r) => ({
      weekday: r.weekday,
      startMinute: hhmmToMinutes(r.start) ?? -1,
      endMinute: hhmmToMinutes(r.end) ?? -1,
    }));
    const result = workingHoursSchema.safeParse({ hours });
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? 'Revisa los horarios');
      return;
    }
    setError(null);
    onSave(result.data.hours);
  };

  return (
    <div className="flex flex-col gap-3">
      {error && <Alert tone="error">{error}</Alert>}
      <ul className="divide-y divide-sand-100 rounded-2xl border border-sand-200">
        {ORDER.map((weekday) => {
          const dayRows = rows
            .filter((r) => r.weekday === weekday)
            .sort((a, b) => a.start.localeCompare(b.start));
          return (
            <li key={weekday} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start">
              <span className="w-28 shrink-0 pt-2 text-sm font-semibold">
                {WEEKDAY_LABELS[weekday]}
              </span>
              <div className="flex flex-1 flex-col gap-2">
                {dayRows.length === 0 && (
                  <span className="pt-2 text-sm text-sand-500">No atiende</span>
                )}
                {dayRows.map((r) => (
                  <div key={r.key} className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`start-${r.key}`}>
                      {WEEKDAY_LABELS[weekday]} desde
                    </label>
                    <input
                      id={`start-${r.key}`}
                      type="time"
                      step={900}
                      value={r.start}
                      onChange={(e) => update(r.key, { start: e.target.value })}
                      className="h-9 rounded-lg border border-sand-300 px-2 text-sm focus:border-pine-500 focus:ring-2 focus:ring-pine-200 focus:outline-none"
                    />
                    <span className="text-sand-400" aria-hidden="true">
                      –
                    </span>
                    <label className="sr-only" htmlFor={`end-${r.key}`}>
                      {WEEKDAY_LABELS[weekday]} hasta
                    </label>
                    <input
                      id={`end-${r.key}`}
                      type="time"
                      step={900}
                      value={r.end}
                      onChange={(e) => update(r.key, { end: e.target.value })}
                      className="h-9 rounded-lg border border-sand-300 px-2 text-sm focus:border-pine-500 focus:ring-2 focus:ring-pine-200 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => remove(r.key)}
                      className="rounded-lg p-1.5 text-sand-500 hover:bg-red-50 hover:text-red-700"
                      aria-label={`Quitar franja ${r.start}–${r.end} del ${WEEKDAY_LABELS[weekday]}`}
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus className="size-4" />}
                onClick={() => add(weekday)}
                aria-label={`Agregar franja el ${WEEKDAY_LABELS[weekday]}`}
              >
                Franja
              </Button>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={copyMondayToWeekdays}
          disabled={!rows.some((r) => r.weekday === 1)}
        >
          Copiar lunes a martes–viernes
        </Button>
        <Button onClick={save} loading={saving}>
          Guardar horario
        </Button>
      </div>
    </div>
  );
}
