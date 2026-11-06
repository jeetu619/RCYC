# Charter Enquiry System - Implementation Guide

## Project Overview

This is a full-stack implementation of a charter booking enquiry system with:

- **Client-Facing**: Multi-step wizard form for submitting charter enquiries
- **Broker Dashboard**: Dashboard for managing and monitoring submitted enquiries
- **Backend APIs**: 5 REST endpoints for client and broker operations
- **Database**: SQLite with schema for yachts and charter enquiries

## Architecture

### Frontend (React + TypeScript + Vite)

- **Location**: `/src/frontend/`
- **Routes**:
  - `/charter/enquiry` - Multi-step enquiry form
  - `/charter/enquiry/:reference` - Confirmation page
  - `/broker/enquiries` - Broker dashboard

**Key Features**:
- 3-step wizard with progress tracking
- Browser local storage persistence
- Live availability checking (400ms debounce)
- Indicative pricing calculation
- Alternative suggestions
- Real-time validation

### Backend (Express + TypeScript)

- **Location**: `/src/backend/`
- **Database**: SQLite with tables for yachts and charter enquiries

**API Endpoints**:
1. `GET /api/yachts` - List all yachts
2. `GET /api/yachts/:id/availability?from=&to=` - Get yacht availability for date range
3. `POST /api/charter-enquiries/check` - Live availability check
4. `POST /api/v1/charter-enquiries` - Submit charter enquiry
5. `GET /api/charter-enquiries` - Get enquiries (broker, requires auth)
6. `GET /api/charter-enquiries/:reference` - Get specific enquiry details

### Shared

- **Location**: `/src/shared/`
- **types.ts**: Shared TypeScript interfaces
- **validators.ts**: Form and data validation

## Running the Application

### Prerequisites

```bash
npm install
```

### Development

Run both frontend and backend concurrently:

```bash
npm run dev
```

Or individually:

```bash
npm run dev:backend    # Starts on http://localhost:3000
npm run dev:frontend   # Starts on http://localhost:5173
```

### Testing

```bash
npm run test           # Run all tests
npm run test:backend   # Run backend tests only
npm run test:watch     # Watch mode
```

### Building

```bash
npm run build          # Build both frontend and backend
```

## Key Features Implementation

### 1. Multi-Step Form with State Persistence

The form uses React hooks to manage state across 3 steps:
1. **Step 1**: Yacht selection + date picking (Saturday only)
2. **Step 2**: Guest count + cruising area + occasion + special requests
3. **Step 3**: Client details + privacy consent + review

State is persisted to browser `localStorage` after each step, allowing recovery on page refresh.

**Files**:
- `src/frontend/hooks/useEnquiryForm.ts` - State management
- `src/frontend/components/EnquiryForm.tsx` - Main form logic

### 2. Live Availability Checking

When a yacht, date, and guest count are selected, the system:
1. Waits 400ms after the last input change (debounce)
2. Calls `POST /api/charter-enquiries/check` endpoint
3. Receives availability status and alternative suggestions
4. Updates UI with status badge and alternatives

**Files**:
- `src/frontend/hooks/useLiveAvailability.ts` - Availability logic
- `src/backend/services/availabilityService.ts` - Backend logic

### 3. Booking Reference Generation

Format: `ENQ-YYYY-NNNN` where NNNN is sequential per year

- Database stores year + counter
- Uses atomic increment to prevent duplicates
- Generated on successful enquiry submission

**Files**:
- `src/backend/services/bookingReferenceService.ts`

### 4. Indicative Pricing

Calculations (all based on yacht weekly rate):
- **VAT**: 12% of weekly rate
- **APA**: 30% of weekly rate
- **Total**: weekly rate + VAT + APA
- **Deposit**: 50% of Total

**Files**:
- `src/frontend/components/PricingSummary.tsx`

### 5. Form Validation

**Client-Side** (immediate feedback):
- Required field validation
- Email format validation
- Phone format validation (E.164)
- Saturday-only date selection
- Guest capacity limits

**Server-Side** (on submission):
- All validations repeated
- Prevents invalid data storage

**Files**:
- `src/shared/validators.ts`

### 6. Broker Dashboard

Features:
- View all submitted enquiries in a table
- KPI tiles: Today's enquiries, Available, Unavailable, % Available
- Filter by status, yacht, date range
- Search by client name, yacht name, reference
- Pagination (10 enquiries per page)

**Files**:
- `src/frontend/pages/BrokerDashboardPage.tsx`

**Authentication**: Uses bearer token `broker-token-123` (demo)

## Database Schema

### Yachts Table
```sql
CREATE TABLE yachts (
  id TEXT PRIMARY KEY,
  name TEXT,
  lengthMeters REAL,
  cabins INTEGER,
  maxGuests INTEGER,
  weeklyRateEuro REAL,
  photoUrl TEXT
)
```

### Charter Enquiries Table
```sql
CREATE TABLE charter_enquiries (
  id TEXT PRIMARY KEY,
  bookingReference TEXT UNIQUE,
  yachtId TEXT,
  clientName TEXT,
  clientEmail TEXT,
  clientPhone TEXT,
  startDate TEXT,
  endDate TEXT,
  numberOfAdultGuests INTEGER,
  numberOfChildren INTEGER,
  cruisingArea TEXT,
  otherCruisingAreaDetails TEXT,
  occasion TEXT,
  otherOccasionDetails TEXT,
  specialRequests TEXT,
  privacyConsent BOOLEAN,
  marketingOptIn BOOLEAN,
  submissionTimestamp TEXT,
  status TEXT,
  FOREIGN KEY (yachtId) REFERENCES yachts(id)
)
```

### Booking Reference Counters Table
```sql
CREATE TABLE booking_reference_counters (
  year INTEGER PRIMARY KEY,
  counter INTEGER
)
```

## Demo Data

Two demo yachts are seeded into the database:

1. **Sea Lark** (yacht-sea-lark)
   - 25m, 5 cabins, 10 guests max
   - €65,000/week

2. **Calliope** (yacht-calliope)
   - 20m, 4 cabins, 8 guests max
   - €29,500/week

## Testing

### Unit Tests

**Validators** (`src/backend/__tests__/validators.test.ts`):
- Email validation
- Phone validation
- Saturday date validation
- Form field validation
- Charter enquiry validation

**Booking Reference** (`src/backend/__tests__/bookingReference.test.ts`):
- Reference format
- Uniqueness
- Sequential incrementing

### How to Run Tests

```bash
npm run test
npm run test:backend
npm run test:watch
```

## Error Handling

### Client Errors
- Inline validation messages on form fields
- Summary error messages at step level
- Toast-style error for API failures

### Server Errors
- 400 Bad Request for validation failures
- 401 Unauthorized for broker endpoints without proper auth
- 404 Not Found for non-existent resources
- 500 Internal Server Error for unexpected failures

## Browser Support

Modern browsers (Chrome, Firefox, Safari, Edge) with ES2020+ support.

- CSS Grid and Flexbox
- LocalStorage API
- Fetch API
- Dynamic imports

## Performance Considerations

### Frontend
- Lazy-loaded components via React Router
- Debounced availability checks (400ms)
- Sticky pricing summary on desktop
- Mobile-optimized layout

### Backend
- Database indexes on commonly filtered columns
- Atomic operations for booking reference generation
- Pagination for large enquiry lists

## Future Enhancements

- Email notifications on enquiry submission
- Real availability integration with C2 API
- Quote generation and management
- Payment processing integration
- E-signature support
- Multi-language support
- Dark mode
- Advanced analytics

## Troubleshooting

### Port Already in Use
If port 3000 or 5173 is already in use, the application will fail to start.
Kill the process or use different ports:

```bash
PORT=3001 npm run dev:backend
```

### Database Locked
SQLite may lock the database if multiple processes try to write simultaneously.
Ensure only one server instance is running.

### Form State Not Persisting
Check browser's LocalStorage is enabled and not full.
Clear browser cache/storage if corrupted data remains.

## Deployment

### Production Build
```bash
npm run build
```

Outputs:
- Frontend: `dist/frontend/` (static files for CDN/nginx)
- Backend: `dist/backend/` (Node.js application)

### Environment Setup
Copy `.env.example` to `.env` and configure:
- Database path
- Backend port
- Frontend API base

### Running in Production
```bash
NODE_ENV=production node dist/backend/server.js
```

Frontend static files should be served by a web server (nginx, Apache, CDN).
