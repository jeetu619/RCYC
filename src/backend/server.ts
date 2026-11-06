import express from 'express';
import { initializeDatabase } from './database';
import { getDatabase } from './database';
import { validateCharterEnquiry } from '../shared/validators';
import { generateBookingReference } from './services/bookingReferenceService';
import { getYachtAvailability, checkLiveAvailability } from './services/availabilityService';
import { v4 as uuidv4 } from 'uuid';
import { createServer } from 'net';
import type { CharterEnquiry, BrokerEnquiryListResponse } from '../shared/types';

const app = express();
app.use(express.json());

const MOCK_AUTH_TOKEN = 'broker-token-123';

function authenticateBroker(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${MOCK_AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/yachts', async (req, res) => {
  try {
    const db = getDatabase();
    const yachts = await db.all('SELECT * FROM yachts');
    res.json(yachts);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/yachts/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing from or to parameters' });
    }

    const db = getDatabase();
    const yacht = await db.get('SELECT id FROM yachts WHERE id = ?', [id]);
    if (!yacht) {
      return res.status(404).json({ error: 'Yacht not found' });
    }

    const availability = await getYachtAvailability(id, from as string, to as string);
    res.json(availability);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/charter-enquiries/check', async (req, res) => {
  try {
    const { yachtId, startDate, numberOfGuests } = req.body;

    if (!yachtId || !startDate || numberOfGuests === undefined) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await checkLiveAvailability(yachtId, startDate, numberOfGuests);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/v1/charter-enquiries', async (req, res) => {
  try {
    const enquiry = req.body;

    const validationErrors = validateCharterEnquiry(enquiry);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationErrors.map(e => ({ field: e.field, message: e.message }))
      });
    }

    const db = getDatabase();
    const yacht = await db.get('SELECT maxGuests FROM yachts WHERE id = ?', [enquiry.yachtId]);
    if (!yacht) {
      return res.status(400).json({ error: 'Yacht not found' });
    }

    const totalGuests = enquiry.numberOfAdultGuests + enquiry.numberOfChildren;
    if (totalGuests > yacht.maxGuests) {
      return res.status(400).json({ error: 'Guest count exceeds yacht capacity' });
    }

    const bookingReference = await generateBookingReference();
    const endDate = new Date(enquiry.startDate + 'T00:00:00Z');
    endDate.setUTCDate(endDate.getUTCDate() + 7);
    const endDateStr = endDate.toISOString().split('T')[0];

    const newEnquiry: CharterEnquiry = {
      id: uuidv4(),
      bookingReference,
      yachtId: enquiry.yachtId,
      clientName: enquiry.clientName,
      clientEmail: enquiry.clientEmail,
      clientPhone: enquiry.clientPhone,
      startDate: enquiry.startDate,
      endDate: endDateStr,
      numberOfAdultGuests: enquiry.numberOfAdultGuests,
      numberOfChildren: enquiry.numberOfChildren,
      cruisingArea: enquiry.cruisingArea,
      otherCruisingAreaDetails: enquiry.otherCruisingAreaDetails,
      occasion: enquiry.occasion,
      otherOccasionDetails: enquiry.otherOccasionDetails,
      specialRequests: enquiry.specialRequests,
      privacyConsent: enquiry.privacyConsent,
      marketingOptIn: enquiry.marketingOptIn || false,
      submissionTimestamp: new Date().toISOString(),
      status: 'Submitted'
    };

    await db.run(
      `INSERT INTO charter_enquiries
       (id, bookingReference, yachtId, clientName, clientEmail, clientPhone, startDate, endDate,
        numberOfAdultGuests, numberOfChildren, cruisingArea, otherCruisingAreaDetails, occasion,
        otherOccasionDetails, specialRequests, privacyConsent, marketingOptIn, submissionTimestamp, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newEnquiry.id,
        newEnquiry.bookingReference,
        newEnquiry.yachtId,
        newEnquiry.clientName,
        newEnquiry.clientEmail,
        newEnquiry.clientPhone,
        newEnquiry.startDate,
        newEnquiry.endDate,
        newEnquiry.numberOfAdultGuests,
        newEnquiry.numberOfChildren,
        newEnquiry.cruisingArea,
        newEnquiry.otherCruisingAreaDetails,
        newEnquiry.occasion,
        newEnquiry.otherOccasionDetails,
        newEnquiry.specialRequests,
        newEnquiry.privacyConsent ? 1 : 0,
        newEnquiry.marketingOptIn ? 1 : 0,
        newEnquiry.submissionTimestamp,
        newEnquiry.status
      ]
    );

    const yachtName = await db.get('SELECT name FROM yachts WHERE id = ?', [enquiry.yachtId]);

    res.status(201).json({
      bookingReference,
      message: 'Charter enquiry submitted successfully.',
      yachtName: yachtName.name,
      startDate: enquiry.startDate,
      endDate: endDateStr
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/charter-enquiries/:reference', async (req, res) => {
  try {
    const { reference } = req.params;
    const db = getDatabase();

    const enquiry = await db.get(
      'SELECT ce.*, y.name as yachtName FROM charter_enquiries ce JOIN yachts y ON ce.yachtId = y.id WHERE ce.bookingReference = ?',
      [reference]
    );

    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    res.json({
      ...enquiry,
      privacyConsent: Boolean(enquiry.privacyConsent),
      marketingOptIn: Boolean(enquiry.marketingOptIn),
      guests: enquiry.numberOfAdultGuests + enquiry.numberOfChildren,
      dates: `Sat ${new Date(enquiry.startDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – Sat ${new Date(enquiry.endDate + 'T00:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${new Date(enquiry.endDate + 'T00:00:00Z').getUTCFullYear()} · 7 nights`
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/charter-enquiries', authenticateBroker, async (req, res) => {
  try {
    const db = getDatabase();
    const {
      status,
      yachtId,
      dateFrom,
      dateTo,
      search,
      page = '1',
      pageSize = '10'
    } = req.query;

    let query = 'SELECT ce.*, y.name as yachtName FROM charter_enquiries ce JOIN yachts y ON ce.yachtId = y.id WHERE 1=1';
    const params: any[] = [];

    if (status) {
      query += ' AND ce.status = ?';
      params.push(status);
    }
    if (yachtId) {
      query += ' AND ce.yachtId = ?';
      params.push(yachtId);
    }
    if (dateFrom) {
      query += ' AND ce.submissionTimestamp >= ?';
      params.push(dateFrom + 'T00:00:00Z');
    }
    if (dateTo) {
      query += ' AND ce.submissionTimestamp < ?';
      params.push(dateTo + 'T23:59:59Z');
    }
    if (search) {
      query += ' AND (ce.clientName LIKE ? OR y.name LIKE ? OR ce.bookingReference LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY ce.submissionTimestamp DESC';

    const pageNum = parseInt(page as string, 10) || 1;
    const pageSizeNum = parseInt(pageSize as string, 10) || 10;
    const offset = (pageNum - 1) * pageSizeNum;

    query += ' LIMIT ? OFFSET ?';
    params.push(pageSizeNum, offset);

    const enquiries = await db.all(query, params);

    const countQuery = 'SELECT COUNT(*) as count FROM charter_enquiries WHERE 1=1' +
      (status ? ' AND status = ?' : '') +
      (yachtId ? ' AND yachtId = ?' : '') +
      (dateFrom ? ' AND submissionTimestamp >= ?' : '') +
      (dateTo ? ' AND submissionTimestamp < ?' : '') +
      (search ? ' AND (clientName LIKE ? OR EXISTS (SELECT 1 FROM yachts WHERE charter_enquiries.yachtId = yachts.id AND yachts.name LIKE ?) OR bookingReference LIKE ?)' : '');

    const countParams = [...params];
    countParams.pop();
    countParams.pop();

    const countResult = await db.get(countQuery, countParams);
    const total = countResult.count;

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const todayStr = today.toISOString();
    const tomorrowStr = new Date(today.getTime() + 86400000).toISOString();

    const todayEnquiries = await db.get(
      'SELECT COUNT(*) as count FROM charter_enquiries WHERE submissionTimestamp >= ? AND submissionTimestamp < ?',
      [todayStr, tomorrowStr]
    );

    const availableEnquiries = await db.get(
      'SELECT COUNT(*) as count FROM charter_enquiries WHERE status IN (?, ?)',
      ['Submitted', 'Available']
    );

    const unavailableEnquiries = await db.get(
      'SELECT COUNT(*) as count FROM charter_enquiries WHERE status IN (?, ?)',
      ['Booked', 'CapacityExceeded']
    );

    const totalStatusEnquiries = total || 1;
    const percentAvailable = Math.round((availableEnquiries.count / totalStatusEnquiries) * 100);

    const response: BrokerEnquiryListResponse = {
      total,
      kpis: {
        today: todayEnquiries.count,
        available: availableEnquiries.count,
        unavailable: unavailableEnquiries.count,
        percentAvailable
      },
      enquiries: enquiries.map((e: any) => ({
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
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  const maxAttempts = 100;

  for (let i = 0; i < maxAttempts; i++) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }

  throw new Error(`Could not find available port after ${maxAttempts} attempts starting from port ${startPort}`);
}

async function start() {
  try {
    await initializeDatabase();
    const preferredPort = 3000;
    const port = await findAvailablePort(preferredPort);

    const server = app.listen(port, '127.0.0.1', () => {
      if (port !== preferredPort) {
        console.log(`Port ${preferredPort} is in use. Charter enquiry server running on http://localhost:${port}`);
      } else {
        console.log(`Charter enquiry server running on http://localhost:${port}`);
      }
    });
    server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();
