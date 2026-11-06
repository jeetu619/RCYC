import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ApiError, getEnquiryDetails } from '../services/client';
import { downloadIcs } from '../utils/ics';
import type { EnquiryConfirmation } from '../../shared/types';

const TIMELINE = [
  { title: 'Quote by email', text: 'We send your personalised quote to the email address you provided.' },
  { title: 'Yacht held for you', text: 'Once you accept, we hold the yacht for your dates.' },
  { title: 'Pay deposit to confirm', text: 'Secure the charter with the 50% deposit.' }
];

const STATUS_LABEL: Record<string, string> = {
  OnHold: 'On hold',
  CapacityExceeded: 'Capacity exceeded',
  IntegrationError: 'Under review'
};

export default function ConfirmationPage() {
  const { reference } = useParams<{ reference: string }>();
  const [enquiry, setEnquiry] = useState<EnquiryConfirmation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getEnquiryDetails(reference ?? '')
      .then(data => !cancelled && setEnquiry(data))
      .catch(err => {
        if (cancelled) return;
        setError(
          err instanceof ApiError && err.status === 404
            ? 'We could not find that enquiry. Please check the reference and try again.'
            : 'We could not load your enquiry right now.'
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [reference, attempt]);

  if (loading) {
    return (
      <div className="page">
        <main id="main" className="confirmation-content">
          <div className="loading" role="status">
            <span className="spinner" aria-hidden="true" /> Loading your enquiry…
          </div>
        </main>
      </div>
    );
  }

  if (error || !enquiry) {
    return (
      <div className="page">
        <main id="main" className="confirmation-content">
          <div className="error-summary" role="alert">
            <strong>{error ?? 'Enquiry not found'}</strong>
            <div className="error-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setAttempt(a => a + 1)}>
                Retry
              </button>
              <Link className="btn btn-primary" to="/charter/enquiry">
                Return to the enquiry form
              </Link>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const area = enquiry.cruisingArea === 'Other' && enquiry.otherCruisingAreaDetails ? enquiry.otherCruisingAreaDetails : enquiry.cruisingArea;
  const statusLabel = STATUS_LABEL[enquiry.status] ?? enquiry.status;

  return (
    <div className="page confirmation-page">
      <header className="page-header">
        <h1>Thank you – your enquiry has been received</h1>
        <p>We have recorded your request and will be in touch shortly.</p>
      </header>

      <main id="main" className="confirmation-content">
        <section className="confirmation-card" aria-labelledby="ref-heading">
          <div className="reference-box">
            <h2 id="ref-heading">Your Enquiry Reference</h2>
            <div className="reference-number" data-testid="booking-reference">
              {enquiry.bookingReference}
            </div>
          </div>

          <dl className="enquiry-details">
            <div className="detail-row">
              <dt>Yacht</dt>
              <dd>{enquiry.yachtName}</dd>
            </div>
            <div className="detail-row">
              <dt>Dates</dt>
              <dd>{enquiry.dates}</dd>
            </div>
            <div className="detail-row">
              <dt>Guests</dt>
              <dd>{enquiry.guests} guests</dd>
            </div>
            <div className="detail-row">
              <dt>Cruising Area</dt>
              <dd>{area}</dd>
            </div>
            <div className="detail-row">
              <dt>Status</dt>
              <dd>
                <span className={`chip chip-${enquiry.status.toLowerCase()}`}>{statusLabel}</span>
              </dd>
            </div>
          </dl>

          <section className="what-happens-next" aria-labelledby="next-heading">
            <h3 id="next-heading">What happens next</h3>
            <ol className="timeline">
              {TIMELINE.map((item, i) => (
                <li key={item.title} className="timeline-item">
                  <span className="timeline-marker">{i + 1}</span>
                  <div>
                    <h4>{item.title}</h4>
                    <p>{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <div className="confirmation-actions no-print">
            <button type="button" className="btn btn-primary" onClick={() => downloadIcs(enquiry)}>
              Add to Calendar
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
              Print
            </button>
            <Link className="btn btn-secondary" to="/charter/enquiry">
              New enquiry
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
