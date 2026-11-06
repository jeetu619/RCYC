import { initializeDatabase, closeDatabase, getDatabase } from '../database';
import { generateBookingReference } from '../services/bookingReferenceService';

describe('Booking Reference Service', () => {
  beforeAll(async () => {
    await initializeDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('should generate booking reference with correct format', async () => {
    const reference = await generateBookingReference();
    const year = new Date().getUTCFullYear();
    expect(reference).toMatch(new RegExp(`^ENQ-${year}-\\d{4}$`));
  });

  it('should generate unique booking references', async () => {
    const ref1 = await generateBookingReference();
    const ref2 = await generateBookingReference();
    expect(ref1).not.toBe(ref2);
  });

  it('should increment counter for same year', async () => {
    const ref1 = await generateBookingReference();
    const ref2 = await generateBookingReference();
    const num1 = parseInt(ref1.split('-')[2]);
    const num2 = parseInt(ref2.split('-')[2]);
    expect(num2).toBe(num1 + 1);
  });
});
