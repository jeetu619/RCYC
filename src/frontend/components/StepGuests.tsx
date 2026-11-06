import {
  CRUISING_AREAS,
  MAX_OTHER_DETAILS_LENGTH,
  MAX_SPECIAL_REQUESTS_LENGTH,
  OCCASIONS
} from '../../shared/constants';
import type { FormStep2Data } from '../../shared/types';
import FieldError, { describedBy } from './FieldError';
import Stepper from './Stepper';

interface StepGuestsProps {
  data: FormStep2Data;
  maxGuests?: number;
  errors: Record<string, string>;
  onChange: (patch: Partial<FormStep2Data>) => void;
}

export default function StepGuests({ data, maxGuests, errors, onChange }: StepGuestsProps) {
  const totalGuests = data.numberOfAdultGuests + data.numberOfChildren;
  return (
    <div className="form-step">
      <h2 id="step-2-title">Guests &amp; preferences</h2>

      <div className="guest-summary" aria-live="polite">
        <strong>
          {totalGuests} of {maxGuests ?? '–'} guests
        </strong>
      </div>
      <Stepper
        id="adults"
        label="Number of Adults"
        value={data.numberOfAdultGuests}
        min={1}
        max={maxGuests ? maxGuests - data.numberOfChildren : 99}
        onChange={n => onChange({ numberOfAdultGuests: n })}
        error={errors.numberOfAdultGuests}
      />
      <Stepper
        id="children"
        label="Number of Children"
        value={data.numberOfChildren}
        min={0}
        max={maxGuests ? maxGuests - data.numberOfAdultGuests : 99}
        onChange={n => onChange({ numberOfChildren: n })}
        hint="Children count towards the total guest capacity."
        error={errors.numberOfChildren}
      />

      <div className="form-group">
        <label htmlFor="cruisingArea">Preferred Cruising Area *</label>
        <select
          id="cruisingArea"
          value={data.cruisingArea || ''}
          aria-required="true"
          aria-invalid={!!errors.cruisingArea}
          aria-describedby={describedBy('cruisingArea', errors.cruisingArea)}
          onChange={e => onChange({ cruisingArea: e.target.value })}
        >
          <option value="">Select…</option>
          {CRUISING_AREAS.map(a => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <FieldError field="cruisingArea" message={errors.cruisingArea} />
      </div>

      {data.cruisingArea === 'Other' && (
        <div className="form-group">
          <label htmlFor="otherCruisingAreaDetails">Please specify your cruising area *</label>
          <input
            id="otherCruisingAreaDetails"
            type="text"
            maxLength={MAX_OTHER_DETAILS_LENGTH}
            value={data.otherCruisingAreaDetails || ''}
            aria-invalid={!!errors.otherCruisingAreaDetails}
            aria-describedby={describedBy('otherCruisingAreaDetails', errors.otherCruisingAreaDetails)}
            onChange={e => onChange({ otherCruisingAreaDetails: e.target.value })}
          />
          <FieldError field="otherCruisingAreaDetails" message={errors.otherCruisingAreaDetails} />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="occasion">Occasion</label>
        <select id="occasion" value={data.occasion || ''} onChange={e => onChange({ occasion: e.target.value })}>
          <option value="">Select…</option>
          {OCCASIONS.map(o => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </div>

      {data.occasion === 'Other' && (
        <div className="form-group">
          <label htmlFor="otherOccasionDetails">Please specify the occasion *</label>
          <input
            id="otherOccasionDetails"
            type="text"
            maxLength={MAX_OTHER_DETAILS_LENGTH}
            value={data.otherOccasionDetails || ''}
            aria-invalid={!!errors.otherOccasionDetails}
            aria-describedby={describedBy('otherOccasionDetails', errors.otherOccasionDetails)}
            onChange={e => onChange({ otherOccasionDetails: e.target.value })}
          />
          <FieldError field="otherOccasionDetails" message={errors.otherOccasionDetails} />
        </div>
      )}

      <div className="form-group">
        <label htmlFor="specialRequests">Special Requests / Dietary Needs</label>
        <textarea
          id="specialRequests"
          maxLength={MAX_SPECIAL_REQUESTS_LENGTH}
          rows={4}
          value={data.specialRequests || ''}
          aria-describedby="specialRequests-count"
          onChange={e => onChange({ specialRequests: e.target.value })}
        />
        <div id="specialRequests-count" className="hint char-count">
          {(data.specialRequests || '').length} / {MAX_SPECIAL_REQUESTS_LENGTH}
        </div>
        <FieldError field="specialRequests" message={errors.specialRequests} />
      </div>
    </div>
  );
}
