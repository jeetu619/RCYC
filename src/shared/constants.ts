export const CRUISING_AREAS = [
  "Côte d'Azur",
  'Amalfi Coast',
  'Greek Islands',
  'Balearics',
  'Croatia',
  'Other'
] as const;

export const OCCASIONS = ['Holiday', 'Birthday', 'Honeymoon', 'Corporate', 'Other'] as const;

export const CHARTER_NIGHTS = 7;
export const MAX_OTHER_DETAILS_LENGTH = 100;
export const MAX_SPECIAL_REQUESTS_LENGTH = 500;
export const LIVE_CHECK_DEBOUNCE_MS = 400;
export const MAX_ALTERNATIVES = 3;
export const ALTERNATIVE_WEEKS_RANGE = 3;

export const VAT_RATE = 0.12;
export const APA_RATE = 0.3;
export const DEPOSIT_RATE = 0.5;

/** Subset of country calling codes offered by the phone picker (open question 2 in the spec). */
export const COUNTRY_CODES = [
  { code: '+44', label: 'United Kingdom (+44)' },
  { code: '+1', label: 'United States / Canada (+1)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+30', label: 'Greece (+30)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+385', label: 'Croatia (+385)' },
  { code: '+377', label: 'Monaco (+377)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+41', label: 'Switzerland (+41)' },
  { code: '+31', label: 'Netherlands (+31)' },
  { code: '+971', label: 'United Arab Emirates (+971)' },
  { code: '+61', label: 'Australia (+61)' }
] as const;
