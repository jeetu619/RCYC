import {
  CRUISING_AREAS,
  MAX_OTHER_DETAILS_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
  OCCASIONS
} from './constants';
import { isFutureDate, isSaturday, isValidDate } from './dates';
import type { FormState } from './types';

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

type Check = ValidationError | null;
type Loose = Record<string, unknown>;

export function isValidEmail(email: string): boolean {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

/** Removes the usual human formatting from a phone number (spaces, dashes, dots, brackets). */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

/** E.164: '+', country code not starting with 0, 7-15 digits in total. */
export function isValidE164Phone(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(normalizePhone(phone));
}

/** Builds an E.164 number from the country-code picker and the national part. */
export function buildPhone(countryCode: string | undefined, national: string | undefined): string {
  const digits = (national ?? '').replace(/\D/g, '').replace(/^0+/, '');
  if (!digits) return '';
  return `${countryCode ?? ''}${digits}`;
}

export { isSaturday, isValidDate, isFutureDate };

const err = (field: string, message: string) => new ValidationError(field, message);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
const nonEmpty = (v: unknown) => str(v).length > 0;

/** Strips control characters and surrounding whitespace from free text before storing it. */
export function sanitizeText(value: unknown): string {
  // eslint-disable-next-line no-control-regex
  return typeof value === 'string' ? value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim() : '';
}

function yachtCheck(v: Loose): Check {
  if (!nonEmpty(v.yachtId) || str(v.yachtId).length > 64) return err('yachtId', 'Please select a yacht');
  return null;
}

function startDateCheck(v: Loose): Check {
  if (v.startDate === undefined || v.startDate === null || v.startDate === '') {
    return err('startDate', 'Start date is required');
  }
  if (!isValidDate(v.startDate)) return err('startDate', 'Invalid date format (expected YYYY-MM-DD)');
  const date = v.startDate as string;
  if (!isSaturday(date)) return err('startDate', 'Start date must be a Saturday');
  if (!isFutureDate(date)) return err('startDate', 'Start date must be in the future');
  return null;
}

function guestChecks(v: Loose, maxGuests?: number): ValidationError[] {
  const out: ValidationError[] = [];
  const { numberOfAdultGuests: adults, numberOfChildren: children } = v;
  if (adults === undefined || adults === null || adults === '') {
    out.push(err('numberOfAdultGuests', 'Number of adults is required'));
  } else if (!isInt(adults) || adults < 1) {
    out.push(err('numberOfAdultGuests', 'At least 1 adult guest is required'));
  }
  if (children === undefined || children === null || children === '') {
    out.push(err('numberOfChildren', 'Number of children is required'));
  } else if (!isInt(children) || children < 0) {
    out.push(err('numberOfChildren', 'Number of children must be 0 or more'));
  }
  if (out.length === 0 && maxGuests !== undefined) {
    const total = (adults as number) + (children as number);
    if (total > maxGuests) {
      out.push(
        err('numberOfAdultGuests', `Total guests (${total}) exceeds this yacht's capacity of ${maxGuests}`)
      );
    }
  }
  return out;
}

function cruisingChecks(v: Loose): ValidationError[] {
  const out: ValidationError[] = [];
  if (!nonEmpty(v.cruisingArea)) {
    out.push(err('cruisingArea', 'Cruising area is required'));
  } else if (!(CRUISING_AREAS as readonly string[]).includes(v.cruisingArea as string)) {
    out.push(err('cruisingArea', 'Please choose one of the listed cruising areas'));
  } else if (v.cruisingArea === 'Other' && !nonEmpty(v.otherCruisingAreaDetails)) {
    out.push(err('otherCruisingAreaDetails', 'Please specify your cruising area'));
  }
  if (str(v.otherCruisingAreaDetails).length > MAX_OTHER_DETAILS_LENGTH) {
    out.push(err('otherCruisingAreaDetails', `Maximum ${MAX_OTHER_DETAILS_LENGTH} characters`));
  }
  return out;
}

function occasionChecks(v: Loose): ValidationError[] {
  const out: ValidationError[] = [];
  if (nonEmpty(v.occasion)) {
    if (!(OCCASIONS as readonly string[]).includes(v.occasion as string)) {
      out.push(err('occasion', 'Please choose one of the listed occasions'));
    } else if (v.occasion === 'Other' && !nonEmpty(v.otherOccasionDetails)) {
      out.push(err('otherOccasionDetails', 'Please specify the occasion'));
    }
  }
  if (str(v.otherOccasionDetails).length > MAX_OTHER_DETAILS_LENGTH) {
    out.push(err('otherOccasionDetails', `Maximum ${MAX_OTHER_DETAILS_LENGTH} characters`));
  }
  if (v.specialRequests !== undefined && v.specialRequests !== null && typeof v.specialRequests !== 'string') {
    out.push(err('specialRequests', 'Special requests must be text'));
  } else if (str(v.specialRequests).length > MAX_SPECIAL_REQUESTS_LENGTH) {
    out.push(err('specialRequests', `Maximum ${MAX_SPECIAL_REQUESTS_LENGTH} characters`));
  }
  return out;
}

function contactChecks(v: Loose): ValidationError[] {
  const out: ValidationError[] = [];
  const name = str(v.clientName);
  if (!name) out.push(err('clientName', 'Name is required'));
  else if (name.length < 2 || name.length > 100) {
    out.push(err('clientName', 'Name must be between 2 and 100 characters'));
  }

  const email = str(v.clientEmail);
  if (!email) out.push(err('clientEmail', 'Email is required'));
  else if (!isValidEmail(email)) out.push(err('clientEmail', 'Enter a valid email address'));

  const phone = str(v.clientPhone);
  if (!phone) out.push(err('clientPhone', 'Phone number is required'));
  else if (!isValidE164Phone(phone)) {
    out.push(err('clientPhone', 'Enter a valid international phone number, e.g. +441234567890'));
  }

  if (v.privacyConsent !== true) {
    out.push(err('privacyConsent', 'You must agree to the Privacy Policy to submit'));
  }
  if (v.marketingOptIn !== undefined && v.marketingOptIn !== null && typeof v.marketingOptIn !== 'boolean') {
    out.push(err('marketingOptIn', 'Marketing opt-in must be true or false'));
  }
  return out;
}

const compact = (list: Array<ValidationError | null | undefined>) =>
  list.filter((e): e is ValidationError => !!e);

/**
 * Full server-side validation of an API-01 payload (R-01..R-03, R-05, R-06).
 * `maxGuests` is supplied by the caller once the yacht has been looked up.
 */
export function validateCharterEnquiry(input: unknown, maxGuests?: number): ValidationError[] {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return [err('body', 'Request body must be a JSON object')];
  }
  const v = input as Loose;
  return [
    ...compact([yachtCheck(v), startDateCheck(v)]),
    ...guestChecks(v, maxGuests),
    ...cruisingChecks(v),
    ...occasionChecks(v),
    ...contactChecks(v)
  ];
}

export function validateFormStep1(data: Partial<FormState['step1']>): ValidationError[] {
  return compact([yachtCheck(data as Loose), startDateCheck(data as Loose)]);
}

export function validateFormStep2(data: Partial<FormState['step2']>, maxGuests?: number): ValidationError[] {
  return [...guestChecks(data as Loose, maxGuests), ...cruisingChecks(data as Loose), ...occasionChecks(data as Loose)];
}

export function validateFormStep3(data: Partial<FormState['step3']>): ValidationError[] {
  return contactChecks(data as Loose);
}

export function errorsToMap(errors: ValidationError[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const e of errors) if (!map[e.field]) map[e.field] = e.message;
  return map;
}
