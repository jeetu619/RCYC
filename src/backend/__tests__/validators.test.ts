import {
  isValidEmail,
  isValidE164Phone,
  isSaturday,
  isValidDate,
  isFutureDate,
  validateCharterEnquiry,
  validateFormStep1,
  validateFormStep2,
  validateFormStep3
} from '../../shared/validators';

describe('Validators', () => {
  describe('isValidEmail', () => {
    it('should validate correct emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user+tag@domain.co.uk')).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(isValidEmail('invalid')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
    });
  });

  describe('isValidE164Phone', () => {
    it('should validate E.164 phone numbers', () => {
      expect(isValidE164Phone('+1234567890')).toBe(true);
      expect(isValidE164Phone('+442071838750')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(isValidE164Phone('1234')).toBe(false);
      expect(isValidE164Phone('+0123456789')).toBe(false);
    });
  });

  describe('isSaturday', () => {
    it('should identify Saturdays', () => {
      expect(isSaturday('2027-06-12')).toBe(true);
      expect(isSaturday('2027-06-19')).toBe(true);
    });

    it('should reject non-Saturdays', () => {
      expect(isSaturday('2027-06-11')).toBe(false);
      expect(isSaturday('2027-06-13')).toBe(false);
    });
  });

  describe('isValidDate', () => {
    it('should validate correct date formats', () => {
      expect(isValidDate('2027-06-12')).toBe(true);
      expect(isValidDate('2027-01-01')).toBe(true);
    });

    it('should reject invalid dates', () => {
      expect(isValidDate('invalid')).toBe(false);
      expect(isValidDate('2027-13-01')).toBe(false);
    });
  });

  describe('isFutureDate', () => {
    it('should identify future dates', () => {
      const futureDate = new Date();
      futureDate.setUTCFullYear(futureDate.getUTCFullYear() + 1);
      const futureDateStr = futureDate.toISOString().split('T')[0];
      expect(isFutureDate(futureDateStr)).toBe(true);
    });

    it('should reject past dates', () => {
      const pastDate = new Date();
      pastDate.setUTCFullYear(pastDate.getUTCFullYear() - 1);
      const pastDateStr = pastDate.toISOString().split('T')[0];
      expect(isFutureDate(pastDateStr)).toBe(false);
    });
  });

  describe('validateCharterEnquiry', () => {
    it('should validate complete enquiry', () => {
      const enquiry = {
        yachtId: 'yacht-sea-lark',
        startDate: '2027-06-12',
        numberOfAdultGuests: 6,
        numberOfChildren: 2,
        cruisingArea: 'Greek Islands',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        clientPhone: '+1234567890',
        privacyConsent: true
      };
      const errors = validateCharterEnquiry(enquiry);
      expect(errors).toHaveLength(0);
    });

    it('should catch missing required fields', () => {
      const enquiry = {
        numberOfAdultGuests: 6,
        numberOfChildren: 2
      };
      const errors = validateCharterEnquiry(enquiry);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.map(e => e.field)).toContain('yachtId');
      expect(errors.map(e => e.field)).toContain('startDate');
    });

    it('should validate email format', () => {
      const enquiry = {
        yachtId: 'yacht-sea-lark',
        startDate: '2027-06-12',
        numberOfAdultGuests: 6,
        numberOfChildren: 2,
        cruisingArea: 'Greek Islands',
        clientName: 'John Doe',
        clientEmail: 'invalid-email',
        clientPhone: '+1234567890',
        privacyConsent: true
      };
      const errors = validateCharterEnquiry(enquiry);
      expect(errors.map(e => e.field)).toContain('clientEmail');
    });

    it('should enforce privacy consent', () => {
      const enquiry = {
        yachtId: 'yacht-sea-lark',
        startDate: '2027-06-12',
        numberOfAdultGuests: 6,
        numberOfChildren: 2,
        cruisingArea: 'Greek Islands',
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        clientPhone: '+1234567890',
        privacyConsent: false
      };
      const errors = validateCharterEnquiry(enquiry);
      expect(errors.map(e => e.field)).toContain('privacyConsent');
    });
  });

  describe('validateFormStep1', () => {
    it('should validate yacht and date selection', () => {
      const errors = validateFormStep1({
        yachtId: 'yacht-sea-lark',
        startDate: '2027-06-12'
      });
      expect(errors).toHaveLength(0);
    });

    it('should catch missing yacht', () => {
      const errors = validateFormStep1({
        startDate: '2027-06-12'
      });
      expect(errors.map(e => e.field)).toContain('yachtId');
    });

    it('should enforce Saturday dates', () => {
      const errors = validateFormStep1({
        yachtId: 'yacht-sea-lark',
        startDate: '2027-06-11'
      });
      expect(errors.map(e => e.field)).toContain('startDate');
    });
  });

  describe('validateFormStep3', () => {
    it('should validate contact details', () => {
      const errors = validateFormStep3({
        clientName: 'John Doe',
        clientEmail: 'john@example.com',
        clientPhone: '+1234567890',
        privacyConsent: true,
        marketingOptIn: false
      });
      expect(errors).toHaveLength(0);
    });

    it('should catch invalid email', () => {
      const errors = validateFormStep3({
        clientName: 'John Doe',
        clientEmail: 'invalid',
        clientPhone: '+1234567890',
        privacyConsent: true,
        marketingOptIn: false
      });
      expect(errors.map(e => e.field)).toContain('clientEmail');
    });
  });
});
