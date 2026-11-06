import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEnquiryDetails } from '../api/client';

export default function ConfirmationPage() {
  const { reference } = useParams<{ reference: string }>();
  const navigate = useNavigate();
  const [enquiry, setEnquiry] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadEnquiry = async () => {
      if (!reference) {
        setError('No enquiry reference provided');
        setLoading(false);
        return;
      }

      try {
        const data = await getEnquiryDetails(reference);
        setEnquiry(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadEnquiry();
  }, [reference]);

  const handlePrint = () => {
    window.print();
  };

  const handleAddToCalendar = () => {
    if (!enquiry) return;

    const start = new Date(enquiry.startDate + 'T00:00:00Z');
    const end = new Date(enquiry.endDate + 'T23:59:59Z');

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Charter Enquiry//EN',
      'BEGIN:VEVENT',
      `DTSTART:${start.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `DTEND:${end.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')}`,
      `SUMMARY:Charter: ${enquiry.yachtName}`,
      `DESCRIPTION:Booking Reference: ${enquiry.bookingReference}\\nGuests: ${enquiry.guests}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `charter-${reference}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  if (loading) return <div className="page"><div className="loading">Loading confirmation...</div></div>;
  if (error) return <div className="page"><div className="error">Error: {error}</div></div>;
  if (!enquiry) return <div className="page"><div className="error">Enquiry not found</div></div>;

  return (
    <div className="page confirmation-page">
      <header className="page-header">
        <h1>Enquiry Confirmed</h1>
        <p>Thank you for your submission!</p>
      </header>

      <main className="confirmation-content">
        <div className="confirmation-card">
          <div className="reference-box">
            <h2>Your Booking Reference</h2>
            <div className="reference-number">{enquiry.bookingReference}</div>
          </div>

          <div className="enquiry-details">
            <h3>Enquiry Details</h3>
            <div className="detail-row">
              <span>Yacht:</span>
              <strong>{enquiry.yachtName}</strong>
            </div>
            <div className="detail-row">
              <span>Dates:</span>
              <strong>{enquiry.dates}</strong>
            </div>
            <div className="detail-row">
              <span>Guests:</span>
              <strong>{enquiry.guests}</strong>
            </div>
            <div className="detail-row">
              <span>Cruising Area:</span>
              <strong>{enquiry.cruisingArea}</strong>
            </div>
            {enquiry.occasion && (
              <div className="detail-row">
                <span>Occasion:</span>
                <strong>{enquiry.occasion}</strong>
              </div>
            )}
            <div className="detail-row">
              <span>Status:</span>
              <strong className={`status-${enquiry.status.toLowerCase()}`}>{enquiry.status}</strong>
            </div>
          </div>

          <div className="what-happens-next">
            <h3>What Happens Next</h3>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-marker">1</div>
                <div className="timeline-content">
                  <h4>Quote by Email</h4>
                  <p>You'll receive a detailed quote within 24 hours</p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-marker">2</div>
                <div className="timeline-content">
                  <h4>Yacht Held for You</h4>
                  <p>Your selected dates will be temporarily held</p>
                </div>
              </div>
              <div className="timeline-item">
                <div className="timeline-marker">3</div>
                <div className="timeline-content">
                  <h4>Pay Deposit to Confirm</h4>
                  <p>Secure your booking with a 50% deposit</p>
                </div>
              </div>
            </div>
          </div>

          <div className="confirmation-actions">
            <button className="btn btn-primary" onClick={handleAddToCalendar}>
              📅 Add to Calendar
            </button>
            <button className="btn btn-secondary" onClick={handlePrint}>
              🖨️ Print
            </button>
            <button className="btn btn-secondary" onClick={() => navigate('/charter/enquiry')}>
              New Enquiry
            </button>
          </div>
        </div>

        <div className="contact-info">
          <h3>Questions?</h3>
          <p>Our team is ready to help. Contact us at any time.</p>
          <p>Email: info@charter-enquiry.com</p>
        </div>
      </main>
    </div>
  );
}
