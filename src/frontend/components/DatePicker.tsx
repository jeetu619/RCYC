import { useEffect, useState } from 'react';
import { getYachtAvailability } from '../services/client';
import { formatDateRange, isFutureDate, isSaturday, toISODate, todayISO } from '../../shared/dates';
import type { AvailabilityEntry, AvailabilityStatus } from '../../shared/types';

interface DatePickerProps {
  yachtId?: string;
  selectedDate?: string;
  onSelect: (startDate: string) => void;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

interface Cell {
  date: string | null;
}

function buildMonth(year: number, month: number): Cell[] {
  const first = new Date(Date.UTC(year, month, 1));
  const cells: Cell[] = Array.from({ length: first.getUTCDay() }, () => ({ date: null }));
  const d = new Date(first);
  while (d.getUTCMonth() === month) {
    cells.push({ date: toISODate(d) });
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return cells;
}

export default function DatePicker({ yachtId, selectedDate, onSelect }: DatePickerProps) {
  const anchor = selectedDate ?? todayISO();
  const [view, setView] = useState({ year: Number(anchor.slice(0, 4)), month: Number(anchor.slice(5, 7)) - 1 });
  const [availability, setAvailability] = useState<Map<string, AvailabilityStatus>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  // Jump to the month of a date chosen elsewhere (e.g. an applied alternative).
  useEffect(() => {
    if (selectedDate) setView({ year: Number(selectedDate.slice(0, 4)), month: Number(selectedDate.slice(5, 7)) - 1 });
  }, [selectedDate]);

  useEffect(() => {
    if (!yachtId) return;
    let cancelled = false;
    const from = toISODate(new Date(Date.UTC(view.year, view.month, 1)));
    const to = toISODate(new Date(Date.UTC(view.year, view.month + 1, 0)));
    setLoading(true);
    setError(null);
    getYachtAvailability(yachtId, from, to)
      .then((data: AvailabilityEntry[]) => {
        if (!cancelled) setAvailability(new Map(data.map(a => [a.date, a.status])));
      })
      .catch(err => {
        console.error('Could not load availability', err);
        if (!cancelled) setError('Could not load availability');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [yachtId, view.year, view.month, attempt]);

  if (!yachtId) {
    return (
      <section className="date-picker" aria-labelledby="date-heading">
        <h2 id="date-heading">Select your start date</h2>
        <p className="hint">Please select a yacht first to see its availability.</p>
      </section>
    );
  }

  const today = todayISO();
  const isCurrentMonth = view.year === Number(today.slice(0, 4)) && view.month === Number(today.slice(5, 7)) - 1;
  const step = (delta: number) =>
    setView(v => {
      const d = new Date(Date.UTC(v.year, v.month + delta, 1));
      return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
    });

  const cells = buildMonth(view.year, view.month);
  const interactive = !loading && !error;

  return (
    <section className="date-picker" aria-labelledby="date-heading">
      <h2 id="date-heading">Select your start date</h2>
      <p className="hint">Charters run Saturday to Saturday (7 nights). Only Saturdays can be selected.</p>

      <div className="calendar-header">
        <button type="button" className="icon-button" aria-label="Previous month" onClick={() => step(-1)} disabled={isCurrentMonth}>
          ←
        </button>
        <h3 aria-live="polite">
          {MONTH_NAMES[view.month]} {view.year}
        </h3>
        <button type="button" className="icon-button" aria-label="Next month" onClick={() => step(1)}>
          →
        </button>
      </div>

      {loading && (
        <div className="loading" role="status">
          <span className="spinner" aria-hidden="true" /> Loading availability…
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}.{' '}
          <button type="button" className="link-button" onClick={() => setAttempt(a => a + 1)}>
            Retry
          </button>
        </div>
      )}

      <div className="calendar" role="group" aria-label={`${MONTH_NAMES[view.month]} ${view.year}`}>
        {WEEKDAYS.map(d => (
          <div key={d} className={`calendar-weekday ${d === 'Sat' ? 'sat' : ''}`} aria-hidden="true">
            {d}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell.date) return <div key={`blank-${i}`} className="calendar-cell blank" />;
          const day = Number(cell.date.slice(8));
          if (!isSaturday(cell.date)) {
            return (
              <div key={cell.date} className="calendar-cell disabled" aria-hidden="true">
                {day}
              </div>
            );
          }
          const status = availability.get(cell.date) ?? 'Available';
          const past = !isFutureDate(cell.date);
          const selected = cell.date === selectedDate;
          const label = `Saturday ${day} ${MONTH_NAMES[view.month]} ${view.year}, ${past ? 'unavailable (past)' : status}`;
          return (
            <button
              type="button"
              key={cell.date}
              className={`calendar-cell saturday ${past ? 'past' : status.toLowerCase()} ${selected ? 'selected' : ''}`}
              aria-label={label}
              aria-pressed={selected}
              disabled={past || !interactive}
              onClick={() => onSelect(cell.date!)}
            >
              <span className="day">{day}</span>
              <span className="avail">{past ? '' : status}</span>
            </button>
          );
        })}
      </div>

      <ul className="legend" aria-label="Availability legend">
        <li><span className="dot available" /> Available</li>
        <li><span className="dot held" /> Held</li>
        <li><span className="dot booked" /> Booked</li>
      </ul>

      {selectedDate && (
        <p className="selected-dates" data-testid="selected-dates">
          {formatDateRange(selectedDate)}
        </p>
      )}
    </section>
  );
}
