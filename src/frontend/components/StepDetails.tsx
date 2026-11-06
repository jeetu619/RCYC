import { COUNTRY_CODES } from '../../shared/constants';
import { formatDateRange } from '../../shared/dates';
import type { FormState, FormStep3Data, LiveCheckStatus, Yacht } from '../../shared/types';
import FieldError, { describedBy } from './FieldError';
import { StatusBadge } from './LiveStatus';

interface StepDetailsProps {
  form: FormState;
  yacht?: Yacht;
  errors: Record<string, string>;
  liveStatus: LiveCheckStatus | null;
  liveLoading: boolean;
  onChange: (patch: Partial<FormStep3Data>) => void;
  onPhoneChange: (patch: Partial<FormStep3Data>) => void;
  onTouch: (field: string) => void;
}

export default function StepDetails({
  form,
  yacht,
  errors,
  liveStatus,
  liveLoading,
  onChange,
  onPhoneChange,
  onTouch
}: StepDetailsProps) {
  const { step1, step2, step3 } = form;
  const totalGuests = step2.numberOfAdultGuests + step2.numberOfChildren;

  return (
    <div className="form-step">
      <h2 id="step-3-title">Your details &amp; review</h2>

      <div className="summary-section" aria-label="Enquiry summary">
        <h3>Enquiry summary</h3>
        <div className="summary-item">
          <span>Yacht</span>
          <strong>{yacht?.name}</strong>
        </div>
        <div className="summary-item">
          <span>Dates</span>
          <strong>{step1.startDate && formatDateRange(step1.startDate)}</strong>
        </div>
        <div className="summary-item">
          <span>Guests</span>
          <strong>
            {totalGuests} ({step2.numberOfAdultGuests} adults, {step2.numberOfChildren} children)
          </strong>
        </div>
        <div className="summary-item">
          <span>Cruising area</span>
          <strong>{step2.cruisingArea === 'Other' ? step2.otherCruisingAreaDetails : step2.cruisingArea}</strong>
        </div>
        {step2.occasion && (
          <div className="summary-item">
            <span>Occasion</span>
            <strong>{step2.occasion === 'Other' ? step2.otherOccasionDetails : step2.occasion}</strong>
          </div>
        )}
        {step2.specialRequests && (
          <div className="summary-item">
            <span>Special requests</span>
            <strong>{step2.specialRequests}</strong>
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="clientName">Your Name *</label>
        <input
          id="clientName"
          type="text"
          autoComplete="name"
          maxLength={100}
          value={step3.clientName || ''}
          aria-required="true"
          aria-invalid={!!errors.clientName}
          aria-describedby={describedBy('clientName', errors.clientName)}
          onBlur={() => onTouch('clientName')}
          onChange={e => onChange({ clientName: e.target.value })}
        />
        <FieldError field="clientName" message={errors.clientName} />
      </div>

      <div className="form-group">
        <label htmlFor="clientEmail">Your Email *</label>
        <input
          id="clientEmail"
          type="email"
          autoComplete="email"
          value={step3.clientEmail || ''}
          aria-required="true"
          aria-invalid={!!errors.clientEmail}
          aria-describedby={describedBy('clientEmail', errors.clientEmail)}
          onBlur={() => onTouch('clientEmail')}
          onChange={e => onChange({ clientEmail: e.target.value })}
        />
        <FieldError field="clientEmail" message={errors.clientEmail} />
      </div>

      <div className="form-group">
        <label htmlFor="phoneNational">Your Phone Number *</label>
        <div className="phone-row">
          <select
            aria-label="Country code"
            value={step3.phoneCountry || '+44'}
            onChange={e => onPhoneChange({ phoneCountry: e.target.value })}
          >
            {COUNTRY_CODES.map(c => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            id="phoneNational"
            type="tel"
            autoComplete="tel-national"
            value={step3.phoneNational || ''}
            aria-required="true"
            aria-invalid={!!errors.clientPhone}
            aria-describedby={describedBy('clientPhone', errors.clientPhone)}
            onBlur={() => onTouch('clientPhone')}
            onChange={e => onPhoneChange({ phoneNational: e.target.value })}
          />
        </div>
        <FieldError field="clientPhone" message={errors.clientPhone} />
      </div>

      <div className="form-group checkbox">
        <input
          id="privacyConsent"
          type="checkbox"
          checked={step3.privacyConsent}
          aria-required="true"
          aria-invalid={!!errors.privacyConsent}
          aria-describedby={describedBy('privacyConsent', errors.privacyConsent)}
          onChange={e => {
            onChange({ privacyConsent: e.target.checked });
            onTouch('privacyConsent');
          }}
        />
        <label htmlFor="privacyConsent">I agree to the Privacy Policy *</label>
      </div>
      <FieldError field="privacyConsent" message={errors.privacyConsent} />

      <div className="form-group checkbox">
        <input
          id="marketingOptIn"
          type="checkbox"
          checked={step3.marketingOptIn}
          onChange={e => onChange({ marketingOptIn: e.target.checked })}
        />
        <label htmlFor="marketingOptIn">I would like to receive marketing communications</label>
      </div>

      <div className="submit-status" aria-live="polite">
        {liveStatus && !liveLoading && <StatusBadge status={liveStatus} />}
        {liveLoading && <span className="hint">Checking availability…</span>}
      </div>
    </div>
  );
}
