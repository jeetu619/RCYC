# Charter Enquiry System

A comprehensive web-based charter enquiry system with client-facing multi-step form and broker-facing dashboard for managing submitted enquiries.

## Quick Start

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

This starts both backend (http://localhost:3000) and frontend (http://localhost:5173) concurrently.

### Testing

```bash
npm run test              # Run all tests
npm run test:backend      # Backend tests only
npm run test:watch        # Watch mode
```

## Features

### Client Charter Enquiry Experience ✅

- **Multi-Step Form**: 3-step guided wizard with progress tracking
- **Yacht Selection**: Interactive yacht cards with key details
- **Date Selection**: Saturday-only calendar with live availability
- **Guest Management**: Stepper controls with capacity validation
- **Cruising Details**: Area and occasion selection
- **Special Requests**: Optional notes textarea
- **Live Validation**: Real-time feedback as users fill the form
- **Live Availability**: 400ms debounced API checks
- **Indicative Pricing**: Dynamic calculation based on selected yacht
- **Alternative Suggestions**: Up to 3 alternatives when unavailable
- **Form Persistence**: Browser localStorage saves draft data across page refreshes
- **Confirmation Page**: Shows booking reference and next steps

### Broker Enquiry Management Dashboard ✅

- **Enquiry List**: Table view of all submitted enquiries
- **Search & Filter**: By client name, yacht, reference, status, date range
- **KPI Tiles**: Today's enquiries, Available, Unavailable, % Available
- **Pagination**: 10 enquiries per page
- **Sorting**: By received date
- **Status Tracking**: Shows enquiry status (Submitted, Available, OnHold, Booked, etc.)

## Project Structure

```
charter-enquiry-system/
├── src/
│   ├── backend/              # Express.js backend
│   │   ├── server.ts        # Main server
│   │   ├── database.ts      # SQLite setup
│   │   ├── services/        # Business logic
│   │   │   ├── bookingReferenceService.ts
│   │   │   └── availabilityService.ts
│   │   └── __tests__/       # Tests
│   │
│   ├── frontend/            # React frontend
│   │   ├── index.tsx        # Entry point
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable components
│   │   ├── hooks/           # Custom React hooks
│   │   ├── api/             # API client
│   │   └── styles/          # CSS modules
│   │
│   └── shared/              # Shared code
│       ├── types.ts         # TypeScript interfaces
│       └── validators.ts    # Form validators
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── vite.config.ts
```

## API Endpoints

### Public Endpoints

- `GET /api/yachts` - List all yachts
- `GET /api/yachts/:id/availability` - Get yacht availability
- `POST /api/charter-enquiries/check` - Live availability check
- `POST /api/v1/charter-enquiries` - Submit charter enquiry
- `GET /api/charter-enquiries/:reference` - Get enquiry confirmation details

### Broker Endpoints (Authentication Required)

- `GET /api/charter-enquiries` - List enquiries with filters

## Acceptance Criteria Status

### Requirement 10020: Multi-Step Enquiry Form ✅
- [x] 3-step form with progress indicator
- [x] Form data persisted to browser storage
- [x] Auto-calculated 7-day end date
- [x] Guest count validation against yacht capacity
- [x] Submit button disabled until enquiry is valid and complete

### Requirement 10021: Yacht Selection ✅
- [x] Interactive yacht cards with availability/capacity context
- [x] Selected yacht name displayed
- [x] Live validation on yacht selection
- [x] Capacity shown for selected yacht
- [x] Indicative pricing updates on yacht change

### Requirement 10022: Cruising Area & Occasion ✅
- [x] Cruising area selection with "Other" option
- [x] Occasion selection with "Other" option
- [x] Values retained through completion
- [x] Validation on required fields
- [x] Browser storage persistence

### Requirement 10023: Special Requests ✅
- [x] Optional textarea for special requests
- [x] Max 500 characters enforced
- [x] Data persisted through form completion
- [x] Included in submitted enquiry record

### Requirement 10024: Saturday Start Date ✅
- [x] Calendar only shows Saturdays
- [x] Auto-sets end date 7 days later
- [x] Saturday-only validation enforced
- [x] Persistence across form steps

### Requirement 10025: Guest Count Adjustment ✅
- [x] Stepper controls for adults and children
- [x] Live feedback on total vs capacity
- [x] Capacity limits enforced
- [x] Submission blocked when over capacity

### Requirement 10026: Capacity Validation ✅
- [x] Total guests cannot exceed yacht maxGuests
- [x] Live validation feedback shown
- [x] Submission prevented when over capacity
- [x] Clear error messaging

### Requirement 10027: Live Feedback ✅
- [x] Availability status displayed
- [x] Capacity validation shown
- [x] Indicative pricing shown
- [x] Suggested alternatives displayed

### Requirement 10028: Live Availability Status ✅
- [x] Real-time availability checking
- [x] Status badges (Available, OnHold, Booked, etc.)
- [x] Submit button gating based on availability
- [x] Alternative suggestions when unavailable

### Requirement 10029: Capacity Validation Feedback ✅
- [x] Shows current vs max guests
- [x] Prevents submission when over capacity
- [x] Actionable error guidance

### Requirement 10030: Indicative Pricing ✅
- [x] Shows charter fee, VAT (12%), APA (30%)
- [x] Shows total and 50% deposit
- [x] Updates on yacht/date changes
- [x] Formatted currency display

### Requirement 10031: Alternative Suggestions ✅
- [x] Shows up to 3 alternatives
- [x] Alternatives appear when unavailable/over capacity
- [x] Quick apply buttons for alternatives
- [x] Form updates when alternative selected

### Requirement 10032: Submission Only When Valid ✅
- [x] Submit button disabled until all validations pass
- [x] All required fields must be complete
- [x] Availability check must pass
- [x] Privacy consent must be checked

### Requirement 10033: Form Persistence ✅
- [x] In-progress data saved to localStorage
- [x] Survives page refresh
- [x] Restored on page reload
- [x] Cleared on successful submission

### Requirement 10034: Client & Server Validation ✅
- [x] Client-side immediate feedback
- [x] Server-side validation before creation
- [x] Saturday-only enforcement
- [x] Guest capacity limits
- [x] Submission gating

### Requirement 10035: Unique Booking Reference ✅
- [x] Format: ENQ-YYYY-NNNN
- [x] Generated on submission
- [x] Guaranteed unique
- [x] Database constraints prevent duplicates

### Requirement 10036: Confirmation Page ✅
- [x] Shows booking reference
- [x] Displays enquiry summary
- [x] Shows next steps timeline
- [x] Add to calendar and print buttons

### Requirement 10037: Broker Dashboard ✅
- [x] Displays submitted enquiries in table
- [x] Search and filter capabilities
- [x] KPI tiles (today, available, unavailable, % available)
- [x] Pagination

### Requirement 10038: Broker Monitoring ✅
- [x] Real-time enquiry list view
- [x] Status indicators
- [x] Performance summaries (KPIs)

### Requirement 10039: Broker Filtering ✅
- [x] Filter by status
- [x] Filter by yacht
- [x] Filter by date range
- [x] Search by client name/reference

## Data Models

### Yacht
- id, name, lengthMeters, cabins, maxGuests, weeklyRateEuro, photoUrl

### CharterEnquiry
- id, bookingReference, yachtId, clientName, clientEmail, clientPhone
- startDate, endDate, numberOfAdultGuests, numberOfChildren
- cruisingArea, otherCruisingAreaDetails, occasion, otherOccasionDetails
- specialRequests, privacyConsent, marketingOptIn
- submissionTimestamp, status

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite
- **Backend**: Express, TypeScript, Node.js
- **Database**: SQLite (development)
- **Testing**: Jest, React Testing Library
- **Styling**: CSS Grid, Flexbox, mobile-responsive

## Browser Compatibility

Modern browsers with ES2020+ support:
- Chrome/Chromium 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance

- **Form validation**: < 100ms
- **Availability checks**: < 1 second (90th percentile)
- **Submission**: < 1 second (95th percentile)
- **Mobile optimized**: Responsive design with sticky pricing bar

## Security

- HTTPS ready (use in production)
- Client-side validation + server-side validation
- No sensitive data in localStorage
- Bearer token auth for broker endpoints
- Input sanitization on all fields

## Environment Variables

See `.env.example` for available configurations.

## For More Information

See [IMPLEMENTATION.md](./IMPLEMENTATION.md) for detailed technical documentation.
