import type {
  AvailabilityEntry,
  BrokerEnquiryListResponse,
  CharterEnquiryRequest,
  CharterEnquiryResponse,
  EnquiryConfirmation,
  LiveCheckRequest,
  LiveCheckResponse,
  Yacht
} from '../../shared/types';

const API_BASE = '/api';
const SESSION_KEY = 'broker-session';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details: Array<{ field: string; message: string }> = []
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError(0, 'Network error');
  }
  if (!response.ok) {
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(response.status, body?.error || `Request failed (${response.status})`, body?.details ?? []);
  }
  return response.json() as Promise<T>;
}

const json = (body: unknown, extra: Record<string, string> = {}): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json', ...extra },
  body: JSON.stringify(body)
});

export const getYachts = () => request<Yacht[]>('/yachts');

export const getYachtAvailability = (yachtId: string, from: string, to: string) =>
  request<AvailabilityEntry[]>(
    `/yachts/${encodeURIComponent(yachtId)}/availability?from=${from}&to=${to}`
  );

export const checkLiveAvailability = (body: LiveCheckRequest) =>
  request<LiveCheckResponse>('/charter-enquiries/check', json(body));

export const submitEnquiry = (body: CharterEnquiryRequest) =>
  request<CharterEnquiryResponse>('/v1/charter-enquiries', json(body));

export const getEnquiryDetails = (reference: string) =>
  request<EnquiryConfirmation>(`/charter-enquiries/${encodeURIComponent(reference)}`);

// ---- Broker ------------------------------------------------------------------------------------

export const getBrokerSession = () => sessionStorage.getItem(SESSION_KEY);

export async function brokerLogin(accessCode: string): Promise<void> {
  const { sessionToken } = await request<{ sessionToken: string }>('/auth/broker-login', json({ accessCode }));
  sessionStorage.setItem(SESSION_KEY, sessionToken);
}

export async function brokerLogout(): Promise<void> {
  const session = getBrokerSession();
  sessionStorage.removeItem(SESSION_KEY);
  if (session) {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${session}` } }).catch(
      () => undefined
    );
  }
}

export interface BrokerFilters {
  status?: string;
  yachtId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export function getBrokerEnquiries(filters: BrokerFilters = {}): Promise<BrokerEnquiryListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.append(key, String(value));
  }
  const session = getBrokerSession();
  return request<BrokerEnquiryListResponse>(`/charter-enquiries?${params.toString()}`, {
    headers: session ? { Authorization: `Bearer ${session}` } : {}
  });
}
