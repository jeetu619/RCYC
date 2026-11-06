import React, { useState, useEffect } from 'react';
import { getYachtAvailability } from '../api/client';
import type { AvailabilityEntry } from '../../shared/types';

interface DatePickerProps {
  yachtId?: string;
  selectedDate?: string;
  onSelect: (date: string, endDate: string) => void;
}

export default function DatePicker({ yachtId, selectedDate, onSelect }: DatePickerProps) {
  const [availability, setAvailability] = useState<Map<string, AvailabilityEntry>>(new Map());
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!yachtId) return;

    const loadAvailability = async () => {
      setLoading(true);
      setError(null);
      try {
        const startMonth = new Date(currentMonth);
        startMonth.setUTCDate(1);
        const endMonth = new Date(currentMonth);
        endMonth.setUTCMonth(endMonth.getUTCMonth() + 3);
        endMonth.setUTCDate(0);

        const from = startMonth.toISOString().split('T')[0];
        const to = endMonth.toISOString().split('T')[0];

        const data = await getYachtAvailability(yachtId, from, to);
        const availabilityMap = new Map(data.map(a => [a.date, a]));
        setAvailability(availabilityMap);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadAvailability();
  }, [yachtId, currentMonth]);

  const getSaturdaysInMonth = (date: Date): Date[] => {
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    const saturdays: Date[] = [];

    const firstDay = new Date(Date.UTC(year, month, 1));
    const daysUntilSaturday = (6 - firstDay.getUTCDay()) % 7;
    const firstSaturday = new Date(Date.UTC(year, month, 1 + daysUntilSaturday));

    for (let d = new Date(firstSaturday); d.getUTCMonth() === month; d.setUTCDate(d.getUTCDate() + 7)) {
      saturdays.push(new Date(d));
    }

    return saturdays;
  };

  const handleDateSelect = (saturday: Date) => {
    const startDateStr = saturday.toISOString().split('T')[0];
    const endDate = new Date(saturday);
    endDate.setUTCDate(endDate.getUTCDate() + 7);
    const endDateStr = endDate.toISOString().split('T')[0];
    onSelect(startDateStr, endDateStr);
  };

  const saturdays = getSaturdaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  if (!yachtId) {
    return <div className="date-picker">Please select a yacht first</div>;
  }

  if (loading) return <div className="loading">Loading availability...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="date-picker">
      <h2>Select Start Date</h2>
      <div className="date-picker-header">
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() - 1))}>
          ←
        </button>
        <h3>{monthName}</h3>
        <button onClick={() => setCurrentMonth(new Date(currentMonth.getUTCFullYear(), currentMonth.getUTCMonth() + 1))}>
          →
        </button>
      </div>
      <div className="saturdays-grid">
        {saturdays.map(saturday => {
          const dateStr = saturday.toISOString().split('T')[0];
          const availEntry = availability.get(dateStr);
          const avail = availEntry?.status || 'Available';
          const isSelected = dateStr === selectedDate;

          return (
            <button
              key={dateStr}
              className={`saturday-button ${avail.toLowerCase()} ${isSelected ? 'selected' : ''}`}
              onClick={() => handleDateSelect(saturday)}
              title={`${saturday.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} - ${avail}`}
            >
              <div className="date-number">{saturday.getUTCDate()}</div>
              <div className="availability-badge">{avail}</div>
            </button>
          );
        })}
      </div>
      {selectedDate && (
        <div className="selected-dates">
          <p>
            {new Date(selectedDate + 'T00:00:00Z').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}{' '}
            –{' '}
            {new Date(new Date(selectedDate + 'T00:00:00Z').getTime() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(
              'en-US',
              { weekday: 'short', month: 'short', day: 'numeric' }
            )}{' '}
            · 7 nights
          </p>
        </div>
      )}
    </div>
  );
}
