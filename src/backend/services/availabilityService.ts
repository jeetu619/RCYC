import type { AlternativeOption, AvailabilityEntry, AvailabilityStatus, LiveCheckResponse } from '../../shared/types';
import { ALTERNATIVE_WEEKS_RANGE, MAX_ALTERNATIVES } from '../../shared/constants';
import { addDays, deriveEndDate, isFutureDate, parseISODate, toISODate } from '../../shared/dates';
import { getDatabase } from '../database';

/**
 * Stand-in for the C2 availability service (the real C2 owns holds and bookings).
 * Reads the c2_calendar table: Saturdays without a row are Available.
 */
export async function getDateStatus(yachtId: string, date: string): Promise<AvailabilityStatus> {
  const row = await getDatabase().get('SELECT status FROM c2_calendar WHERE yachtId = ? AND startDate = ?', [
    yachtId,
    date
  ]);
  return (row?.status as AvailabilityStatus | undefined) ?? 'Available';
}

/** API-03: status of every Saturday between `from` and `to` (inclusive). */
export async function getYachtAvailability(yachtId: string, from: string, to: string): Promise<AvailabilityEntry[]> {
  const rows = await getDatabase().all(
    'SELECT startDate, status FROM c2_calendar WHERE yachtId = ? AND startDate >= ? AND startDate <= ?',
    [yachtId, from, to]
  );
  const marked = new Map<string, AvailabilityStatus>(rows.map((r: any) => [r.startDate, r.status]));

  const result: AvailabilityEntry[] = [];
  const current = parseISODate(from)!;
  const end = parseISODate(to)!;
  while (current <= end) {
    if (current.getUTCDay() === 6) {
      const date = toISODate(current);
      result.push({ date, status: marked.get(date) ?? 'Available' });
    }
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return result;
}

/** API-04: live availability + capacity check, with up to 3 alternatives when the choice is not viable. */
export async function checkLiveAvailability(
  yachtId: string,
  startDate: string,
  numberOfGuests: number
): Promise<LiveCheckResponse | null> {
  const yacht = await getDatabase().get('SELECT maxGuests FROM yachts WHERE id = ?', [yachtId]);
  if (!yacht) return null;

  if (numberOfGuests > yacht.maxGuests) {
    return {
      status: 'CapacityExceeded',
      message: `Too many guests for this yacht (maximum ${yacht.maxGuests}).`,
      alternatives: await findAlternatives(yachtId, startDate, numberOfGuests)
    };
  }

  const dateStatus = await getDateStatus(yachtId, startDate);
  if (dateStatus === 'Booked') {
    return {
      status: 'Booked',
      message: 'This yacht is already booked for these dates.',
      alternatives: await findAlternatives(yachtId, startDate, numberOfGuests)
    };
  }
  if (dateStatus === 'Held') {
    return {
      status: 'OnHold',
      message: 'On hold – may become free. You can still submit your enquiry.',
      alternatives: []
    };
  }
  return {
    status: 'Available',
    message: 'This yacht is available for your dates and guest count.',
    alternatives: []
  };
}

/**
 * Up to 3 alternatives: the same yacht on the nearest free Saturdays within ±3 weeks,
 * then other suitable yachts on the same dates (or their nearest free Saturday).
 */
export async function findAlternatives(
  yachtId: string,
  startDate: string,
  numberOfGuests: number
): Promise<AlternativeOption[]> {
  const db = getDatabase();
  const yacht = await db.get('SELECT maxGuests FROM yachts WHERE id = ?', [yachtId]);
  const options: AlternativeOption[] = [];

  const offsets: number[] = [];
  for (let w = 1; w <= ALTERNATIVE_WEEKS_RANGE; w++) offsets.push(-w, w);

  const nearestFree = async (id: string): Promise<{ date: string; weeks: number } | null> => {
    const candidates = [0, ...offsets];
    for (const weeks of candidates) {
      const date = addDays(startDate, weeks * 7);
      if (!isFutureDate(date)) continue;
      if ((await getDateStatus(id, date)) === 'Available') return { date, weeks };
    }
    return null;
  };

  // Same yacht on other Saturdays (only useful when capacity is not the problem).
  if (yacht && numberOfGuests <= yacht.maxGuests) {
    const yachtRow = await db.get('SELECT name FROM yachts WHERE id = ?', [yachtId]);
    for (const weeks of offsets.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)) {
      const date = addDays(startDate, weeks * 7);
      if (!isFutureDate(date)) continue;
      if ((await getDateStatus(yachtId, date)) !== 'Available') continue;
      options.push({
        yachtId,
        yachtName: yachtRow.name,
        startDate: date,
        endDate: deriveEndDate(date),
        numberOfGuests,
        reason: `Same yacht, ${Math.abs(weeks)} week${Math.abs(weeks) > 1 ? 's' : ''} ${weeks < 0 ? 'earlier' : 'later'}`
      });
    }
  }

  const others = await db.all(
    'SELECT id, name FROM yachts WHERE id != ? AND maxGuests >= ? ORDER BY maxGuests DESC',
    [yachtId, numberOfGuests]
  );
  const sameWeek: AlternativeOption[] = [];
  for (const other of others) {
    const free = await nearestFree(other.id);
    if (!free) continue;
    sameWeek.push({
      yachtId: other.id,
      yachtName: other.name,
      startDate: free.date,
      endDate: deriveEndDate(free.date),
      numberOfGuests,
      reason: free.weeks === 0 ? 'Different yacht, same dates' : `Different yacht, ${Math.abs(free.weeks)} week${Math.abs(free.weeks) > 1 ? 's' : ''} ${free.weeks < 0 ? 'earlier' : 'later'}`
    });
  }

  // Same-date options on other yachts are the closest match, so they go first for a capacity problem
  // (where the same yacht cannot help) and after the same-yacht options otherwise.
  const ordered = numberOfGuests > (yacht?.maxGuests ?? Infinity) ? [...sameWeek, ...options] : [...options, ...sameWeek];
  return ordered.slice(0, MAX_ALTERNATIVES);
}
