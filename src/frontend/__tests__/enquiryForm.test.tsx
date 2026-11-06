import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import EnquiryForm from '../components/EnquiryForm';
import { STORAGE_KEY } from '../hooks/useEnquiryForm';
import { futureSaturday, jsonResponse, mockFetch, YACHTS } from './helpers';
import { addDays } from '../../shared/dates';

const START = futureSaturday(6);

function renderForm() {
  return render(
    <MemoryRouter initialEntries={['/charter/enquiry']}>
      <Routes>
        <Route path="/charter/enquiry" element={<EnquiryForm />} />
        <Route path="/charter/enquiry/:reference" element={<div>CONFIRMATION PAGE</div>} />
      </Routes>
    </MemoryRouter>
  );
}

function seedDraft(form: any, step = 1) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, form }));
}

const completeDraft = (overrides: any = {}) => ({
  step1: { yachtId: 'yacht-sea-lark', startDate: START },
  step2: { numberOfAdultGuests: 6, numberOfChildren: 2, cruisingArea: 'Greek Islands' },
  step3: {
    clientName: 'John Doe',
    clientEmail: 'john@example.com',
    clientPhone: '+447700900123',
    phoneCountry: '+44',
    phoneNational: '7700900123',
    privacyConsent: true,
    marketingOptIn: false
  },
  ...overrides
});

const submitButton = () => screen.getByRole('button', { name: /submit enquiry/i });

beforeEach(() => {
  localStorage.clear();
  window.scrollTo = jest.fn();
});

describe('Step 1 – yacht & dates', () => {
  it('shows yacht cards with photo, name, length, cabins, max guests and weekly rate; highlights the selection', async () => {
    mockFetch();
    renderForm();
    const seaLark = await screen.findByRole('button', { name: /Sea Lark/ });
    expect(within(seaLark).getByRole('img')).toBeInTheDocument();
    expect(seaLark).toHaveTextContent('25 m');
    expect(seaLark).toHaveTextContent('5 cabins');
    expect(seaLark).toHaveTextContent('up to 10 guests');
    expect(seaLark).toHaveTextContent('from €65,000 / week');
    expect(seaLark).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(seaLark);
    expect(seaLark).toHaveAttribute('aria-pressed', 'true');
    expect(seaLark).toHaveClass('selected');
  });

  it('shows the progress bar labels', async () => {
    mockFetch();
    renderForm();
    expect(await screen.findByText('Yacht & Dates')).toBeInTheDocument();
    expect(screen.getByText('Guests & Preferences')).toBeInTheDocument();
    expect(screen.getByText('Your Details & Review')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('Next without yacht/date shows inline errors and a summary, and does not advance', async () => {
    mockFetch();
    renderForm();
    await screen.findByRole('button', { name: /Sea Lark/ });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('Please select a yacht').length).toBeGreaterThan(0);
    expect(screen.getByText(/Please fix the following/)).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '1');
  });

  it('calendar: only Saturdays are selectable; picking one shows "Sat DD Mon – Sat DD Mon YYYY · 7 nights"', async () => {
    mockFetch({ availability: [{ date: addDays(START, 7), status: 'Held' }, { date: addDays(START, 14), status: 'Booked' }] });
    seedDraft(completeDraft({ step1: { yachtId: 'yacht-sea-lark' } }));
    renderForm();
    await screen.findByRole('group', { name: /^[A-Z][a-z]+ \d{4}$/ });
    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));

    const saturdayButtons = await screen.findAllByRole('button', { name: /^Saturday \d+/ });
    expect(saturdayButtons.length).toBeGreaterThanOrEqual(4);
    // Only Saturday cells are interactive: the grid contains no other day buttons.
    const grid = screen.getByRole('group', { name: /^[A-Z][a-z]+ \d{4}$/ });
    expect(within(grid).getAllByRole('button')).toHaveLength(saturdayButtons.length);

    // Statuses are labelled for assistive tech and visible in the legend.
    expect(screen.getByRole('list', { name: 'Availability legend' })).toHaveTextContent('Held');

    await userEvent.click(saturdayButtons.find(b => !b.hasAttribute('disabled'))!);
    expect(screen.getByTestId('selected-dates')).toHaveTextContent(/^Sat \d{2} \w{3} – Sat \d{2} \w{3} \d{4} · 7 nights$/);
  });

  it('marks Held and Booked Saturdays from the availability API', async () => {
    mockFetch({ availability: [{ date: START, status: 'Booked' }] });
    seedDraft(completeDraft({ step1: { yachtId: 'yacht-sea-lark', startDate: START } }));
    renderForm();
    const booked = await screen.findByRole('button', { name: new RegExp(`Saturday ${Number(START.slice(8))} .*Booked`) });
    expect(booked).toHaveClass('booked');
  });
});

describe('Indicative estimate', () => {
  it('shows Charter Fee, VAT 12%, APA 30%, Total and 50% Deposit for the selected yacht', async () => {
    mockFetch();
    seedDraft(completeDraft());
    renderForm();
    await screen.findByText('Charter Fee');
    const panel = screen.getByRole('complementary', { name: 'Indicative estimate' });
    expect(panel).toHaveTextContent('Charter Fee€65,000');
    expect(panel).toHaveTextContent('VAT 12%€7,800');
    expect(panel).toHaveTextContent('APA 30%€19,500');
    expect(panel).toHaveTextContent('Total€92,300');
    expect(panel).toHaveTextContent('50% Deposit€46,150');
  });

  it('updates when the yacht changes', async () => {
    mockFetch();
    seedDraft(completeDraft());
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /Calliope/ }));
    const panel = screen.getByRole('complementary', { name: 'Indicative estimate' });
    await waitFor(() => expect(panel).toHaveTextContent('Charter Fee€29,500'));
    expect(panel).toHaveTextContent('Total€41,890');
  });
});

describe('Step 2 – guests & preferences', () => {
  const step2 = (overrides: any = {}) => completeDraft(overrides);

  it('shows "X of Y guests" and stops the steppers at the yacht capacity', async () => {
    mockFetch();
    seedDraft(step2({ step2: { numberOfAdultGuests: 9, numberOfChildren: 0, cruisingArea: 'Croatia' } }), 2);
    renderForm();
    expect(await screen.findByText('9 of 10 guests')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Increase number of adults' }));
    expect(screen.getByText('10 of 10 guests')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Increase number of adults' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Increase number of children' })).toBeDisabled();
  });

  it('children count towards the total', async () => {
    mockFetch();
    seedDraft(step2(), 2);
    renderForm();
    expect(await screen.findByText('8 of 10 guests')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Increase number of children' }));
    expect(screen.getByText('9 of 10 guests')).toBeInTheDocument();
  });

  it('changing to a smaller yacht re-fits the guest count to the new maximum', async () => {
    mockFetch();
    seedDraft(step2({ step2: { numberOfAdultGuests: 8, numberOfChildren: 2, cruisingArea: 'Croatia' } }), 1);
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /Calliope/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('8 of 8 guests')).toBeInTheDocument();
  });

  it('cruising area is required; "Other" reveals a text field that is then required', async () => {
    mockFetch();
    seedDraft(step2({ step2: { numberOfAdultGuests: 2, numberOfChildren: 0 } }), 2);
    renderForm();
    await screen.findByText('2 of 10 guests');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('Cruising area is required').length).toBeGreaterThan(0);

    await userEvent.selectOptions(screen.getByLabelText(/Preferred Cruising Area/), 'Other');
    expect(screen.getByLabelText(/Please specify your cruising area/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getAllByText('Please specify your cruising area').length).toBeGreaterThan(0);

    await userEvent.type(screen.getByLabelText(/Please specify your cruising area/), 'Seychelles');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByRole('heading', { name: /Your details/ })).toBeInTheDocument();
  });

  it('offers the six cruising areas and five occasions, and "Other" occasion shows a text field', async () => {
    mockFetch();
    seedDraft(step2(), 2);
    renderForm();
    const area = await screen.findByLabelText(/Preferred Cruising Area/);
    expect(within(area).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Select…', "Côte d'Azur", 'Amalfi Coast', 'Greek Islands', 'Balearics', 'Croatia', 'Other'
    ]);
    const occasion = screen.getByLabelText('Occasion');
    expect(within(occasion).getAllByRole('option').map(o => o.textContent)).toEqual([
      'Select…', 'Holiday', 'Birthday', 'Honeymoon', 'Corporate', 'Other'
    ]);
    await userEvent.selectOptions(occasion, 'Other');
    expect(screen.getByLabelText(/Please specify the occasion/)).toHaveAttribute('maxlength', '100');
  });

  it('special requests are limited to 500 characters with a counter', async () => {
    mockFetch();
    seedDraft(step2(), 2);
    renderForm();
    const box = await screen.findByLabelText(/Special Requests/);
    expect(box).toHaveAttribute('maxlength', '500');
    await userEvent.type(box, 'Vegan menu');
    expect(screen.getByText('10 / 500')).toBeInTheDocument();
  });
});

describe('Live availability & submission gating (R-10)', () => {
  it('Available: green badge and Submit enabled once the form is valid', async () => {
    mockFetch();
    seedDraft(completeDraft(), 3);
    renderForm();
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
    expect(screen.getAllByText('Available').some(el => el.classList.contains('live-badge') && el.classList.contains('green'))).toBe(true);
  });

  it('calls the live check once, 400 ms after input settles', async () => {
    const calls = mockFetch();
    seedDraft(completeDraft(), 3);
    renderForm();
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
    expect(calls.filter(c => c.url.endsWith('/charter-enquiries/check'))).toHaveLength(1);
    expect(calls.find(c => c.url.endsWith('/check'))!.body).toEqual({ yachtId: 'yacht-sea-lark', startDate: START, numberOfGuests: 8 });
  });

  it('On hold: amber badge, Submit still enabled', async () => {
    mockFetch({ check: () => ({ status: 'OnHold', message: 'On hold', alternatives: [] }) });
    seedDraft(completeDraft(), 3);
    renderForm();
    const badge = await screen.findAllByText('On hold – may become free', {}, { timeout: 3000 });
    expect(badge.some(el => el.classList.contains('amber'))).toBe(true);
    expect(submitButton()).toBeEnabled();
  });

  it('Booked: red badge, Submit disabled, up to 3 alternatives that Apply Alternative applies', async () => {
    const alt = (n: number) => ({
      yachtId: 'yacht-sea-lark', yachtName: 'Sea Lark', startDate: addDays(START, 7 * n), endDate: addDays(START, 7 * n + 7), numberOfGuests: 8, reason: `Same yacht, ${n} week later`
    });
    mockFetch({
      check: body =>
        body.startDate === START
          ? { status: 'Booked', message: 'Booked', alternatives: [alt(1), alt(2), alt(3)] }
          : { status: 'Available', message: 'ok', alternatives: [] }
    });
    seedDraft(completeDraft(), 3);
    renderForm();
    const badges = await screen.findAllByText('Booked', {}, { timeout: 3000 });
    expect(badges.some(el => el.classList.contains('red'))).toBe(true);
    expect(submitButton()).toBeDisabled();
    const buttons = screen.getAllByRole('button', { name: 'Apply Alternative' });
    expect(buttons).toHaveLength(3);

    await userEvent.click(buttons[0]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).form.step1.startDate).toBe(addDays(START, 7));
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
  });

  it('CapacityExceeded: "Too many guests for this yacht" and Submit disabled', async () => {
    mockFetch({ check: () => ({ status: 'CapacityExceeded', message: 'Too many', alternatives: [] }) });
    seedDraft(completeDraft(), 3);
    renderForm();
    expect((await screen.findAllByText('Too many guests for this yacht', {}, { timeout: 3000 })).length).toBeGreaterThan(0);
    expect(submitButton()).toBeDisabled();
  });

  it('check failure: shows "Could not check availability. Please try again.", disables Submit, and Retry recovers', async () => {
    let fail = true;
    mockFetch({ check: () => (fail ? jsonResponse({ error: 'boom' }, 500) : { status: 'Available', message: 'ok', alternatives: [] }) });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    seedDraft(completeDraft(), 3);
    renderForm();
    expect(await screen.findByText(/Could not check availability. Please try again./, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(submitButton()).toBeDisabled();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
  });

  it('Submit stays disabled until the privacy policy is accepted, even when Available', async () => {
    mockFetch();
    seedDraft(completeDraft({ step3: { ...completeDraft().step3, privacyConsent: false } }), 3);
    renderForm();
    await screen.findAllByText('Available', {}, { timeout: 3000 });
    expect(submitButton()).toBeDisabled();
    await userEvent.click(screen.getByLabelText(/I agree to the Privacy Policy/));
    expect(submitButton()).toBeEnabled();
  });

  it('shows inline errors for invalid contact details', async () => {
    mockFetch();
    seedDraft(completeDraft({ step3: { privacyConsent: false, marketingOptIn: false, phoneCountry: '+44' } }), 3);
    renderForm();
    const email = await screen.findByLabelText(/Your Email/);
    await userEvent.type(email, 'nope');
    await userEvent.tab();
    expect(screen.getAllByText('Enter a valid email address').length).toBeGreaterThan(0);
    await userEvent.type(screen.getByLabelText(/Your Phone Number/), '12');
    await userEvent.tab();
    expect(screen.getAllByText(/valid international phone number/).length).toBeGreaterThan(0);
    expect(submitButton()).toBeDisabled();
  });
});

describe('Step 3 – review & submit', () => {
  it('summarises the enquiry and offers consent checkboxes plus a country-code picker', async () => {
    mockFetch();
    seedDraft(completeDraft(), 3);
    renderForm();
    const summary = await screen.findByLabelText('Enquiry summary');
    await waitFor(() => expect(summary).toHaveTextContent('Sea Lark'));
    expect(summary).toHaveTextContent(/7 nights/);
    expect(summary).toHaveTextContent('8 (6 adults, 2 children)');
    expect(summary).toHaveTextContent('Greek Islands');
    expect(screen.getByLabelText(/I agree to the Privacy Policy/)).toBeChecked();
    expect(screen.getByLabelText(/marketing communications/)).not.toBeChecked();
    expect(screen.getByLabelText('Country code')).toHaveValue('+44');
  });

  it('builds the E.164 number from the picker and submits; then clears the draft and shows the confirmation', async () => {
    const calls = mockFetch();
    seedDraft(completeDraft({ step3: { privacyConsent: true, marketingOptIn: true, phoneCountry: '+44', clientName: 'John Doe', clientEmail: 'john@example.com' } }), 3);
    renderForm();
    await userEvent.selectOptions(await screen.findByLabelText('Country code'), '+33');
    await userEvent.type(screen.getByLabelText(/Your Phone Number/), '06 12 34 56 78');
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
    await userEvent.click(submitButton());
    expect(await screen.findByText('CONFIRMATION PAGE')).toBeInTheDocument();

    const post = calls.find(c => c.method === 'POST' && c.url.endsWith('/v1/charter-enquiries'))!;
    expect(post.body).toMatchObject({
      yachtId: 'yacht-sea-lark',
      startDate: START,
      numberOfAdultGuests: 6,
      numberOfChildren: 2,
      cruisingArea: 'Greek Islands',
      clientName: 'John Doe',
      clientPhone: '+33612345678',
      privacyConsent: true,
      marketingOptIn: true
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('a server error shows a friendly message, keeps the data and lets the client retry', async () => {
    let fail = true;
    mockFetch({ submit: () => (fail ? jsonResponse({ error: 'db down' }, 500) : { bookingReference: 'ENQ-2027-0002', message: 'ok', yachtName: 'Sea Lark', startDate: START, endDate: START }) });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    seedDraft(completeDraft(), 3);
    renderForm();
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
    await userEvent.click(submitButton());
    expect(await screen.findByText(/We could not submit your enquiry\. Please try again/)).toBeInTheDocument();
    expect(screen.queryByText(/db down/)).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!).form.step3.clientName).toBe('John Doe');

    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /Retry Submit Enquiry/ }));
    expect(await screen.findByText('CONFIRMATION PAGE')).toBeInTheDocument();
  });

  it('shows field messages returned by a server-side 400', async () => {
    mockFetch({ submit: () => jsonResponse({ error: 'Validation failed', details: [{ field: 'clientEmail', message: 'Server says: bad email' }] }, 400) });
    seedDraft(completeDraft(), 3);
    renderForm();
    await waitFor(() => expect(submitButton()).toBeEnabled(), { timeout: 3000 });
    await userEvent.click(submitButton());
    expect((await screen.findAllByText('Server says: bad email')).length).toBeGreaterThan(0);
  });
});

describe('Navigation & persistence', () => {
  it('Back/Next preserve entered data', async () => {
    mockFetch();
    seedDraft(completeDraft(), 2);
    renderForm();
    await screen.findByText('8 of 10 guests');
    await userEvent.selectOptions(screen.getByLabelText(/Preferred Cruising Area/), 'Croatia');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: /Sea Lark/ })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByLabelText(/Preferred Cruising Area/)).toHaveValue('Croatia');
    expect(screen.getByText('8 of 10 guests')).toBeInTheDocument();
  });

  it('a page refresh restores the data and the step', async () => {
    mockFetch();
    const first = renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /Calliope/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Next month' }));
    const saturdays = await screen.findAllByRole('button', { name: /^Saturday \d+/ });
    await userEvent.click(saturdays.find(b => !b.hasAttribute('disabled'))!);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Increase number of adults' }));
    expect(await screen.findByText('2 of 8 guests')).toBeInTheDocument();
    first.unmount();

    renderForm(); // "refresh"
    expect(await screen.findByText('2 of 8 guests')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '2');
  });

  it('ignores a corrupt draft', async () => {
    mockFetch();
    localStorage.setItem(STORAGE_KEY, '{not json');
    renderForm();
    expect(await screen.findByRole('button', { name: /Sea Lark/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('Loading and error states', () => {
  it('shows "Could not load yachts" with retry, and blocks the date picker', async () => {
    let fail = true;
    mockFetch({ yachts: () => (fail ? jsonResponse({ error: 'x' }, 500) : YACHTS) });
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    seedDraft(completeDraft(), 1);
    renderForm();
    expect(await screen.findByText(/Could not load yachts/)).toBeInTheDocument();
    expect(screen.getByText(/Please select a yacht first/)).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: /Sea Lark/ })).toBeInTheDocument();
  });

  it('shows a loading indicator while yachts load', async () => {
    mockFetch();
    renderForm();
    expect(screen.getByText(/Loading yachts/)).toBeInTheDocument();
    await screen.findByRole('button', { name: /Sea Lark/ });
  });
});
