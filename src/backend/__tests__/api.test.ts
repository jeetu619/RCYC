import { randomUUID } from 'crypto';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createApp } from '../app';
import { closeDatabase, getDatabase, initializeDatabase } from '../database';
import { createSession } from '../auth';
import { addDays, todayISO } from '../../shared/dates';

const ACCESS_CODE = randomUUID();

let server: Server;
let base: string;
let flush: () => Promise<void>;
let failC2 = false;
const emails: string[] = [];

/** The n-th Saturday strictly after today. */
function saturday(n: number): string {
  let d = addDays(todayISO(), 1);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 6) d = addDays(d, 1);
  return addDays(d, n * 7);
}

async function api(path: string, init: { method?: string; body?: unknown; token?: string; raw?: string } = {}) {
  const res = await fetch(`${base}${path}`, {
    method: init.method ?? (init.body !== undefined || init.raw !== undefined ? 'POST' : 'GET'),
    headers: {
      'Content-Type': 'application/json',
      ...(init.token ? { Authorization: `Bearer ${init.token}` } : {})
    },
    body: init.raw ?? (init.body !== undefined ? JSON.stringify(init.body) : undefined)
  });
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

const validEnquiry = (overrides: Record<string, unknown> = {}) => ({
  yachtId: 'yacht-sea-lark',
  startDate: saturday(10),
  numberOfAdultGuests: 6,
  numberOfChildren: 2,
  cruisingArea: 'Greek Islands',
  occasion: 'Holiday',
  specialRequests: 'Need child seats.',
  clientName: 'John Doe',
  clientEmail: 'john.doe@example.com',
  clientPhone: '+1234567890',
  privacyConsent: true,
  marketingOptIn: true,
  ...overrides
});

async function brokerToken() {
  const res = await api('/api/auth/broker-login', { body: { accessCode: ACCESS_CODE } });
  return res.body.sessionToken as string;
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
  const created = createApp({
    brokerAccessCode: ACCESS_CODE,
    notify: async e => {
      emails.push(e.bookingReference);
    },
    c2Trigger: async id => {
      if (failC2) throw new Error('C2 down');
      const { triggerC2AvailabilityCheck } = await import('../services/c2Service');
      await triggerC2AvailabilityCheck(id);
    }
  });
  flush = created.flush;
  await new Promise<void>(resolve => {
    server = created.app.listen(0, '127.0.0.1', () => resolve());
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise(resolve => server.close(resolve));
  await closeDatabase();
});

describe('API-02 GET /api/yachts', () => {
  it('returns the demo yachts with all card fields', async () => {
    const { status, body } = await api('/api/yachts');
    expect(status).toBe(200);
    const names = body.map((y: any) => y.name).sort();
    expect(names).toEqual(['Calliope', 'Sea Lark']);
    const seaLark = body.find((y: any) => y.id === 'yacht-sea-lark');
    expect(seaLark).toMatchObject({ lengthMeters: 25, cabins: 5, maxGuests: 10, weeklyRateEuro: 65000 });
    expect(seaLark.photoUrl).toBeTruthy();
  });
});

describe('API-03 GET /api/yachts/:id/availability', () => {
  it('lists only Saturdays with Available / Held / Booked', async () => {
    const from = saturday(0);
    const to = saturday(5);
    const { status, body } = await api(`/api/yachts/yacht-sea-lark/availability?from=${from}&to=${to}`);
    expect(status).toBe(200);
    expect(body).toHaveLength(6);
    for (const entry of body) expect(new Date(`${entry.date}T00:00:00Z`).getUTCDay()).toBe(6);
    expect(body.map((e: any) => e.status)).toEqual([
      'Available',
      'Held',
      'Booked',
      'Available',
      'Booked',
      'Available'
    ]);
  });

  it('400 for bad dates or range, 404 for unknown yacht', async () => {
    expect((await api('/api/yachts/yacht-sea-lark/availability?from=nope&to=2027-01-01')).status).toBe(400);
    expect((await api('/api/yachts/yacht-sea-lark/availability')).status).toBe(400);
    expect((await api('/api/yachts/yacht-sea-lark/availability?from=2027-02-01&to=2027-01-01')).status).toBe(400);
    expect((await api('/api/yachts/bad%20id!/availability?from=2027-01-01&to=2027-02-01')).status).toBe(400);
    expect((await api('/api/yachts/yacht-nope/availability?from=2027-01-01&to=2027-02-01')).status).toBe(404);
  });
});

describe('API-04 POST /api/charter-enquiries/check', () => {
  const check = (yachtId: string, startDate: string, numberOfGuests: unknown) =>
    api('/api/charter-enquiries/check', { body: { yachtId, startDate, numberOfGuests } });

  it('Available on a free Saturday within capacity', async () => {
    const { status, body } = await check('yacht-sea-lark', saturday(10), 8);
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'Available', alternatives: [] });
  });

  it('OnHold when the week is held', async () => {
    const { body } = await check('yacht-sea-lark', saturday(1), 8);
    expect(body.status).toBe('OnHold');
    expect(body.message).toMatch(/On hold/);
  });

  it('Booked returns up to 3 alternatives: same yacht nearest Saturdays first, then other yachts', async () => {
    const { body } = await check('yacht-sea-lark', saturday(2), 4);
    expect(body.status).toBe('Booked');
    expect(body.alternatives.length).toBeGreaterThan(0);
    expect(body.alternatives.length).toBeLessThanOrEqual(3);
    expect(body.alternatives[0]).toMatchObject({ yachtId: 'yacht-sea-lark', startDate: saturday(3), numberOfGuests: 4 });
    for (const alt of body.alternatives) {
      expect(alt.endDate).toBe(addDays(alt.startDate, 7));
      expect(alt.startDate).not.toBe(saturday(2));
    }
  });

  it('CapacityExceeded when guests exceed maxGuests, suggesting yachts that fit', async () => {
    const { body } = await check('yacht-calliope', saturday(10), 9);
    expect(body.status).toBe('CapacityExceeded');
    expect(body.message).toMatch(/Too many guests/);
    expect(body.alternatives[0]).toMatchObject({ yachtId: 'yacht-sea-lark', startDate: saturday(10) });
  });

  it('400 for missing / invalid input', async () => {
    expect((await check('yacht-sea-lark', saturday(10), 0)).status).toBe(400);
    expect((await check('yacht-sea-lark', saturday(10), 'many')).status).toBe(400);
    expect((await check('yacht-sea-lark', saturday(10) + 'x', 3)).status).toBe(400);
    expect((await check('yacht-sea-lark', addDays(saturday(10), 1), 3)).status).toBe(400);
    expect((await check('yacht-nope', saturday(10), 3)).status).toBe(400);
    expect((await api('/api/charter-enquiries/check', { body: {} })).status).toBe(400);
  });
});

describe('API-01 POST /api/v1/charter-enquiries', () => {
  it('creates an enquiry, returns reference ENQ-YYYY-NNNN, derived end date and yacht name', async () => {
    const start = saturday(10);
    const { status, body } = await api('/api/v1/charter-enquiries', { body: validEnquiry({ startDate: start }) });
    expect(status).toBe(201);
    expect(body.bookingReference).toMatch(new RegExp(`^ENQ-${new Date().getUTCFullYear()}-\\d{4}$`));
    expect(body).toMatchObject({
      message: 'Charter enquiry submitted successfully.',
      yachtName: 'Sea Lark',
      startDate: start,
      endDate: addDays(start, 7)
    });
    await flush();
    expect(emails).toContain(body.bookingReference);
  });

  it('generates a unique, sequential reference for every submission, even concurrent ones', async () => {
    const results = await Promise.all(
      Array.from({ length: 6 }, () => api('/api/v1/charter-enquiries', { body: validEnquiry() }))
    );
    const refs = results.map(r => r.body.bookingReference as string);
    expect(new Set(refs).size).toBe(6);
    const numbers = refs.map(r => parseInt(r.split('-')[2], 10)).sort((a, b) => a - b);
    for (let i = 1; i < numbers.length; i++) expect(numbers[i]).toBe(numbers[i - 1] + 1);
    await flush();
  });

  it('stores timestamp and status Submitted, then C2 updates the status', async () => {
    const { body } = await api('/api/v1/charter-enquiries', { body: validEnquiry({ startDate: saturday(11) }) });
    const row = await getDatabase().get('SELECT * FROM charter_enquiries WHERE bookingReference = ?', [
      body.bookingReference
    ]);
    expect(row.submissionTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(row.privacyConsent).toBe(1);
    expect(row.marketingOptIn).toBe(1);
    await flush();
    const after = await getDatabase().get('SELECT status FROM charter_enquiries WHERE bookingReference = ?', [
      body.bookingReference
    ]);
    expect(after.status).toBe('Available');
  });

  it('marks the enquiry IntegrationError when the C2 trigger fails, but still confirms to the client', async () => {
    failC2 = true;
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const { status, body } = await api('/api/v1/charter-enquiries', { body: validEnquiry() });
      expect(status).toBe(201);
      await flush();
      const row = await getDatabase().get('SELECT status FROM charter_enquiries WHERE bookingReference = ?', [
        body.bookingReference
      ]);
      expect(row.status).toBe('IntegrationError');
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[ALERT]'));
    } finally {
      failC2 = false;
      errorSpy.mockRestore();
    }
  });

  const rejected: Array<[string, Record<string, unknown>, string]> = [
    ['missing yachtId', { yachtId: undefined }, 'yachtId'],
    ['unknown yacht', { yachtId: 'yacht-nope' }, 'yachtId'],
    ['missing startDate', { startDate: undefined }, 'startDate'],
    ['bad date format', { startDate: '12/06/2027' }, 'startDate'],
    ['non-existent date', { startDate: '2027-02-30' }, 'startDate'],
    ['non-Saturday', { startDate: addDays(saturday(10), 1) }, 'startDate'],
    ['past Saturday', { startDate: '2020-01-04' }, 'startDate'],
    ['zero adults', { numberOfAdultGuests: 0 }, 'numberOfAdultGuests'],
    ['fractional adults', { numberOfAdultGuests: 2.5 }, 'numberOfAdultGuests'],
    ['string guests', { numberOfAdultGuests: '4' }, 'numberOfAdultGuests'],
    ['negative children', { numberOfChildren: -1 }, 'numberOfChildren'],
    ['over capacity (R-06)', { numberOfAdultGuests: 9, numberOfChildren: 2 }, 'numberOfAdultGuests'],
    ['missing cruising area', { cruisingArea: undefined }, 'cruisingArea'],
    ['unlisted cruising area', { cruisingArea: 'Atlantis' }, 'cruisingArea'],
    ['Other cruising area without text', { cruisingArea: 'Other' }, 'otherCruisingAreaDetails'],
    ['cruising text > 100', { cruisingArea: 'Other', otherCruisingAreaDetails: 'x'.repeat(101) }, 'otherCruisingAreaDetails'],
    ['Other occasion without text', { occasion: 'Other' }, 'otherOccasionDetails'],
    ['unlisted occasion', { occasion: 'Wake' }, 'occasion'],
    ['special requests > 500', { specialRequests: 'x'.repeat(501) }, 'specialRequests'],
    ['short name', { clientName: 'J' }, 'clientName'],
    ['long name', { clientName: 'J'.repeat(101) }, 'clientName'],
    ['invalid email', { clientEmail: 'not-an-email' }, 'clientEmail'],
    ['missing phone', { clientPhone: undefined }, 'clientPhone'],
    ['non-international phone', { clientPhone: '0123456789' }, 'clientPhone'],
    ['no privacy consent', { privacyConsent: false }, 'privacyConsent'],
    ['privacy consent as string', { privacyConsent: 'true' }, 'privacyConsent']
  ];

  it.each(rejected)('400 for %s', async (_name, overrides, field) => {
    const { status, body } = await api('/api/v1/charter-enquiries', { body: validEnquiry(overrides) });
    expect(status).toBe(400);
    expect(body.details.map((d: any) => d.field)).toContain(field);
  });

  it('400 for malformed JSON and non-object bodies, with nothing stored', async () => {
    const before = await getDatabase().get('SELECT COUNT(*) AS n FROM charter_enquiries');
    expect((await api('/api/v1/charter-enquiries', { raw: '{ not json' })).status).toBe(400);
    expect((await api('/api/v1/charter-enquiries', { raw: '[]' })).status).toBe(400);
    expect((await api('/api/v1/charter-enquiries', { raw: 'null' })).status).toBe(400);
    const after = await getDatabase().get('SELECT COUNT(*) AS n FROM charter_enquiries');
    expect(after.n).toBe(before.n);
  });

  it('treats SQL-injection style input as plain data', async () => {
    const evil = "Robert'); DROP TABLE charter_enquiries;--";
    const { status, body } = await api('/api/v1/charter-enquiries', {
      body: validEnquiry({ clientName: evil, specialRequests: evil })
    });
    expect(status).toBe(201);
    const row = await getDatabase().get('SELECT clientName FROM charter_enquiries WHERE bookingReference = ?', [
      body.bookingReference
    ]);
    expect(row.clientName).toBe(evil);
    await flush();
  });

  it('does not reject a Booked week itself (C2 owns availability); it is recorded as Booked', async () => {
    const { status, body } = await api('/api/v1/charter-enquiries', {
      body: validEnquiry({ startDate: saturday(2) })
    });
    expect(status).toBe(201);
    await flush();
    const row = await getDatabase().get('SELECT status FROM charter_enquiries WHERE bookingReference = ?', [
      body.bookingReference
    ]);
    expect(row.status).toBe('Booked');
  });
});

describe('SCR-02 GET /api/charter-enquiries/:reference', () => {
  it('returns the confirmation summary without contact details', async () => {
    const start = saturday(12);
    const created = await api('/api/v1/charter-enquiries', {
      body: validEnquiry({ startDate: start, yachtId: 'yacht-calliope', numberOfAdultGuests: 4, numberOfChildren: 2 })
    });
    await flush();
    const { status, body } = await api(`/api/charter-enquiries/${created.body.bookingReference}`);
    expect(status).toBe(200);
    expect(body).toMatchObject({
      bookingReference: created.body.bookingReference,
      yachtName: 'Calliope',
      guests: 6,
      cruisingArea: 'Greek Islands',
      status: 'Available'
    });
    expect(body.dates).toMatch(/^Sat \d{2} \w{3} – Sat \d{2} \w{3} \d{4} · 7 nights$/);
    expect(body.clientEmail).toBeUndefined();
    expect(body.clientPhone).toBeUndefined();
  });

  it('404 for unknown or malformed references', async () => {
    expect((await api('/api/charter-enquiries/ENQ-1999-0001')).status).toBe(404);
    expect((await api("/api/charter-enquiries/x'%20OR%201=1")).status).toBe(404);
  });
});

describe('API-05 GET /api/charter-enquiries (broker)', () => {
  it('401 without a session, 401 with an unknown one, 403 for a non-broker role', async () => {
    expect((await api('/api/charter-enquiries')).status).toBe(401);
    expect((await api('/api/charter-enquiries', { token: randomUUID() })).status).toBe(401);
    expect((await api('/api/charter-enquiries', { token: createSession('Client') })).status).toBe(403);
  });

  it('broker login rejects a wrong access code', async () => {
    expect((await api('/api/auth/broker-login', { body: { accessCode: randomUUID() } })).status).toBe(401);
    expect((await api('/api/auth/broker-login', { body: {} })).status).toBe(401);
  });

  it('lists enquiries with the documented columns, newest first, plus KPIs', async () => {
    const token = await brokerToken();
    const { status, body } = await api('/api/charter-enquiries?pageSize=5', { token });
    expect(status).toBe(200);
    expect(body.total).toBeGreaterThan(5);
    expect(body.enquiries).toHaveLength(5);
    expect(Object.keys(body.enquiries[0]).sort()).toEqual(
      ['clientName', 'endDate', 'guests', 'receivedDate', 'reference', 'startDate', 'status', 'yachtName'].sort()
    );
    const stamps = body.enquiries.map((e: any) => e.receivedDate);
    expect([...stamps].sort().reverse()).toEqual(stamps);
    expect(Object.keys(body.kpis).sort()).toEqual(['available', 'percentAvailable', 'today', 'unavailable']);
  });

  it('KPIs: today, Available, Booked+CapacityExceeded and % available are consistent with the data', async () => {
    const token = await brokerToken();
    const db = getDatabase();
    const count = async (where: string) => (await db.get(`SELECT COUNT(*) AS n FROM charter_enquiries ${where}`)).n;
    const { body } = await api('/api/charter-enquiries', { token });
    const total = await count('');
    expect(body.total).toBe(total);
    expect(body.kpis.today).toBe(total); // everything in this suite was received today
    expect(body.kpis.available).toBe(await count("WHERE status = 'Available'"));
    expect(body.kpis.unavailable).toBe(await count("WHERE status IN ('Booked','CapacityExceeded')"));
    expect(body.kpis.percentAvailable).toBe(Math.round((body.kpis.available / total) * 100));
  });

  it('filters by status, yacht, received-date range and search, with KPIs following the filter', async () => {
    const token = await brokerToken();

    const booked = await api('/api/charter-enquiries?status=Booked', { token });
    expect(booked.body.total).toBeGreaterThan(0);
    expect(booked.body.enquiries.every((e: any) => e.status === 'Booked')).toBe(true);
    expect(booked.body.kpis.unavailable).toBe(booked.body.total);
    expect(booked.body.kpis.percentAvailable).toBe(0);

    const calliope = await api('/api/charter-enquiries?yachtId=yacht-calliope&pageSize=100', { token });
    expect(calliope.body.total).toBeGreaterThan(0);
    expect(calliope.body.enquiries.every((e: any) => e.yachtName === 'Calliope')).toBe(true);

    const today = todayISO();
    const inRange = await api(`/api/charter-enquiries?dateFrom=${today}&dateTo=${today}`, { token });
    const all = await api('/api/charter-enquiries', { token });
    expect(inRange.body.total).toBe(all.body.total);
    const past = await api(`/api/charter-enquiries?dateFrom=2020-01-01&dateTo=2020-01-31`, { token });
    expect(past.body).toMatchObject({ total: 0, enquiries: [] });
    expect(past.body.kpis).toEqual({ today: 0, available: 0, unavailable: 0, percentAvailable: 0 });

    const byName = await api('/api/charter-enquiries?search=robert&pageSize=100', { token });
    expect(byName.body.total).toBeGreaterThan(0);
    expect(byName.body.enquiries.every((e: any) => /robert/i.test(e.clientName))).toBe(true);

    const byYacht = await api('/api/charter-enquiries?search=calliope', { token });
    expect(byYacht.body.enquiries.every((e: any) => e.yachtName === 'Calliope')).toBe(true);

    const ref = all.body.enquiries[0].reference;
    const byRef = await api(`/api/charter-enquiries?search=${ref}`, { token });
    expect(byRef.body.enquiries.map((e: any) => e.reference)).toEqual([ref]);

    const wildcard = await api('/api/charter-enquiries?search=%25', { token });
    expect(wildcard.body.total).toBe(0); // '%' is matched literally, not as a wildcard

    const combined = await api('/api/charter-enquiries?status=Available&yachtId=yacht-sea-lark&search=John', { token });
    expect(
      combined.body.enquiries.every((e: any) => e.status === 'Available' && e.yachtName === 'Sea Lark' && /john/i.test(e.clientName))
    ).toBe(true);
  });

  it('paginates', async () => {
    const token = await brokerToken();
    const p1 = await api('/api/charter-enquiries?page=1&pageSize=4', { token });
    const p2 = await api('/api/charter-enquiries?page=2&pageSize=4', { token });
    expect(p1.body.enquiries).toHaveLength(4);
    const refs1 = p1.body.enquiries.map((e: any) => e.reference);
    const refs2 = p2.body.enquiries.map((e: any) => e.reference);
    expect(refs2.some((r: string) => refs1.includes(r))).toBe(false);
    expect(p2.body.total).toBe(p1.body.total);
  });

  it('400 for invalid query parameters', async () => {
    const token = await brokerToken();
    for (const qs of ['status=Nope', 'dateFrom=yesterday', 'page=0', 'pageSize=1000', 'pageSize=abc', "yachtId=a'b"]) {
      expect((await api(`/api/charter-enquiries?${qs}`, { token })).status).toBe(400);
    }
  });
});

describe('server errors', () => {
  it('500 responses do not leak internals', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    const db = getDatabase();
    await db.exec('ALTER TABLE yachts RENAME TO yachts_tmp');
    try {
      const { status, body } = await api('/api/yachts');
      expect(status).toBe(500);
      expect(JSON.stringify(body)).not.toMatch(/sqlite|no such table/i);
    } finally {
      await db.exec('ALTER TABLE yachts_tmp RENAME TO yachts');
      errorSpy.mockRestore();
    }
  });
});
