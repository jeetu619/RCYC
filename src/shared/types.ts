export interface Yacht {
  id: string;
  name: string;
  lengthMeters: number;
  cabins: number;
  maxGuests: number;
  weeklyRateEuro: number;
  photoUrl?: string;
}

export type AvailabilityStatus = 'Available' | 'Held' | 'Booked';
export type EnquiryStatus = 'Submitted' | 'Available' | 'OnHold' | 'Booked' | 'CapacityExceeded' | 'IntegrationError';
export type LiveCheckStatus = 'Available' | 'OnHold' | 'Booked' | 'CapacityExceeded';

export interface AvailabilityEntry {
  date: string;
  status: AvailabilityStatus;
}

export interface CharterEnquiry {
  id?: string;
  bookingReference: string;
  yachtId: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  startDate: string;
  endDate: string;
  numberOfAdultGuests: number;
  numberOfChildren: number;
  cruisingArea: string;
  otherCruisingAreaDetails?: string;
  occasion?: string;
  otherOccasionDetails?: string;
  specialRequests?: string;
  privacyConsent: boolean;
  marketingOptIn?: boolean;
  submissionTimestamp?: string;
  status: EnquiryStatus;
}

/** Body of POST /api/v1/charter-enquiries (API-01). */
export interface CharterEnquiryRequest {
  yachtId: string;
  startDate: string;
  numberOfAdultGuests: number;
  numberOfChildren: number;
  cruisingArea: string;
  otherCruisingAreaDetails?: string;
  occasion?: string;
  otherOccasionDetails?: string;
  specialRequests?: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  privacyConsent: boolean;
  marketingOptIn?: boolean;
}

export interface CharterEnquiryResponse {
  bookingReference: string;
  message: string;
  yachtName: string;
  startDate: string;
  endDate: string;
}

/** Public view of a stored enquiry used by the confirmation page (SCR-02). */
export interface EnquiryConfirmation {
  bookingReference: string;
  yachtName: string;
  startDate: string;
  endDate: string;
  dates: string;
  guests: number;
  numberOfAdultGuests: number;
  numberOfChildren: number;
  cruisingArea: string;
  otherCruisingAreaDetails?: string | null;
  occasion?: string | null;
  otherOccasionDetails?: string | null;
  specialRequests?: string | null;
  status: EnquiryStatus;
  submissionTimestamp: string;
}

export interface LiveCheckRequest {
  yachtId: string;
  startDate: string;
  numberOfGuests: number;
}

export interface AlternativeOption {
  yachtId: string;
  yachtName: string;
  startDate: string;
  endDate: string;
  numberOfGuests: number;
  reason: string;
}

export interface LiveCheckResponse {
  status: LiveCheckStatus;
  message: string;
  alternatives: AlternativeOption[];
}

export interface BrokerEnquiryRow {
  reference: string;
  clientName: string;
  yachtName: string;
  startDate: string;
  endDate: string;
  guests: number;
  status: EnquiryStatus;
  receivedDate: string;
}

export interface BrokerEnquiryListResponse {
  total: number;
  kpis: {
    today: number;
    available: number;
    unavailable: number;
    percentAvailable: number;
  };
  enquiries: BrokerEnquiryRow[];
}

export interface IndicativePricing {
  charterFee: number;
  vat: number;
  apa: number;
  total: number;
  deposit: number;
}

export interface FormStep1Data {
  yachtId?: string;
  startDate?: string;
}

export interface FormStep2Data {
  numberOfAdultGuests: number;
  numberOfChildren: number;
  cruisingArea?: string;
  otherCruisingAreaDetails?: string;
  occasion?: string;
  otherOccasionDetails?: string;
  specialRequests?: string;
}

export interface FormStep3Data {
  clientName?: string;
  clientEmail?: string;
  /** E.164 value built from the picker (phoneCountry + phoneNational). */
  clientPhone?: string;
  phoneCountry?: string;
  phoneNational?: string;
  privacyConsent: boolean;
  marketingOptIn: boolean;
}

export interface FormState {
  step1: FormStep1Data;
  step2: FormStep2Data;
  step3: FormStep3Data;
}
