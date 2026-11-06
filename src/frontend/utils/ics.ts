import type { EnquiryConfirmation } from '../../shared/types';

const escapeText = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const compactDate = (iso: string) => iso.replace(/-/g, '');

/** All-day iCalendar event for the charter week (DTEND is exclusive, so it is the end date itself). */
export function buildIcs(enquiry: EnquiryConfirmation, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Charter Enquiry//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${enquiry.bookingReference}@charter-enquiry`,
    `DTSTAMP:${stamp}`,
    `DTSTART;VALUE=DATE:${compactDate(enquiry.startDate)}`,
    `DTEND;VALUE=DATE:${compactDate(enquiry.endDate)}`,
    `SUMMARY:${escapeText(`Yacht charter: ${enquiry.yachtName}`)}`,
    `DESCRIPTION:${escapeText(`Enquiry ${enquiry.bookingReference}\n${enquiry.guests} guests\n${enquiry.cruisingArea}`)}`,
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');
}

export function downloadIcs(enquiry: EnquiryConfirmation) {
  const blob = new Blob([buildIcs(enquiry)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `charter-${enquiry.bookingReference}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
