import { addDays, deriveEndDate, formatDateRange, isFutureDate, isSaturday, parseISODate, saturdaysInMonth, todayISO } from '../dates';
import { calculatePricing } from '../pricing';
import {
  buildPhone,
  isValidE164Phone,
  isValidEmail,
  validateCharterEnquiry,
  validateFormStep1,
  validateFormStep2,
  validateFormStep3
} from '../validators';

const nextSaturday = () => {
  let d = addDays(todayISO(), 7);
  while (!isSaturday(d)) d = addDays(d, 1);
  return d;
};

describe('dates', () => {
  it('parses strictly', () => {
    expect(parseISODate('2027-06-12')).not.toBeNull();
    expect(parseISODate('2027-02-30')).toBeNull();
    expect(parseISODate('2027-6-12')).toBeNull();
    expect(parseISODate(20270612)).toBeNull();
  });

  it('2027-06-12 is a Saturday and the end date is 7 days later (R-05)', () => {
    expect(isSaturday('2027-06-12')).toBe(true);
    expect(isSaturday('2027-06-13')).toBe(false);
    expect(deriveEndDate('2027-06-12')).toBe('2027-06-19');
    expect(deriveEndDate('2027-12-25')).toBe('2028-01-01');
  });

  it("formats 'Sat DD Mon – Sat DD Mon YYYY · 7 nights'", () => {
    expect(formatDateRange('2027-06-12')).toBe('Sat 12 Jun – Sat 19 Jun 2027 · 7 nights');
    expect(formatDateRange('2027-12-25')).toBe('Sat 25 Dec – Sat 01 Jan 2028 · 7 nights');
  });

  it('future means strictly after today', () => {
    expect(isFutureDate(todayISO())).toBe(false);
    expect(isFutureDate(addDays(todayISO(), 1))).toBe(true);
    expect(isFutureDate('2001-01-06')).toBe(false);
  });

  it('lists the Saturdays in a month', () => {
    expect(saturdaysInMonth(2027, 5)).toEqual(['2027-06-05', '2027-06-12', '2027-06-19', '2027-06-26']);
  });
});

describe('pricing (R-07..R-09)', () => {
  it('VAT 12%, APA 30%, total, deposit 50% of total', () => {
    expect(calculatePricing(65000)).toEqual({
      charterFee: 65000,
      vat: 7800,
      apa: 19500,
      total: 92300,
      deposit: 46150
    });
    expect(calculatePricing(29500)).toEqual({
      charterFee: 29500,
      vat: 3540,
      apa: 8850,
      total: 41890,
      deposit: 20945
    });
  });
});

describe('contact validators', () => {
  it('emails', () => {
    expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
    for (const bad of ['', 'plain', 'a@b', '@x.com', 'a b@c.com']) expect(isValidEmail(bad)).toBe(false);
  });

  it('E.164 phones', () => {
    expect(isValidE164Phone('+1234567890')).toBe(true);
    expect(isValidE164Phone('+44 7700 900123')).toBe(true);
    for (const bad of ['1234', '0123456789', '+0123456789', '+12', 'abc', '+1234567890123456']) {
      expect(isValidE164Phone(bad)).toBe(false);
    }
  });

  it('builds E.164 from the picker, dropping a leading trunk zero', () => {
    expect(buildPhone('+44', '07700 900123')).toBe('+447700900123');
    expect(buildPhone('+44', '')).toBe('');
  });
});

describe('step validation', () => {
  it('step 1 needs a yacht and a future Saturday', () => {
    expect(validateFormStep1({}).map(e => e.field)).toEqual(['yachtId', 'startDate']);
    expect(validateFormStep1({ yachtId: 'y', startDate: addDays(nextSaturday(), 1) })[0].message).toMatch(/Saturday/);
    expect(validateFormStep1({ yachtId: 'y', startDate: '2001-01-06' })[0].message).toMatch(/future/);
    expect(validateFormStep1({ yachtId: 'y', startDate: nextSaturday() })).toEqual([]);
  });

  it('step 2 enforces capacity, cruising area and "Other" details', () => {
    const ok = { numberOfAdultGuests: 6, numberOfChildren: 2, cruisingArea: 'Croatia' };
    expect(validateFormStep2(ok, 8)).toEqual([]);
    expect(validateFormStep2({ ...ok, numberOfChildren: 3 }, 8)[0].message).toMatch(/exceeds/);
    expect(validateFormStep2({ ...ok, cruisingArea: '' }, 8)[0].field).toBe('cruisingArea');
    expect(validateFormStep2({ ...ok, cruisingArea: 'Other' }, 8)[0].field).toBe('otherCruisingAreaDetails');
    expect(validateFormStep2({ ...ok, occasion: 'Other' }, 8)[0].field).toBe('otherOccasionDetails');
    expect(validateFormStep2({ ...ok, specialRequests: 'x'.repeat(501) }, 8)[0].field).toBe('specialRequests');
    expect(validateFormStep2({ ...ok, numberOfAdultGuests: 0 }, 8)[0].field).toBe('numberOfAdultGuests');
  });

  it('step 3 needs name, email, phone and privacy consent', () => {
    expect(validateFormStep3({ privacyConsent: false, marketingOptIn: false }).map(e => e.field)).toEqual([
      'clientName',
      'clientEmail',
      'clientPhone',
      'privacyConsent'
    ]);
    expect(
      validateFormStep3({
        clientName: 'Jo',
        clientEmail: 'jo@example.com',
        clientPhone: '+447700900123',
        privacyConsent: true,
        marketingOptIn: false
      })
    ).toEqual([]);
  });

  it('full payload validation accepts the spec example', () => {
    expect(
      validateCharterEnquiry(
        {
          yachtId: 'yacht-sea-lark',
          startDate: nextSaturday(),
          numberOfAdultGuests: 6,
          numberOfChildren: 2,
          cruisingArea: 'Greek Islands',
          occasion: 'Holiday',
          specialRequests: 'Need child seats.',
          clientName: 'John Doe',
          clientEmail: 'john.doe@example.com',
          clientPhone: '+1234567890',
          privacyConsent: true,
          marketingOptIn: true
        },
        10
      )
    ).toEqual([]);
  });
});
