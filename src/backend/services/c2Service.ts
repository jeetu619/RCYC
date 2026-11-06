import type { EnquiryStatus } from '../../shared/types';
import { getDatabase } from '../database';
import { checkLiveAvailability } from './availabilityService';

/**
 * Outbound integration with C2: "CharterEnquirySubmitted" triggers the availability check.
 * The resulting status is written back to the enquiry. On failure (spec §10) the failure is
 * logged, the enquiry is marked IntegrationError and the broker is alerted.
 */
export type C2Trigger = (enquiryId: string) => Promise<void>;

export const triggerC2AvailabilityCheck: C2Trigger = async enquiryId => {
  const db = getDatabase();
  const enquiry = await db.get('SELECT * FROM charter_enquiries WHERE id = ?', [enquiryId]);
  if (!enquiry) throw new Error(`Enquiry ${enquiryId} not found`);

  const result = await checkLiveAvailability(
    enquiry.yachtId,
    enquiry.startDate,
    enquiry.numberOfAdultGuests + enquiry.numberOfChildren
  );
  if (!result) throw new Error(`C2 could not resolve yacht ${enquiry.yachtId}`);

  const status: EnquiryStatus = result.status;
  await db.run('UPDATE charter_enquiries SET status = ? WHERE id = ?', [status, enquiryId]);
};

/** Runs the trigger and applies the documented failure handling. Never throws. */
export async function runC2Trigger(trigger: C2Trigger, enquiryId: string, bookingReference: string): Promise<void> {
  try {
    await trigger(enquiryId);
  } catch (error) {
    console.error(`[C2] Failed to trigger availability check for ${bookingReference}:`, error);
    try {
      await getDatabase().run("UPDATE charter_enquiries SET status = 'IntegrationError' WHERE id = ?", [enquiryId]);
    } catch (dbError) {
      console.error(`[C2] Could not mark ${bookingReference} as IntegrationError:`, dbError);
    }
    console.error(`[ALERT] Charter Broker: enquiry ${bookingReference} needs manual follow-up (C2 integration error).`);
  }
}
