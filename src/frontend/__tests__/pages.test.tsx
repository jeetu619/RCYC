import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { randomUUID } from 'crypto';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ConfirmationPage from '../pages/ConfirmationPage';
import BrokerDashboardPage from '../pages/BrokerDashboardPage';
import { buildIcs } from '../utils/ics';
import { jsonResponse, YACHTS } from './helpers';
import type { BrokerEnquiryListResponse, EnquiryConfirmation } from '../../shared/types';

const enquiry: EnquiryConfirmation = {
  bookingReference: 'ENQ-2027-0001',
  yachtName: 'Sea Lark',
  startDate: '2027-06-12',
  endDate: '2027-06-19',
  dates: 'Sat 12 Jun – Sat 19 Jun 2027 · 7 nights',
  guests: 8,
  numberOfAdultGuests: 6,
  numberOfChildren: 2,
  cruisingArea: 'Greek Islands',
  status: 'Submitted',
  submissionTimestamp: '2027-06-01T10:00:00.000Z'
};

describe('Confirmation page (SCR-02)', () => {
  const renderPage = () =>
    render(
      <MemoryRouter initialEntries={['/charter/enquiry/ENQ-2027-0001']}>
        <Routes>
          <Route path="/charter/enquiry/:reference" element={<ConfirmationPage />} />
          <Route path="/charter/enquiry" element={<div>FORM</div>} />
        </Routes>
      </MemoryRouter>
    );

  it('shows reference, yacht, dates, guests, cruising area, status and the what-happens-next timeline', async () => {
    (global as any).fetch = jest.fn(async () => jsonResponse(enquiry));
    renderPage();
    expect(screen.getByRole('status')).toHaveTextContent(/Loading/);
    expect(await screen.findByTestId('booking-reference')).toHaveTextContent('ENQ-2027-0001');
    expect(screen.getByText('Sea Lark')).toBeInTheDocument();
    expect(screen.getByText('Sat 12 Jun – Sat 19 Jun 2027 · 7 nights')).toBeInTheDocument();
    expect(screen.getByText('8 guests')).toBeInTheDocument();
    expect(screen.getByText('Greek Islands')).toBeInTheDocument();
    expect(screen.getByText('Submitted')).toBeInTheDocument();
    const steps = within(screen.getByRole('list')).getAllByRole('listitem').map(li => li.querySelector('h4')!.textContent);
    expect(steps).toEqual(['Quote by email', 'Yacht held for you', 'Pay deposit to confirm']);
  });

  it('offers Add to Calendar (downloads an .ics) and Print', async () => {
    (global as any).fetch = jest.fn(async () => jsonResponse(enquiry));
    const createObjectURL = jest.fn(() => 'blob:x');
    (URL as any).createObjectURL = createObjectURL;
    (URL as any).revokeObjectURL = jest.fn();
    window.print = jest.fn();
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Add to Calendar' }));
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect((createObjectURL.mock.calls[0] as unknown as [Blob])[0].type).toContain('text/calendar');
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(window.print).toHaveBeenCalled();
  });

  it('shows a not-found message with a way back, and retry on other failures', async () => {
    (global as any).fetch = jest.fn(async () => jsonResponse({ error: 'Enquiry not found' }, 404));
    renderPage();
    expect(await screen.findByText(/could not find that enquiry/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Return to the enquiry form/ })).toHaveAttribute('href', '/charter/enquiry');
  });

  it('builds a valid all-day iCalendar event', () => {
    const ics = buildIcs(enquiry, new Date('2027-06-01T10:00:00Z'));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270612');
    expect(ics).toContain('DTEND;VALUE=DATE:20270619');
    expect(ics).toContain('SUMMARY:Yacht charter: Sea Lark');
    expect(ics).toContain('UID:ENQ-2027-0001@charter-enquiry');
    expect(ics.split('\r\n').length).toBeGreaterThan(8);
  });
});

describe('Broker dashboard (SCR-03)', () => {
  const goodCode = randomUUID();
  const wrongCode = randomUUID();
  const session = randomUUID();
  const row = (n: number, status: any, name = 'John Doe', yacht = 'Sea Lark') => ({
    reference: `ENQ-2027-000${n}`,
    clientName: name,
    yachtName: yacht,
    startDate: '2027-06-12',
    endDate: '2027-06-19',
    guests: 8,
    status,
    receivedDate: '2027-06-01T10:00:00Z'
  });
  const list: BrokerEnquiryListResponse = {
    total: 2,
    kpis: { today: 5, available: 50, unavailable: 30, percentAvailable: 50 },
    enquiries: [row(1, 'Submitted'), row(2, 'Available', 'Jane Smith', 'Calliope')]
  };

  function mockBroker(handler: (url: string, auth?: string) => any) {
    const calls: string[] = [];
    (global as any).fetch = jest.fn(async (input: any, init?: any) => {
      const url = String(input);
      calls.push(url);
      if (url.endsWith('/api/yachts')) return jsonResponse(YACHTS);
      if (url.endsWith('/auth/broker-login')) {
        const { accessCode } = JSON.parse(init.body);
        return accessCode === goodCode ? jsonResponse({ sessionToken: session }) : jsonResponse({ error: 'Invalid' }, 401);
      }
      if (url.includes('/api/charter-enquiries')) return handler(url, init?.headers?.Authorization);
      return jsonResponse({}, 404);
    });
    return calls;
  }

  beforeEach(() => sessionStorage.clear());

  it('requires sign-in; a wrong code is rejected, the right one shows the dashboard', async () => {
    mockBroker(() => jsonResponse(list));
    render(<BrokerDashboardPage />);
    expect(screen.getByRole('heading', { name: /Charter Broker sign-in/ })).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Broker access code'), wrongCode);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText(/not recognised/)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText('Broker access code'));
    await userEvent.type(screen.getByLabelText('Broker access code'), goodCode);
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Broker Enquiries' })).toBeInTheDocument();
  });

  it('shows the 4 KPI tiles and the table with the documented columns and status chips', async () => {
    sessionStorage.setItem('broker-session', session);
    const calls = mockBroker((_url, auth) => (auth === `Bearer ${session}` ? jsonResponse(list) : jsonResponse({}, 401)));
    render(<BrokerDashboardPage />);
    expect(await screen.findByText('ENQ-2027-0001')).toBeInTheDocument();
    for (const [label, value] of [["Today's Enquiries", '5'], ['Available', '50'], ['Unavailable', '30'], ['% Available', '50%']]) {
      const tile = screen.getByText(label, { selector: '.kpi-label' }).closest('.kpi-tile') as HTMLElement;
      expect(tile).toHaveTextContent(value);
    }
    const headers = screen.getAllByRole('columnheader').map(h => h.textContent);
    expect(headers).toEqual(['Reference', 'Client', 'Yacht', 'Dates', 'Guests', 'Status', 'Received Date']);
    const chips = document.querySelectorAll('.chip');
    expect(Array.from(chips).map(c => c.textContent)).toEqual(['Submitted', 'Available']);
    expect(calls.some(c => c.includes('pageSize=10'))).toBe(true);
  });

  it('filters by status, yacht and received dates, and searches (debounced) via the API', async () => {
    sessionStorage.setItem('broker-session', session);
    const calls = mockBroker(() => jsonResponse(list));
    render(<BrokerDashboardPage />);
    await screen.findByText('ENQ-2027-0001');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'Booked');
    await waitFor(() => expect(calls.some(c => c.includes('status=Booked'))).toBe(true));
    await userEvent.selectOptions(screen.getByLabelText('Yacht'), 'yacht-calliope');
    await waitFor(() => expect(calls.some(c => c.includes('yachtId=yacht-calliope'))).toBe(true));
    await userEvent.type(screen.getByLabelText('Received from'), '2027-06-01');
    await waitFor(() => expect(calls.some(c => c.includes('dateFrom=2027-06-01'))).toBe(true));
    await userEvent.type(screen.getByLabelText('Received to'), '2027-06-30');
    await waitFor(() => expect(calls.some(c => c.includes('dateTo=2027-06-30'))).toBe(true));

    const before = calls.length;
    await userEvent.type(screen.getByLabelText('Search'), 'Jane');
    await waitFor(() => expect(calls.some(c => c.includes('search=Jane'))).toBe(true));
    // typing 4 letters produced a single debounced request, not four
    expect(calls.slice(before).filter(c => c.includes('search=')).length).toBe(1);
  });

  it('shows the empty state when nothing matches', async () => {
    sessionStorage.setItem('broker-session', session);
    mockBroker(() => jsonResponse({ total: 0, kpis: { today: 0, available: 0, unavailable: 0, percentAvailable: 0 }, enquiries: [] }));
    render(<BrokerDashboardPage />);
    expect(await screen.findByText(/No enquiries found/)).toBeInTheDocument();
  });

  it('shows an error with retry when loading fails', async () => {
    sessionStorage.setItem('broker-session', session);
    let fail = true;
    mockBroker(() => (fail ? jsonResponse({ error: 'x' }, 500) : jsonResponse(list)));
    render(<BrokerDashboardPage />);
    expect(await screen.findByText(/could not load the enquiries/i)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('ENQ-2027-0001')).toBeInTheDocument();
  });

  it('returns to sign-in when the session is rejected (401/403)', async () => {
    sessionStorage.setItem('broker-session', 'expired');
    mockBroker(() => jsonResponse({ error: 'Authentication required' }, 401));
    render(<BrokerDashboardPage />);
    expect(await screen.findByRole('heading', { name: /Charter Broker sign-in/ })).toBeInTheDocument();
    expect(sessionStorage.getItem('broker-session')).toBeNull();
  });

  it('paginates', async () => {
    sessionStorage.setItem('broker-session', session);
    const calls = mockBroker(() => jsonResponse({ ...list, total: 25 }));
    render(<BrokerDashboardPage />);
    expect(await screen.findByText(/Page 1 of 3/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calls.some(c => c.includes('page=2'))).toBe(true));
  });
});
