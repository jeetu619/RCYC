import type { CharterEnquiry, FormState } from './types';

export class ValidationError extends Error {
  constructor(
    public field: string,
    message: string
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidE164Phone(phone: string): boolean {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone.replace(/\D/g, ''));
}

export function isSaturday(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00Z');
  return date.getUTCDay() === 6;
}

export function isValidDate(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00Z');
  return !isNaN(date.getTime());
}

export function isFutureDate(dateStr: string): boolean {
  const date = new Date(dateStr + 'T00:00:00Z');
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return date >= today;
}

export function validateCharterEnquiry(enquiry: Partial<CharterEnquiry>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!enquiry.yachtId) errors.push(new ValidationError('yachtId', 'Yacht is required'));
  if (!enquiry.startDate) errors.push(new ValidationError('startDate', 'Start date is required'));
  if (enquiry.startDate && !isValidDate(enquiry.startDate)) {
    errors.push(new ValidationError('startDate', 'Invalid date format'));
  }
  if (enquiry.startDate && !isSaturday(enquiry.startDate)) {
    errors.push(new ValidationError('startDate', 'Start date must be a Saturday'));
  }
  if (enquiry.startDate && !isFutureDate(enquiry.startDate)) {
    errors.push(new ValidationError('startDate', 'Start date must be in the future'));
  }

  if (enquiry.numberOfAdultGuests === undefined) {
    errors.push(new ValidationError('numberOfAdultGuests', 'Number of adults is required'));
  } else if (enquiry.numberOfAdultGuests < 1) {
    errors.push(new ValidationError('numberOfAdultGuests', 'At least 1 adult guest is required'));
  }

  if (enquiry.numberOfChildren === undefined) {
    errors.push(new ValidationError('numberOfChildren', 'Number of children is required'));
  } else if (enquiry.numberOfChildren < 0) {
    errors.push(new ValidationError('numberOfChildren', 'Number of children cannot be negative'));
  }

  if (!enquiry.cruisingArea) {
    errors.push(new ValidationError('cruisingArea', 'Cruising area is required'));
  }
  if (enquiry.cruisingArea === 'Other' && !enquiry.otherCruisingAreaDetails) {
    errors.push(new ValidationError('otherCruisingAreaDetails', 'Please specify cruising area'));
  }

  if (!enquiry.clientName) {
    errors.push(new ValidationError('clientName', 'Name is required'));
  } else if (enquiry.clientName.length < 2 || enquiry.clientName.length > 100) {
    errors.push(new ValidationError('clientName', 'Name must be between 2 and 100 characters'));
  }

  if (!enquiry.clientEmail) {
    errors.push(new ValidationError('clientEmail', 'Email is required'));
  } else if (!isValidEmail(enquiry.clientEmail)) {
    errors.push(new ValidationError('clientEmail', 'Invalid email address'));
  }

  if (!enquiry.clientPhone) {
    errors.push(new ValidationError('clientPhone', 'Phone is required'));
  } else if (!isValidE164Phone(enquiry.clientPhone)) {
    errors.push(new ValidationError('clientPhone', 'Invalid phone number'));
  }

  if (!enquiry.privacyConsent) {
    errors.push(new ValidationError('privacyConsent', 'Privacy consent is required'));
  }

  return errors;
}

export function validateFormStep1(data: Partial<FormState['step1']>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.yachtId) errors.push(new ValidationError('yachtId', 'Yacht is required'));
  if (!data.startDate) errors.push(new ValidationError('startDate', 'Start date is required'));
  if (data.startDate && !isValidDate(data.startDate)) {
    errors.push(new ValidationError('startDate', 'Invalid date format'));
  }
  if (data.startDate && !isSaturday(data.startDate)) {
    errors.push(new ValidationError('startDate', 'Start date must be a Saturday'));
  }
  return errors;
}

export function validateFormStep2(data: Partial<FormState['step2']>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (data.numberOfAdultGuests === undefined) {
    errors.push(new ValidationError('numberOfAdultGuests', 'Number of adults is required'));
  }
  if (data.numberOfChildren === undefined) {
    errors.push(new ValidationError('numberOfChildren', 'Number of children is required'));
  }
  if (!data.cruisingArea) {
    errors.push(new ValidationError('cruisingArea', 'Cruising area is required'));
  }
  if (data.cruisingArea === 'Other' && !data.otherCruisingAreaDetails) {
    errors.push(new ValidationError('otherCruisingAreaDetails', 'Please specify cruising area'));
  }
  return errors;
}

export function validateFormStep3(data: Partial<FormState['step3']>): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!data.clientName) {
    errors.push(new ValidationError('clientName', 'Name is required'));
  }
  if (!data.clientEmail) {
    errors.push(new ValidationError('clientEmail', 'Email is required'));
  } else if (!isValidEmail(data.clientEmail)) {
    errors.push(new ValidationError('clientEmail', 'Invalid email address'));
  }
  if (!data.clientPhone) {
    errors.push(new ValidationError('clientPhone', 'Phone is required'));
  } else if (!isValidE164Phone(data.clientPhone)) {
    errors.push(new ValidationError('clientPhone', 'Invalid phone number'));
  }
  if (!data.privacyConsent) {
    errors.push(new ValidationError('privacyConsent', 'Privacy consent is required'));
  }
  return errors;
}
