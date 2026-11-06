import { useState, useEffect } from 'react';
import type { FormState } from '../../shared/types';

const STORAGE_KEY = 'charter-enquiry-form';

const defaultFormState: FormState = {
  step1: {},
  step2: {
    numberOfAdultGuests: 1,
    numberOfChildren: 0
  },
  step3: {
    privacyConsent: false,
    marketingOptIn: false
  }
};

export function useEnquiryForm() {
  const [formState, setFormState] = useState<FormState>(defaultFormState);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setFormState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse form state', e);
      }
    }
    setLoaded(true);
  }, []);

  const saveFormState = (newState: FormState) => {
    setFormState(newState);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newState));
  };

  const updateStep = (step: keyof FormState, data: Partial<FormState[keyof FormState]>) => {
    const updated = {
      ...formState,
      [step]: { ...formState[step], ...data }
    };
    saveFormState(updated);
  };

  const clearForm = () => {
    setFormState(defaultFormState);
    localStorage.removeItem(STORAGE_KEY);
  };

  return {
    formState,
    updateStep,
    clearForm,
    saveFormState,
    loaded
  };
}
