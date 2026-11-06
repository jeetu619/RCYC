import express from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from './database';
import { bearerFrom, createSession, destroySession, requireBroker, safeEqual } from './auth';
import { checkLiveAvailability, getYachtAvailability } from './services/availabilityService';
import { generateBookingReference } from './services/bookingReferenceService';
import { C2Trigger, runC2Trigger, triggerC2AvailabilityCheck } from './services/c2Service';
import { Notifier, logConfirmationEmail } from './services/notificationService';
import { addDays, deriveEndDate, formatDateRange, isFutureDate, isSaturday, parseISODate } from '../shared/dates';
import { normalizePhone, sanitizeText, validateCharterEnquiry } from '../shared/validators';
import type { BrokerEnquiryListResponse, CharterEnquiryResponse, EnquiryConfirmation } from '../shared/types';

export interface AppOptions {
  /** Access code brokers sign in with. Required for broker login to work. */
  brokerAccessCode?: string;
  c2Trigger?: C2Trigger;
  notify?: Notifier;
}

const ENQUIRY_STATUSES = ['Submitted', 'Available', 'OnHold', 'Booked', 'CapacityExceeded', 'IntegrationError'];
const YACHT_ID = /^[a-z0-9-]{1,64}$/i;
const REFERENCE = /^ENQ-\d{4}-\d{4,}$/;
const MAX_RANGE_DAYS = 400;

const badRequest = (res: express.Response, error: string, details?: unknown) =>
  res.status(400).json({ error, ...(details ? { details } : {}) });

export function createApp(options: AppOptions = {}) {
  const app = express();
  const c2Trigger = options.c2Trigger ?? triggerC2AvailabilityCheck;
  const notify = options.notify ?? logConfirmationEmail;
  const pending = new Set<Promise<void>>();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));

  const serverError = (res: express.Response, context: string, error: unknown) => {
    console.error(`[API] ${context} failed:`, error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  };

  // ---- Broker authentication (mock identity provider) ----------------------------------------
  app.post('/api/auth/broker-login', (req, res) => {
    const code = req.body?.accessCode;
    if (!options.brokerAccessCode || typeof code !== 'string' || !safeEqual(code, options.brokerAccessCode)) {
      return res.status(401).json({ error: 'Invalid access code' });
    }
    res.json({ sessionToken: createSession('Broker'), role: 'Broker' });
  });

  app.post('/api/auth/logout', (req, res) => {
    const session = bearerFrom(req);
    if (session) destroySession(session);
    res.status(204).end();
  });

  // ---- API-02 ---------------------------------------------------------------------------------
  app.get('/api/yachts', async (_req, res) => {
    try {
      res.json(await getDatabase().all('SELECT * FROM yachts ORDER BY weeklyRateEuro DESC'));
    } catch (error) {
      serverError(res, 'GET /api/yachts', error);
    }
  });

  // ---- API-03 ---------------------------------------------------------------------------------
  app.get('/api/yachts/:id/availability', async (req, res) => {
    try {
      const { id } = req.params;
      const { from, to } = req.query;
      const fromDate = parseISODate(from);
      const toDate = parseISODate(to);

      if (!YACHT_ID.test(id)) return badRequest(res, 'Invalid yacht id');
      if (!fromDate || !toDate) return badRequest(res, 'from and to must be dates in YYYY-MM-DD format');
      if (toDate < fromDate) return badRequest(res, 'to must not be before from');
      if ((toDate.getTime() - fromDate.getTime()) / 86400000 > MAX_RANGE_DAYS) {
        return badRequest(res, `Date range must not exceed ${MAX_RANGE_DAYS} days`);
      }

      const yacht = await getDatabase().get('SELECT id FROM yachts WHERE id = ?', [id]);
      if (!yacht) return res.status(404).json({ error: 'Yacht not found' });

      res.json(await getYachtAvailability(id, from as string, to as string));
    } catch (error) {
      serverError(res, 'GET availability', error);
    }
  });

  // ---- API-04 ---------------------------------------------------------------------------------
  app.post('/api/charter-enquiries/check', async (req, res) => {
    try {
      const { yachtId, startDate, numberOfGuests } = req.body ?? {};
      if (typeof yachtId !== 'string' || !YACHT_ID.test(yachtId)) return badRequest(res, 'yachtId is required');
      if (typeof startDate !== 'string' || !parseISODate(startDate)) {
        return badRequest(res, 'startDate must be a date in YYYY-MM-DD format');
      }
      if (!isSaturday(startDate)) return badRequest(res, 'startDate must be a Saturday');
      if (!isFutureDate(startDate)) return badRequest(res, 'startDate must be in the future');
      if (!Number.isInteger(numberOfGuests) || numberOfGuests < 1) {
        return badRequest(res, 'numberOfGuests must be a whole number of at least 1');
      }

      const result = await checkLiveAvailability(yachtId, startDate, numberOfGuests);
      if (!result) return badRequest(res, 'Unknown yachtId');
      res.json(result);
    } catch (error) {
      serverError(res, 'POST check', error);
    }
  });

  // ---- API-01 ---------------------------------------------------------------------------------
  app.post('/api/v1/charter-enquiries', async (req, res) => {
    try {
      const body = req.body;
      const db = getDatabase();

      const yachtId = typeof body?.yachtId === 'string' ? body.yachtId : '';
      const yacht = YACHT_ID.test(yachtId)
        ? await db.get('SELECT id, name, maxGuests FROM yachts WHERE id = ?', [yachtId])
        : undefined;

      const errors = validateCharterEnquiry(body, yacht?.maxGuests);
      if (!yacht && !errors.some(e => e.field === 'yachtId')) {
        errors.push({ field: 'yachtId', message: 'Unknown yacht' } as any);
      }
      if (errors.length > 0) {
        return badRequest(
          res,
          'Validation failed',
          errors.map(e => ({ field: e.field, message: e.message }))
        );
      }

      const bookingReference = await generateBookingReference();
      const id = uuidv4();
      const endDate = deriveEndDate(body.startDate);
      const submissionTimestamp = new Date().toISOString();
      const clientEmail = sanitizeText(body.clientEmail);
      const clientName = sanitizeText(body.clientName);
      const cruisingArea = body.cruisingArea as string;
      const other = (value: unknown, applies: boolean) => (applies ? sanitizeText(value) || null : null);

      await db.run(
        `INSERT INTO charter_enquiries
         (id, bookingReference, yachtId, clientName, clientEmail, clientPhone, startDate, endDate,
          numberOfAdultGuests, numberOfChildren, cruisingArea, otherCruisingAreaDetails, occasion,
          otherOccasionDetails, specialRequests, privacyConsent, marketingOptIn, submissionTimestamp, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted')`,
        [
          id,
          bookingReference,
          yacht.id,
          clientName,
          clientEmail,
          normalizePhone(body.clientPhone),
          body.startDate,
          endDate,
          body.numberOfAdultGuests,
          body.numberOfChildren,
          cruisingArea,
          other(body.otherCruisingAreaDetails, cruisingArea === 'Other'),
          sanitizeText(body.occasion) || null,
          other(body.otherOccasionDetails, body.occasion === 'Other'),
          sanitizeText(body.specialRequests) || null,
          1,
          body.marketingOptIn === true ? 1 : 0,
          submissionTimestamp
        ]
      );

      const response: CharterEnquiryResponse = {
        bookingReference,
        message: 'Charter enquiry submitted successfully.',
        yachtName: yacht.name,
        startDate: body.startDate,
        endDate
      };
      res.status(201).json(response);

      // After the client has its reference: trigger C2 and send the confirmation email.
      const followUp = (async () => {
        await runC2Trigger(c2Trigger, id, bookingReference);
        try {
          await notify({
            to: clientEmail,
            bookingReference,
            yachtName: yacht.name,
            startDate: body.startDate,
            endDate,
            guests: body.numberOfAdultGuests + body.numberOfChildren,
            cruisingArea: cruisingArea === 'Other' ? sanitizeText(body.otherCruisingAreaDetails) : cruisingArea
          });
        } catch (error) {
          console.error(`[EMAIL] Could not send confirmation for ${bookingReference}:`, error);
        }
      })();
      pending.add(followUp);
      followUp.finally(() => pending.delete(followUp));
    } catch (error) {
      serverError(res, 'POST /api/v1/charter-enquiries', error);
    }
  });

  // ---- Confirmation page data (SCR-02) --------------------------------------------------------
  app.get('/api/charter-enquiries/:reference', async (req, res) => {
    try {
      const { reference } = req.params;
      if (!REFERENCE.test(reference)) return res.status(404).json({ error: 'Enquiry not found' });

      const row = await getDatabase().get(
        `SELECT ce.*, y.name AS yachtName FROM charter_enquiries ce
         JOIN yachts y ON ce.yachtId = y.id WHERE ce.bookingReference = ?`,
        [reference]
      );
      if (!row) return res.status(404).json({ error: 'Enquiry not found' });

      const body: EnquiryConfirmation = {
        bookingReference: row.bookingReference,
        yachtName: row.yachtName,
        startDate: row.startDate,
        endDate: row.endDate,
        dates: formatDateRange(row.startDate, row.endDate),
        guests: row.numberOfAdultGuests + row.numberOfChildren,
        numberOfAdultGuests: row.numberOfAdultGuests,
        numberOfChildren: row.numberOfChildren,
        cruisingArea: row.cruisingArea,
        otherCruisingAreaDetails: row.otherCruisingAreaDetails,
        occasion: row.occasion,
        otherOccasionDetails: row.otherOccasionDetails,
        specialRequests: row.specialRequests,
        status: row.status,
        submissionTimestamp: row.submissionTimestamp
      };
      res.json(body);
    } catch (error) {
      serverError(res, 'GET enquiry', error);
    }
  });

  // ---- API-05 ---------------------------------------------------------------------------------
  app.get('/api/charter-enquiries', requireBroker, async (req, res) => {
    try {
      const db = getDatabase();
      const q = req.query as Record<string, string | undefined>;

      if (q.status && !ENQUIRY_STATUSES.includes(q.status)) return badRequest(res, 'Unknown status filter');
      if (q.yachtId && !YACHT_ID.test(q.yachtId)) return badRequest(res, 'Invalid yachtId filter');
      for (const key of ['dateFrom', 'dateTo'] as const) {
        if (q[key] && !parseISODate(q[key])) return badRequest(res, `${key} must be YYYY-MM-DD`);
      }
      const page = q.page === undefined ? 1 : Number(q.page);
      const pageSize = q.pageSize === undefined ? 10 : Number(q.pageSize);
      if (!Number.isInteger(page) || page < 1) return badRequest(res, 'page must be a positive integer');
      if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
        return badRequest(res, 'pageSize must be between 1 and 100');
      }

      const where: string[] = [];
      const params: unknown[] = [];
      if (q.status) {
        where.push('ce.status = ?');
        params.push(q.status);
      }
      if (q.yachtId) {
        where.push('ce.yachtId = ?');
        params.push(q.yachtId);
      }
      if (q.dateFrom) {
        where.push('ce.submissionTimestamp >= ?');
        params.push(`${q.dateFrom}T00:00:00.000Z`);
      }
      if (q.dateTo) {
        where.push('ce.submissionTimestamp < ?');
        params.push(`${addDays(q.dateTo, 1)}T00:00:00.000Z`);
      }
      const search = q.search?.trim();
      if (search) {
        const like = `%${search.replace(/[\\%_]/g, m => `\\${m}`)}%`;
        where.push(
          "(ce.clientName LIKE ? ESCAPE '\\' OR y.name LIKE ? ESCAPE '\\' OR ce.bookingReference LIKE ? ESCAPE '\\')"
        );
        params.push(like, like, like);
      }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const from = 'FROM charter_enquiries ce JOIN yachts y ON ce.yachtId = y.id';

      const todayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`;
      const stats = await db.get(
        `SELECT COUNT(*) AS total,
                COALESCE(SUM(ce.submissionTimestamp >= ?), 0) AS today,
                COALESCE(SUM(ce.status = 'Available'), 0) AS available,
                COALESCE(SUM(ce.status IN ('Booked', 'CapacityExceeded')), 0) AS unavailable
         ${from} ${whereSql}`,
        [todayStart, ...params]
      );

      const rows = await db.all(
        `SELECT ce.*, y.name AS yachtName ${from} ${whereSql}
         ORDER BY ce.submissionTimestamp DESC, ce.bookingReference DESC LIMIT ? OFFSET ?`,
        [...params, pageSize, (page - 1) * pageSize]
      );

      const response: BrokerEnquiryListResponse = {
        total: stats.total,
        kpis: {
          today: stats.today,
          available: stats.available,
          unavailable: stats.unavailable,
          percentAvailable: stats.total ? Math.round((stats.available / stats.total) * 100) : 0
        },
        enquiries: rows.map((e: any) => ({
          reference: e.bookingReference,
          clientName: e.clientName,
          yachtName: e.yachtName,
          startDate: e.startDate,
          endDate: e.endDate,
          guests: e.numberOfAdultGuests + e.numberOfChildren,
          status: e.status,
          receivedDate: e.submissionTimestamp
        }))
      };
      res.json(response);
    } catch (error) {
      serverError(res, 'GET /api/charter-enquiries', error);
    }
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve the built front end (npm run build) from the same origin, if present.
  const staticDir = path.resolve(process.cwd(), 'dist/frontend');
  if (fs.existsSync(path.join(staticDir, 'index.html'))) {
    app.use(express.static(staticDir));
    app.get('*', (_req, res) => res.sendFile(path.join(staticDir, 'index.html')));
  } else {
    app.get('*', (_req, res) =>
      res
        .status(503)
        .type('text/plain')
        .send(
          'The front end has not been built. Run "npm run build" and restart, ' +
            'or use "npm run dev" and open http://localhost:5173.'
        )
    );
  }

  // Malformed JSON and other body-parser failures are client errors.
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (error?.type === 'entity.parse.failed' || error?.type === 'entity.too.large') {
      return res.status(400).json({ error: 'Invalid request body' });
    }
    console.error('[API] Unhandled error:', error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again later.' });
  });

  /** Resolves once background work (C2 trigger, confirmation email) for submitted enquiries is done. */
  const flush = async () => {
    while (pending.size) await Promise.all([...pending]);
  };

  return { app, flush };
}
