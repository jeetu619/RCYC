import { formatDateRange } from '../../shared/dates';
import type { LiveAvailability } from '../hooks/useLiveAvailability';
import type { AlternativeOption, LiveCheckStatus } from '../../shared/types';

export const STATUS_LABEL: Record<LiveCheckStatus, string> = {
  Available: 'Available',
  OnHold: 'On hold – may become free',
  Booked: 'Booked',
  CapacityExceeded: 'Too many guests for this yacht'
};

const STATUS_TONE: Record<LiveCheckStatus, string> = {
  Available: 'green',
  OnHold: 'amber',
  Booked: 'red',
  CapacityExceeded: 'red'
};

export function StatusBadge({ status }: { status: LiveCheckStatus }) {
  return (
    <span className={`live-badge ${STATUS_TONE[status]}`} data-status={status}>
      {STATUS_LABEL[status]}
    </span>
  );
}

interface LiveStatusProps {
  availability: LiveAvailability;
  onApplyAlternative: (alternative: AlternativeOption) => void;
  yachtNames?: Record<string, string>;
}

/** Live availability badge plus up to 3 alternatives (US-08, US-09). Announced to screen readers. */
export default function LiveStatus({ availability, onApplyAlternative }: LiveStatusProps) {
  const { status, message, alternatives, loading, error, retry } = availability;
  return (
    <section className="availability-status" aria-labelledby="availability-heading" aria-live="polite">
      <h3 id="availability-heading">Availability</h3>
      {loading && (
        <div className="loading" role="status">
          <span className="spinner" aria-hidden="true" /> Checking availability…
        </div>
      )}
      {error && (
        <div className="error-message" role="alert">
          {error}{' '}
          <button type="button" className="link-button" onClick={retry}>
            Retry
          </button>
        </div>
      )}
      {!loading && status && (
        <>
          <StatusBadge status={status} />
          <p className="live-message">{message}</p>
        </>
      )}
      {!loading && alternatives.length > 0 && (
        <div className="alternatives">
          <h4>Alternative options</h4>
          <ul>
            {alternatives.slice(0, 3).map(alt => (
              <li key={`${alt.yachtId}-${alt.startDate}`}>
                <div>
                  <strong>{alt.yachtName}</strong>
                  <div className="alt-dates">{formatDateRange(alt.startDate, alt.endDate)}</div>
                  <div className="alt-reason">
                    {alt.reason} · {alt.numberOfGuests} {alt.numberOfGuests === 1 ? 'guest' : 'guests'}
                  </div>
                </div>
                <button type="button" className="btn btn-secondary btn-small" onClick={() => onApplyAlternative(alt)}>
                  Apply Alternative
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
