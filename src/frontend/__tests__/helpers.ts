import { addDays, todayISO } from '../../shared/dates';
import type { LiveCheckResponse, Yacht } from '../../shared/types';

export const YACHTS: Yacht[] = [
  { id: 'yacht-sea-lark', name: 'Sea Lark', lengthMeters: 25, cabins: 5, maxGuests: 10, weeklyRateEuro: 65000, photoUrl: '/images/sea-lark.svg' },
  { id: 'yacht-calliope', name: 'Calliope', lengthMeters: 20, cabins: 4, maxGuests: 8, weeklyRateEuro: 29500, photoUrl: '/images/calliope.svg' }
];

/** A Saturday at least `weeks` weeks ahead. */
export function futureSaturday(weeks = 6): string {
  let d = addDays(todayISO(), weeks * 7);
  while (new Date(`${d}T00:00:00Z`).getUTCDay() !== 6) d = addDays(d, 1);
  return d;
}

export interface MockOptions {
  check?: (body: any) => LiveCheckResponse | FakeResponse | Promise<LiveCheckResponse | FakeResponse>;
  availability?: Array<{ date: string; status: string }>;
  yachts?: () => FakeResponse | Yacht[];
  submit?: (body: any) => FakeResponse | object;
}

/** Minimal stand-in for fetch's Response (jsdom does not provide one). */
export class FakeResponse {
  ok: boolean;
  constructor(
    private body: unknown,
    public status = 200
  ) {
    this.ok = status >= 200 && status < 300;
  }
  async json() {
    return this.body;
  }
}

export const jsonResponse = (body: unknown, status = 200) => new FakeResponse(body, status);

/** Installs a fetch mock covering the public API. Returns the recorded calls. */
export function mockFetch(options: MockOptions = {}) {
  const calls: Array<{ url: string; method: string; body?: any }> = [];
  const impl = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });

    if (url.endsWith('/api/yachts')) {
      const r = options.yachts?.() ?? YACHTS;
      return r instanceof FakeResponse ? r : jsonResponse(r);
    }
    if (url.includes('/availability')) {
      const params = new URL(url, 'http://x').searchParams;
      const from = params.get('from')!;
      const to = params.get('to')!;
      const entries: Array<{ date: string; status: string }> = [];
      for (let d = from; d <= to; d = addDays(d, 1)) {
        if (new Date(`${d}T00:00:00Z`).getUTCDay() === 6) {
          entries.push(options.availability?.find(a => a.date === d) ?? { date: d, status: 'Available' });
        }
      }
      return jsonResponse(entries);
    }
    if (url.endsWith('/charter-enquiries/check')) {
      const r = await (options.check?.(body) ?? { status: 'Available', message: 'This yacht is available for your dates and guest count.', alternatives: [] });
      return r instanceof FakeResponse ? r : jsonResponse(r);
    }
    if (url.endsWith('/v1/charter-enquiries')) {
      const r = options.submit?.(body) ?? { bookingReference: 'ENQ-2027-0001', message: 'ok', yachtName: 'Sea Lark', startDate: body.startDate, endDate: addDays(body.startDate, 7) };
      return r instanceof FakeResponse ? r : jsonResponse(r, 201);
    }
    return jsonResponse({ error: 'not mocked' }, 404);
  };
  (global as any).fetch = jest.fn(impl);
  return calls;
}
