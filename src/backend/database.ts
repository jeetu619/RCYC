import sqlite3 from 'sqlite3';
import { open, Database } from 'sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database | null = null;

export async function initializeDatabase(): Promise<Database> {
  if (db) return db;

  db = await open({
    filename: path.join(__dirname, '../../data.sqlite3'),
    driver: sqlite3.Database
  });

  await db.exec('PRAGMA foreign_keys = ON');

  await createTables();
  await seedYachts();

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

    CREATE INDEX IF NOT EXISTS idx_charter_enquiries_booking_reference
      ON charter_enquiries(bookingReference);
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
  if (yachtCount.count > 0) return;

  await db.exec(`
    INSERT INTO yachts (id, name, lengthMeters, cabins, maxGuests, weeklyRateEuro, photoUrl) VALUES
    ('yacht-sea-lark', 'Sea Lark', 25, 5, 10, 65000, '/images/sea-lark.jpg'),
    ('yacht-calliope', 'Calliope', 20, 4, 8, 29500, '/images/calliope.jpg');
  `);
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
