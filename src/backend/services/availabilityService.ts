import type { AvailabilityEntry, AlternativeOption, LiveCheckStatus } from '../../shared/types';
import { getDatabase } from '../database';

export async function getYachtAvailability(yachtId: string, from: string, to: string): Promise<AvailabilityEntry[]> {
  const startDate = new Date(from + 'T00:00:00Z');
  const endDate = new Date(to + 'T00:00:00Z');
  const availability: AvailabilityEntry[] = [];

  const db = getDatabase();
  const booked = await db.all(
    `SELECT DISTINCT startDate FROM charter_enquiries
     WHERE yachtId = ? AND status IN ('Submitted', 'Available', 'OnHold')
     AND startDate >= ? AND startDate <= ?`,
    [yachtId, from, to]
  );

  const bookedDates = new Set(booked.map((b: any) => b.startDate));

  let current = new Date(startDate);
  while (current <= endDate) {
    if (current.getUTCDay() === 6) {
      const dateStr = current.toISOString().split('T')[0];
      const status = bookedDates.has(dateStr) ? 'Booked' : 'Available';
      availability.push({ date: dateStr, status });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return availability;
}

export async function checkLiveAvailability(
  yachtId: string,
  startDate: string,
  numberOfGuests: number
): Promise<{ status: LiveCheckStatus; message: string; alternatives: AlternativeOption[] }> {
  const db = getDatabase();

  const yacht = await db.get('SELECT maxGuests FROM yachts WHERE id = ?', [yachtId]);
  if (!yacht) {
    return {
      status: 'Booked',
      message: 'Yacht not found',
      alternatives: []
    };
  }

  if (numberOfGuests > yacht.maxGuests) {
    const alternatives = await getAlternativeYachts(yachtId, startDate, numberOfGuests);
    return {
      status: 'CapacityExceeded',
      message: `Too many guests for this yacht (max ${yacht.maxGuests})`,
      alternatives
    };
  }

  const existingEnquiry = await db.get(
    `SELECT id FROM charter_enquiries
     WHERE yachtId = ? AND startDate = ?
     AND status IN ('Submitted', 'Available', 'OnHold')`,
    [yachtId, startDate]
  );

  if (existingEnquiry) {
    const alternatives = await getAlternativeYachts(yachtId, startDate, numberOfGuests);
    return {
      status: 'Booked',
      message: 'This yacht is not available for the selected dates',
      alternatives
    };
  }

  return {
    status: 'Available',
    message: 'This yacht is available for your dates and guest count.',
    alternatives: []
  };
}

async function getAlternativeYachts(
  yachtId: string,
  startDate: string,
  numberOfGuests: number
): Promise<AlternativeOption[]> {
  const db = getDatabase();
  const alternatives: AlternativeOption[] = [];

  const currentDate = new Date(startDate + 'T00:00:00Z');
  const searchStart = new Date(currentDate);
  searchStart.setUTCDate(searchStart.getUTCDate() - 21);
  const searchEnd = new Date(currentDate);
  searchEnd.setUTCDate(searchEnd.getUTCDate() + 21);

  const yachts = await db.all(
    'SELECT id, name, maxGuests FROM yachts WHERE id != ? ORDER BY maxGuests DESC LIMIT 2',
    [yachtId]
  );

  for (const yacht of yachts) {
    if (yacht.maxGuests < numberOfGuests) continue;

    let searchDate = new Date(searchStart);
    let found = false;

    while (searchDate <= searchEnd && alternatives.length < 3) {
      if (searchDate.getUTCDay() === 6) {
        const dateStr = searchDate.toISOString().split('T')[0];
        const endDateStr = new Date(searchDate);
        endDateStr.setUTCDate(endDateStr.getUTCDate() + 7);
        const endDateStrFormatted = endDateStr.toISOString().split('T')[0];

        const conflict = await db.get(
          `SELECT id FROM charter_enquiries
           WHERE yachtId = ? AND startDate = ?
           AND status IN ('Submitted', 'Available', 'OnHold')`,
          [yacht.id, dateStr]
        );

        if (!conflict && Math.abs(new Date(dateStr).getTime() - currentDate.getTime()) > 0) {
          alternatives.push({
            yachtId: yacht.id,
            yachtName: yacht.name,
            startDate: dateStr,
            endDate: endDateStrFormatted,
            reason: dateStr !== startDate ? 'Alternative date available' : 'Alternative yacht available'
          });
          found = true;
          break;
        }
      }
      searchDate.setUTCDate(searchDate.getUTCDate() + 1);
    }
  }

  return alternatives;
}
