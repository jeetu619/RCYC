import { getDatabase } from '../database';

/**
 * R-04: ENQ-YYYY-NNNN, with NNNN a sequential number per year.
 * The counter is incremented atomically in a single statement so concurrent
 * submissions can never receive the same number.
 */
export async function generateBookingReference(now: Date = new Date()): Promise<string> {
  const db = getDatabase();
  const year = now.getUTCFullYear();

  const row = await db.get(
    `INSERT INTO booking_reference_counters (year, counter) VALUES (?, 1)
     ON CONFLICT(year) DO UPDATE SET counter = counter + 1
     RETURNING counter`,
    [year]
  );

  return `ENQ-${year}-${String(row.counter).padStart(4, '0')}`;
}
