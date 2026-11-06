import type {
  Yacht,
  CharterEnquiry,
  LiveCheckRequest,
  LiveCheckResponse,
  AvailabilityEntry,
  BrokerEnquiryListResponse
} from '../../shared/types';

const API_BASE = '/api';

export async function getYachts(): Promise<Yacht[]> {
  const response = await fetch(`${API_BASE}/yachts`);
  if (!response.ok) throw new Error('Failed to fetch yachts');
  return response.json();
}

export async function getYachtAvailability(
  yachtId: string,
  from: string,
  to: string
): Promise<AvailabilityEntry[]> {
  const response = await fetch(
    `${API_BASE}/yachts/${yachtId}/availability?from=${from}&to=${to}`
  );
  if (!response.ok) throw new Error('Failed to fetch availability');
  return response.json();
}

export async function checkLiveAvailability(
  request: LiveCheckRequest
): Promise<LiveCheckResponse> {
  const response = await fetch(`${API_BASE}/charter-enquiries/check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) throw new Error('Failed to check availability');
  return response.json();
}

export async function submitEnquiry(enquiry: Partial<CharterEnquiry>): Promise<{
  bookingReference: string;
  yachtName: string;
  startDate: string;
  endDate: string;
}> {
  const response = await fetch(`${API_BASE}/v1/charter-enquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(enquiry)
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.details?.[0]?.message || error.error || 'Submission failed');
  }
  return response.json();
}

export async function getEnquiryDetails(reference: string): Promise<any> {
  const response = await fetch(`${API_BASE}/charter-enquiries/${reference}`);
  if (!response.ok) throw new Error('Failed to fetch enquiry');
  return response.json();
}

export async function getBrokerEnquiries(
  filters?: {
    status?: string;
    yachtId?: string;
    dateFrom?: string;
    dateTo?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  },
  token?: string
): Promise<BrokerEnquiryListResponse> {
  const params = new URLSearchParams();
  if (filters?.status) params.append('status', filters.status);
  if (filters?.yachtId) params.append('yachtId', filters.yachtId);
  if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
  if (filters?.dateTo) params.append('dateTo', filters.dateTo);
  if (filters?.search) params.append('search', filters.search);
  if (filters?.page) params.append('page', filters.page.toString());
  if (filters?.pageSize) params.append('pageSize', filters.pageSize.toString());

  const response = await fetch(`${API_BASE}/charter-enquiries?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('Unauthorized');
    throw new Error('Failed to fetch enquiries');
  }
  return response.json();
}
