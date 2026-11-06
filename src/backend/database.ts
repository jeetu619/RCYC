import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { addDays, todayISO } from '../shared/dates';

let db: Database | null = null;

/**
 * Opens (once) the SQLite database. `filename` defaults to $DB_PATH or ./data.sqlite3;
 * pass ':memory:' for an isolated database (used by the tests).
 */
export async function initializeDatabase(filename?: string): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: filename ?? process.env.DB_PATH ?? path.resolve(process.cwd(), 'data.sqlite3'),
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await createTables();
  await seedYachts();
  await seedC2Calendar();

  return db;
}

async function createTables() {
  if (!db) throw new Error('Database not initialized');

  await db.exec(`
    CREATE TABLE IF NOT EXISTS yachts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      lengthMeters REAL NOT NULL,
      cabins INTEGER NOT NULL,
      maxGuests INTEGER NOT NULL,
      weeklyRateEuro REAL NOT NULL,
      photoUrl TEXT
    );

    CREATE TABLE IF NOT EXISTS booking_reference_counters (
      year INTEGER PRIMARY KEY,
      counter INTEGER NOT NULL DEFAULT 0
    );

    -- Stand-in for the C2 availability calendar: Saturdays that are Held or Booked.
    -- Any Saturday without a row is Available.
    CREATE TABLE IF NOT EXISTS c2_calendar (
      yachtId TEXT NOT NULL,
      startDate TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('Held', 'Booked')),
      PRIMARY KEY (yachtId, startDate),
      FOREIGN KEY (yachtId) REFERENCES yachts(id)
    );

    CREATE TABLE IF NOT EXISTS charter_enquiries (
      id TEXT PRIMARY KEY,
      bookingReference TEXT NOT NULL UNIQUE,
      yachtId TEXT NOT NULL,
      clientName TEXT NOT NULL,
      clientEmail TEXT NOT NULL,
      clientPhone TEXT NOT NULL,
      startDate TEXT NOT NULL,
      endDate TEXT NOT NULL,
      numberOfAdultGuests INTEGER NOT NULL,
      numberOfChildren INTEGER NOT NULL,
      cruisingArea TEXT NOT NULL,
      otherCruisingAreaDetails TEXT,
      occasion TEXT,
      otherOccasionDetails TEXT,
      specialRequests TEXT,
      privacyConsent BOOLEAN NOT NULL,
      marketingOptIn BOOLEAN DEFAULT 0,
      submissionTimestamp TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Submitted',
      FOREIGN KEY (yachtId) REFERENCES yachts(id)
    );

    CREATE INDEX IF NOT EXISTS idx_charter_enquiries_status
      ON charter_enquiries(status);
    CREATE INDEX IF NOT EXISTS idx_charter_enquiries_yacht_id
      ON charter_enquiries(yachtId);
    CREATE INDEX IF NOT EXISTS idx_charter_enquiries_submission_timestamp
      ON charter_enquiries(submissionTimestamp);
  `);
}

async function seedYachts() {
  if (!db) throw new Error('Database not initialized');

  const yachtCount = await db.get('SELECT COUNT(*) as count FROM yachts');
  if (yachtCount.count > 0) {
    // Databases seeded before photos existed: fill in the missing images.
    await db.run("UPDATE yachts SET photoUrl = '/images/sea-lark.svg' WHERE id = 'yacht-sea-lark' AND (photoUrl IS NULL OR photoUrl = '')");
    await db.run("UPDATE yachts SET photoUrl = '/images/calliope.svg' WHERE id = 'yacht-calliope' AND (photoUrl IS NULL OR photoUrl = '')");
    return;
  }

  await db.exec(`
    INSERT INTO yachts (id, name, lengthMeters, cabins, maxGuests, weeklyRateEuro, photoUrl) VALUES
    ('yacht-sea-lark', 'Sea Lark', 25, 5, 10, 65000, '/images/sea-lark.svg'),
    ('yacht-calliope', 'Calliope', 20, 4, 8, 29500, '/images/calliope.svg');
  `);
}

/** Demo availability so the calendar shows Available / Held / Booked weeks out of the box. */
async function seedC2Calendar() {
  if (!db) throw new Error('Database not initialized');
  const existing = await db.get('SELECT COUNT(*) as count FROM c2_calendar');
  if (existing.count > 0) return;

  // First Saturday strictly after today.
  let saturday = addDays(todayISO(), 1);
  while (new Date(`${saturday}T00:00:00Z`).getUTCDay() !== 6) saturday = addDays(saturday, 1);
  const week = (n: number) => addDays(saturday, n * 7);

  const rows: Array<[string, string, 'Held' | 'Booked']> = [
    ['yacht-sea-lark', week(1), 'Held'],
    ['yacht-sea-lark', week(2), 'Booked'],
    ['yacht-sea-lark', week(4), 'Booked'],
    ['yacht-calliope', week(0), 'Booked'],
    ['yacht-calliope', week(3), 'Held']
  ];
  for (const [yachtId, startDate, status] of rows) {
    await db.run('INSERT OR IGNORE INTO c2_calendar (yachtId, startDate, status) VALUES (?, ?, ?)', [
      yachtId,
      startDate,
      status
    ]);
  }
}

export function getDatabase(): Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function closeDatabase() {
  if (db) {
    await db.close();
    db = null;
  }
}
