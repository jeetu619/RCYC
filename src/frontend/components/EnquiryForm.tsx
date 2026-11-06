import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, submitEnquiry } from '../services/client';
import { useEnquiryForm } from '../hooks/useEnquiryForm';
import { useLiveAvailability } from '../hooks/useLiveAvailability';
import { useYachts } from '../hooks/useYachts';
import { buildPhone, errorsToMap, validateFormStep1, validateFormStep2, validateFormStep3 } from '../../shared/validators';
import type { AlternativeOption, CharterEnquiryRequest, FormStep3Data } from '../../shared/types';
import ProgressBar from './ProgressBar';
import PricingSummary from './PricingSummary';
import LiveStatus from './LiveStatus';
import StepYachtDates from './StepYachtDates';
import StepGuests from './StepGuests';
import StepDetails from './StepDetails';

const STEP_LABELS = ['Yacht & Dates', 'Guests & Preferences', 'Your Details & Review'];
const SUBMIT_ERROR = 'We could not submit your enquiry. Please try again, or contact support if the problem continues.';

/** Keeps adults + children within `max`, preferring to keep at least one adult. */
function fitGuests(adults: number, children: number, max: number) {
  const a = Math.max(1, Math.min(adults, max));
  const c = Math.max(0, Math.min(children, max - a));
  return { numberOfAdultGuests: a, numberOfChildren: c };
}

export default function EnquiryForm() {
  const navigate = useNavigate();
  const { formState, step, setStep, updateStep, updateForm, clearForm } = useEnquiryForm();
  const { yachts, loading: yachtsLoading, error: yachtsError, retry: retryYachts } = useYachts();

  const [attempted, setAttempted] = useState<Record<number, boolean>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  const { step1, step2, step3 } = formState;
  const selectedYacht = yachts.find(y => y.id === step1.yachtId);
  const maxGuests = selectedYacht?.maxGuests;
  const totalGuests = step2.numberOfAdultGuests + step2.numberOfChildren;

  const availability = useLiveAvailability(step1.yachtId, step1.startDate, totalGuests);

  // Once yachts are known, re-validate a restored draft against the selected yacht's capacity.
  useEffect(() => {
    if (!selectedYacht) return;
    const fitted = fitGuests(step2.numberOfAdultGuests, step2.numberOfChildren, selectedYacht.maxGuests);
    if (fitted.numberOfAdultGuests !== step2.numberOfAdultGuests || fitted.numberOfChildren !== step2.numberOfChildren) {
      updateStep('step2', fitted);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedYacht?.id]);

  const stepErrors = useMemo<Record<number, Record<string, string>>>(
    () => ({
      1: errorsToMap(validateFormStep1(step1)),
      2: errorsToMap(validateFormStep2(step2, maxGuests)),
      3: errorsToMap(validateFormStep3(step3))
    }),
    [step1, step2, step3, maxGuests]
  );

  // Inline errors appear after a failed Next; on step 3 also once a field has been visited.
  const visibleErrors: Record<string, string> = {};
  for (const [field, message] of Object.entries(stepErrors[step])) {
    if (attempted[step] || (step === 3 && touched[field])) visibleErrors[field] = message;
  }
  for (const [field, message] of Object.entries(serverErrors)) visibleErrors[field] ||= message;
  const errorList = Object.values(visibleErrors);

  // R-10: all required fields valid AND the live check says Available / OnHold.
  const liveOk =
    !availability.loading && !availability.error && (availability.status === 'Available' || availability.status === 'OnHold');
  const outstanding = Object.values({ ...stepErrors[1], ...stepErrors[2], ...stepErrors[3] });
  const formValid = outstanding.length === 0;
  const canSubmit = formValid && liveOk && !submitting;

  const focusSummary = () => setTimeout(() => summaryRef.current?.focus(), 0);
  const touch = (field: string) => setTouched(t => ({ ...t, [field]: true }));
  const changeStep3 = (patch: Partial<FormStep3Data>) => {
    updateStep('step3', patch);
    setServerErrors({});
  };

  const goNext = () => {
    if (Object.keys(stepErrors[step]).length > 0) {
      setAttempted(a => ({ ...a, [step]: true }));
      focusSummary();
      return;
    }
    setStep(step + 1);
    window.scrollTo?.({ top: 0 });
  };

  const goBack = () => {
    setSubmitError(null);
    setStep(step - 1);
    window.scrollTo?.({ top: 0 });
  };

  const selectYacht = (yachtId: string) => {
    const yacht = yachts.find(y => y.id === yachtId);
    updateForm(form => ({
      ...form,
      step1: { ...form.step1, yachtId },
      // US-06: changing yacht re-validates the guest count against the new capacity.
      step2: yacht
        ? { ...form.step2, ...fitGuests(form.step2.numberOfAdultGuests, form.step2.numberOfChildren, yacht.maxGuests) }
        : form.step2
    }));
  };

  const applyAlternative = (alt: AlternativeOption) => {
    const yacht = yachts.find(y => y.id === alt.yachtId);
    updateForm(form => {
      const children = Math.min(form.step2.numberOfChildren, Math.max(0, alt.numberOfGuests - 1));
      const adults = Math.max(1, alt.numberOfGuests - children);
      return {
        ...form,
        step1: { ...form.step1, yachtId: alt.yachtId, startDate: alt.startDate },
        step2: { ...form.step2, ...(yacht ? fitGuests(adults, children, yacht.maxGuests) : { numberOfAdultGuests: adults, numberOfChildren: children }) }
      };
    });
  };

  const changePhone = (patch: Partial<FormStep3Data>) => {
    const merged = { ...step3, ...patch };
    changeStep3({ ...patch, clientPhone: buildPhone(merged.phoneCountry, merged.phoneNational) });
  };

  const handleSubmit = async () => {
    // Submit validates all steps; jump to the first one with a problem.
    for (const s of [1, 2, 3]) {
      if (Object.keys(stepErrors[s]).length > 0) {
        setAttempted(a => ({ ...a, [s]: true }));
        setStep(s);
        focusSummary();
        return;
      }
    }
    if (!canSubmit) return;

    setSubmitting(true);
    setSubmitError(null);
    setServerErrors({});
    try {
      const request: CharterEnquiryRequest = {
        yachtId: step1.yachtId!,
        startDate: step1.startDate!,
        numberOfAdultGuests: step2.numberOfAdultGuests,
        numberOfChildren: step2.numberOfChildren,
        cruisingArea: step2.cruisingArea!,
        otherCruisingAreaDetails: step2.cruisingArea === 'Other' ? step2.otherCruisingAreaDetails : undefined,
        occasion: step2.occasion || undefined,
        otherOccasionDetails: step2.occasion === 'Other' ? step2.otherOccasionDetails : undefined,
        specialRequests: step2.specialRequests || undefined,
        clientName: step3.clientName!.trim(),
        clientEmail: step3.clientEmail!.trim(),
        clientPhone: step3.clientPhone!,
        privacyConsent: step3.privacyConsent,
        marketingOptIn: step3.marketingOptIn
      };
      const response = await submitEnquiry(request);
      clearForm();
      navigate(`/charter/enquiry/${response.bookingReference}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setServerErrors(errorsToMap(error.details as any));
        setSubmitError(error.details[0]?.message || error.message);
      } else {
        console.error('Submission failed', error);
        setSubmitError(SUBMIT_ERROR);
      }
      focusSummary();
    } finally {
      setSubmitting(false);
    }
  };

  const submitHint = !formValid
    ? `Complete all required fields to enable submission (${outstanding.length} outstanding).`
    : availability.error
      ? 'Submission is disabled until availability can be confirmed.'
      : availability.loading
        ? 'Checking availability…'
        : !liveOk
          ? 'This yacht is not available for the selected dates and guests. Choose an alternative to continue.'
          : '';

  return (
    <div className="enquiry-form-container">
      <ProgressBar currentStep={step} steps={STEP_LABELS} />

      <div className="form-layout">
        <form className="form-content" noValidate onSubmit={e => e.preventDefault()} aria-labelledby={`step-${step}-title`}>
          {(errorList.length > 0 || submitError) && (
            <div className="error-summary" role="alert" tabIndex={-1} ref={summaryRef}>
              <strong>{submitError ? 'We could not submit your enquiry' : 'Please fix the following to continue'}</strong>
              <ul>{submitError ? <li>{submitError}</li> : errorList.map(m => <li key={m}>{m}</li>)}</ul>
            </div>
          )}

          {step === 1 && (
            <StepYachtDates
              yachts={yachts}
              loading={yachtsLoading}
              error={yachtsError}
              onRetry={retryYachts}
              yachtId={step1.yachtId}
              startDate={step1.startDate}
              errors={visibleErrors}
              onSelectYacht={selectYacht}
              onSelectDate={startDate => updateStep('step1', { startDate })}
            />
          )}

          {step === 2 && (
            <StepGuests
              data={step2}
              maxGuests={maxGuests}
              errors={visibleErrors}
              onChange={patch => updateStep('step2', patch)}
            />
          )}

          {step === 3 && (
            <StepDetails
              form={formState}
              yacht={selectedYacht}
              errors={visibleErrors}
              liveStatus={availability.status}
              liveLoading={availability.loading}
              onChange={changeStep3}
              onPhoneChange={changePhone}
              onTouch={touch}
            />
          )}

          <div className="form-actions">
            {step > 1 && (
              <button type="button" className="btn btn-secondary" onClick={goBack} disabled={submitting}>
                Back
              </button>
            )}
            {step < 3 && (
              <button type="button" className="btn btn-primary" onClick={goNext}>
                Next
              </button>
            )}
            {step === 3 && (
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSubmit}
                disabled={!canSubmit}
                aria-describedby="submit-hint"
              >
                {submitting && <span className="spinner light" aria-hidden="true" />}
                {submitting ? 'Submitting…' : submitError ? 'Retry Submit Enquiry' : 'Submit Enquiry'}
              </button>
            )}
          </div>
          {step === 3 && (
            <p id="submit-hint" className="hint submit-hint">
              {submitHint}
            </p>
          )}
        </form>

        <div className="form-sidebar">
          <PricingSummary yacht={selectedYacht} hasDate={!!step1.startDate} />
          {step1.yachtId && step1.startDate && <LiveStatus availability={availability} onApplyAlternative={applyAlternative} />}
        </div>
      </div>
    </div>
  );
}
