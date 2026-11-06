import { formatDateRange } from '../../shared/dates';

export interface ConfirmationEmail {
  to: string;
  bookingReference: string;
  yachtName: string;
  startDate: string;
  endDate: string;
  guests: number;
  cruisingArea: string;
}

export type Notifier = (email: ConfirmationEmail) => Promise<void>;

/**
 * "Charter Enquiry Submitted" notification (spec §9). No mail provider is wired up in this
 * component, so the message is written to the log; swap this function for a real sender.
 */
export const logConfirmationEmail: Notifier = async email => {
  console.log(
    [
      `[EMAIL] To: ${email.to}`,
      `Subject: Your charter enquiry ${email.bookingReference}`,
      `${email.yachtName} · ${formatDateRange(email.startDate, email.endDate)} · ${email.guests} guests · ${email.cruisingArea}`,
      'What happens next: Quote by email → Yacht held for you → Pay deposit to confirm'
    ].join('\n  ')
  );
};
