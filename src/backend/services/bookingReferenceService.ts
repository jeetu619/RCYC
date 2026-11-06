import { getDatabase } from '../database';

export async function generateBookingReference(): Promise<string> {
  const db = getDatabase();
  const year = new Date().getUTCFullYear();

  await db.run('INSERT OR IGNORE INTO booking_reference_counters (year, counter) VALUES (?, 0)', [year]);

  const result = await db.run(
    'UPDATE booking_reference_counters SET counter = counter + 1 WHERE year = ?',
    [year]
  );

  const counter = await db.get(
    'SELECT counter FROM booking_reference_counters WHERE year = ?',
    [year]
  );

  const paddedCounter = String(counter.counter).padStart(4, '0');
  return `ENQ-${year}-${paddedCounter}`;
}
