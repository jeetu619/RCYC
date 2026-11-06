import { useCallback, useEffect, useState } from 'react';
import type { FormState } from '../../shared/types';

export const STORAGE_KEY = 'charter-enquiry-draft-v1';

export const defaultFormState = (): FormState => ({
  step1: {},
  step2: { numberOfAdultGuests: 1, numberOfChildren: 0 },
  step3: { privacyConsent: false, marketingOptIn: false, phoneCountry: '+44' }
});

interface Draft {
  form: FormState;
  step: number;
}

function loadDraft(): Draft {
  const fresh: Draft = { form: defaultFormState(), step: 1 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fresh;
    const parsed = JSON.parse(raw);
    const defaults = defaultFormState();
    const step = Number(parsed?.step);
    return {
      form: {
        step1: { ...defaults.step1, ...parsed?.form?.step1 },
        step2: { ...defaults.step2, ...parsed?.form?.step2 },
        step3: { ...defaults.step3, ...parsed?.form?.step3 }
      },
      step: step >= 1 && step <= 3 ? step : 1
    };
  } catch {
    return fresh;
  }
}

/**
 * Wizard state saved to localStorage after every change, so a refresh (or returning later)
 * restores the entered data and the step the client was on.
 */
export function useEnquiryForm() {
  const [draft, setDraft] = useState<Draft>(loadDraft);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* storage unavailable or full: the form still works, it just won't survive a refresh */
    }
  }, [draft]);

  const updateStep = useCallback(
    <K extends keyof FormState>(step: K, data: Partial<FormState[K]>) =>
      setDraft(d => ({ ...d, form: { ...d.form, [step]: { ...d.form[step], ...data } } })),
    []
  );

  const updateForm = useCallback(
    (updater: (form: FormState) => FormState) => setDraft(d => ({ ...d, form: updater(d.form) })),
    []
  );

  const setStep = useCallback((step: number) => setDraft(d => ({ ...d, step })), []);

  const clearForm = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setDraft({ form: defaultFormState(), step: 1 });
  }, []);

  return { formState: draft.form, step: draft.step, setStep, updateStep, updateForm, clearForm };
}
