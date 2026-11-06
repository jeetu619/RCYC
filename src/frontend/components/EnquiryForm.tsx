import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEnquiryForm } from '../hooks/useEnquiryForm';
import { useLiveAvailability } from '../hooks/useLiveAvailability';
import { getYachts, submitEnquiry } from '../api/client';
import { validateFormStep1, validateFormStep2, validateFormStep3 } from '../../shared/validators';
import ProgressBar from './ProgressBar';
import YachtSelector from './YachtSelector';
import DatePicker from './DatePicker';
import PricingSummary from './PricingSummary';
import type { Yacht } from '../../shared/types';

export default function EnquiryForm() {
  const navigate = useNavigate();
  const { formState, updateStep, clearForm, loaded } = useEnquiryForm();
  const [currentStep, setCurrentStep] = useState(1);
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  React.useEffect(() => {
    getYachts().then(setYachts).catch(console.error);
  }, []);

  const step1Data = formState.step1;
  const step2Data = formState.step2;
  const step3Data = formState.step3;

  const selectedYacht = yachts.find(y => y.id === step1Data.yachtId);
  const totalGuests = step2Data.numberOfAdultGuests + step2Data.numberOfChildren;

  const availability = useLiveAvailability(step1Data.yachtId, step1Data.startDate, totalGuests);
  const canSubmit =
    step1Data.yachtId &&
    step1Data.startDate &&
    step2Data.numberOfAdultGuests > 0 &&
    step2Data.numberOfChildren >= 0 &&
    step2Data.cruisingArea &&
    step3Data.clientName &&
    step3Data.clientEmail &&
    step3Data.clientPhone &&
    step3Data.privacyConsent &&
    (availability.status === 'Available' || availability.status === 'OnHold') &&
    !availability.loading;

  const handleNextStep1 = () => {
    const step1Errors = validateFormStep1(step1Data);
    if (step1Errors.length > 0) {
      const errorMap: Record<string, string> = {};
      step1Errors.forEach(e => (errorMap[e.field] = e.message));
      setErrors(errorMap);
      return;
    }
    setErrors({});
    setCurrentStep(2);
  };

  const handleNextStep2 = () => {
    const step2Errors = validateFormStep2(step2Data);
    if (step2Errors.length > 0) {
      const errorMap: Record<string, string> = {};
      step2Errors.forEach(e => (errorMap[e.field] = e.message));
      setErrors(errorMap);
      return;
    }

    if (selectedYacht && totalGuests > selectedYacht.maxGuests) {
      setErrors({
        numberOfAdultGuests: `Total guests (${totalGuests}) exceeds yacht capacity (${selectedYacht.maxGuests})`
      });
      return;
    }

    setErrors({});
    setCurrentStep(3);
  };

  const handleNextStep3 = () => {
    const step3Errors = validateFormStep3(step3Data);
    if (step3Errors.length > 0) {
      const errorMap: Record<string, string> = {};
      step3Errors.forEach(e => (errorMap[e.field] = e.message));
      setErrors(errorMap);
      return;
    }
    setErrors({});
  };

  const handleSubmit = async () => {
    handleNextStep3();
    if (Object.keys(errors).length > 0) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const endDate = new Date(step1Data.startDate! + 'T00:00:00Z');
      endDate.setUTCDate(endDate.getUTCDate() + 7);

      const enquiry = {
        yachtId: step1Data.yachtId!,
        startDate: step1Data.startDate!,
        endDate: endDate.toISOString().split('T')[0],
        numberOfAdultGuests: step2Data.numberOfAdultGuests,
        numberOfChildren: step2Data.numberOfChildren,
        cruisingArea: step2Data.cruisingArea!,
        otherCruisingAreaDetails: step2Data.otherCruisingAreaDetails,
        occasion: step2Data.occasion,
        otherOccasionDetails: step2Data.otherOccasionDetails,
        specialRequests: step2Data.specialRequests,
        clientName: step3Data.clientName!,
        clientEmail: step3Data.clientEmail!,
        clientPhone: step3Data.clientPhone!,
        privacyConsent: step3Data.privacyConsent,
        marketingOptIn: step3Data.marketingOptIn,
        status: 'Submitted'
      };

      const response = await submitEnquiry(enquiry);
      clearForm();
      navigate(`/charter/enquiry/${response.bookingReference}`);
    } catch (error: any) {
      setSubmitError(error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (!loaded) return <div className="loading">Loading form...</div>;

  return (
    <div className="enquiry-form-container">
      <ProgressBar currentStep={currentStep} totalSteps={3} steps={['Yacht & Dates', 'Guests & Preferences', 'Details & Review']} />

      <div className="form-layout">
        <div className="form-content">
          {currentStep === 1 && (
            <div className="form-step">
              <YachtSelector selectedYachtId={step1Data.yachtId} onSelect={yachtId => updateStep('step1', { yachtId })} />
              <DatePicker
                yachtId={step1Data.yachtId}
                selectedDate={step1Data.startDate}
                onSelect={(startDate, endDate) => updateStep('step1', { startDate })}
              />
              {errors.yachtId && <div className="error-message">{errors.yachtId}</div>}
              {errors.startDate && <div className="error-message">{errors.startDate}</div>}
            </div>
          )}

          {currentStep === 2 && (
            <div className="form-step">
              <h2>Guests & Preferences</h2>
              <div className="form-group">
                <label>Number of Adults</label>
                <input
                  type="number"
                  min="1"
                  max={selectedYacht?.maxGuests || 10}
                  value={step2Data.numberOfAdultGuests}
                  onChange={e => updateStep('step2', { numberOfAdultGuests: parseInt(e.target.value) })}
                />
                <span className="capacity-info">
                  {totalGuests} of {selectedYacht?.maxGuests || 0} guests
                </span>
              </div>

              <div className="form-group">
                <label>Number of Children</label>
                <input
                  type="number"
                  min="0"
                  max={Math.max(0, (selectedYacht?.maxGuests || 10) - step2Data.numberOfAdultGuests)}
                  value={step2Data.numberOfChildren}
                  onChange={e => updateStep('step2', { numberOfChildren: parseInt(e.target.value) })}
                />
              </div>

              <div className="form-group">
                <label>Preferred Cruising Area *</label>
                <select value={step2Data.cruisingArea || ''} onChange={e => updateStep('step2', { cruisingArea: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Côte d'Azur">Côte d'Azur</option>
                  <option value="Amalfi Coast">Amalfi Coast</option>
                  <option value="Greek Islands">Greek Islands</option>
                  <option value="Balearics">Balearics</option>
                  <option value="Croatia">Croatia</option>
                  <option value="Other">Other</option>
                </select>
                {errors.cruisingArea && <div className="error-message">{errors.cruisingArea}</div>}
              </div>

              {step2Data.cruisingArea === 'Other' && (
                <div className="form-group">
                  <label>Please specify cruising area</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={step2Data.otherCruisingAreaDetails || ''}
                    onChange={e => updateStep('step2', { otherCruisingAreaDetails: e.target.value })}
                    placeholder="Enter preferred cruising area"
                  />
                  {errors.otherCruisingAreaDetails && <div className="error-message">{errors.otherCruisingAreaDetails}</div>}
                </div>
              )}

              <div className="form-group">
                <label>Occasion</label>
                <select value={step2Data.occasion || ''} onChange={e => updateStep('step2', { occasion: e.target.value })}>
                  <option value="">Select...</option>
                  <option value="Holiday">Holiday</option>
                  <option value="Birthday">Birthday</option>
                  <option value="Honeymoon">Honeymoon</option>
                  <option value="Corporate">Corporate</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {step2Data.occasion === 'Other' && (
                <div className="form-group">
                  <label>Please specify occasion</label>
                  <input
                    type="text"
                    maxLength={100}
                    value={step2Data.otherOccasionDetails || ''}
                    onChange={e => updateStep('step2', { otherOccasionDetails: e.target.value })}
                    placeholder="Enter occasion"
                  />
                </div>
              )}

              <div className="form-group">
                <label>Special Requests / Dietary Needs</label>
                <textarea
                  maxLength={500}
                  value={step2Data.specialRequests || ''}
                  onChange={e => updateStep('step2', { specialRequests: e.target.value })}
                  placeholder="Any special requests or dietary needs?"
                  rows={4}
                />
              </div>

              {errors.numberOfAdultGuests && <div className="error-message">{errors.numberOfAdultGuests}</div>}
            </div>
          )}

          {currentStep === 3 && (
            <div className="form-step">
              <h2>Your Details & Review</h2>

              <div className="summary-section">
                <h3>Enquiry Summary</h3>
                <div className="summary-item">
                  <span>Yacht:</span>
                  <span>{selectedYacht?.name}</span>
                </div>
                <div className="summary-item">
                  <span>Dates:</span>
                  <span>
                    {new Date(step1Data.startDate! + 'T00:00:00Z').toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric'
                    })}{' '}
                    – 7 nights
                  </span>
                </div>
                <div className="summary-item">
                  <span>Guests:</span>
                  <span>{totalGuests}</span>
                </div>
                <div className="summary-item">
                  <span>Cruising Area:</span>
                  <span>{step2Data.cruisingArea === 'Other' ? step2Data.otherCruisingAreaDetails : step2Data.cruisingArea}</span>
                </div>
                {step2Data.occasion && (
                  <div className="summary-item">
                    <span>Occasion:</span>
                    <span>{step2Data.occasion === 'Other' ? step2Data.otherOccasionDetails : step2Data.occasion}</span>
                  </div>
                )}
              </div>

              <div className="form-group">
                <label>Your Name *</label>
                <input
                  type="text"
                  value={step3Data.clientName || ''}
                  onChange={e => updateStep('step3', { clientName: e.target.value })}
                  placeholder="Enter your name"
                />
                {errors.clientName && <div className="error-message">{errors.clientName}</div>}
              </div>

              <div className="form-group">
                <label>Your Email *</label>
                <input
                  type="email"
                  value={step3Data.clientEmail || ''}
                  onChange={e => updateStep('step3', { clientEmail: e.target.value })}
                  placeholder="Enter your email"
                />
                {errors.clientEmail && <div className="error-message">{errors.clientEmail}</div>}
              </div>

              <div className="form-group">
                <label>Your Phone *</label>
                <input
                  type="tel"
                  value={step3Data.clientPhone || ''}
                  onChange={e => updateStep('step3', { clientPhone: e.target.value })}
                  placeholder="Enter your phone (e.g., +1234567890)"
                />
                {errors.clientPhone && <div className="error-message">{errors.clientPhone}</div>}
              </div>

              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  checked={step3Data.privacyConsent}
                  onChange={e => updateStep('step3', { privacyConsent: e.target.checked })}
                />
                <label>I agree to the Privacy Policy *</label>
                {errors.privacyConsent && <div className="error-message">{errors.privacyConsent}</div>}
              </div>

              <div className="form-group checkbox">
                <input
                  type="checkbox"
                  checked={step3Data.marketingOptIn}
                  onChange={e => updateStep('step3', { marketingOptIn: e.target.checked })}
                />
                <label>I would like to receive marketing communications</label>
              </div>

              {submitError && <div className="error-message">{submitError}</div>}
            </div>
          )}

          <div className="form-actions">
            {currentStep > 1 && (
              <button className="btn btn-secondary" onClick={() => setCurrentStep(currentStep - 1)} disabled={submitting}>
                Back
              </button>
            )}
            {currentStep < 3 && (
              <button className="btn btn-primary" onClick={currentStep === 1 ? handleNextStep1 : handleNextStep2} disabled={submitting}>
                Next
              </button>
            )}
            {currentStep === 3 && (
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!canSubmit || submitting}>
                {submitting ? 'Submitting...' : 'Submit Enquiry'}
              </button>
            )}
          </div>
        </div>

        <div className="form-sidebar">
          <PricingSummary yachtId={step1Data.yachtId} />

          {step1Data.yachtId && step1Data.startDate && (
            <div className="availability-status">
              <h3>Availability Status</h3>
              {availability.loading && <div className="loading">Checking...</div>}
              {availability.status && (
                <>
                  <div className={`status-badge ${availability.status.toLowerCase()}`}>{availability.status}</div>
                  <p>{availability.message}</p>
                </>
              )}
              {availability.error && <div className="error-message">{availability.error}</div>}

              {availability.alternatives.length > 0 && (
                <div className="alternatives">
                  <h4>Alternative Options</h4>
                  {availability.alternatives.map((alt, idx) => (
                    <button
                      key={idx}
                      className="alternative-button"
                      onClick={() => {
                        updateStep('step1', { yachtId: alt.yachtId, startDate: alt.startDate });
                      }}
                    >
                      <div>{alt.yachtName}</div>
                      <div className="alt-reason">{alt.reason}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
