import { useCallback, useEffect, useState } from 'react';
import { checkLiveAvailability } from '../services/client';
import { LIVE_CHECK_DEBOUNCE_MS } from '../../shared/constants';
import type { AlternativeOption, LiveCheckStatus } from '../../shared/types';

export interface LiveAvailability {
  status: LiveCheckStatus | null;
  message: string;
  alternatives: AlternativeOption[];
  /** True from the moment inputs change until the matching response has arrived. */
  loading: boolean;
  error: string | null;
  retry: () => void;
}

interface Settled {
  key: string | null;
  data?: { status: LiveCheckStatus; message: string; alternatives: AlternativeOption[] };
  error?: string;
}

export const LIVE_CHECK_ERROR = 'Could not check availability. Please try again.';

/**
 * Debounced (400 ms) call to API-04. A result only counts when it belongs to the current inputs,
 * so a stale 'Available' can never enable submission after the yacht/date/guests have changed.
 */
export function useLiveAvailability(
  yachtId: string | undefined,
  startDate: string | undefined,
  numberOfGuests: number
): LiveAvailability {
  const key = yachtId && startDate && numberOfGuests > 0 ? `${yachtId}|${startDate}|${numberOfGuests}` : null;
  const [settled, setSettled] = useState<Settled>({ key: null });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!key) {
      setSettled({ key: null });
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await checkLiveAvailability({ yachtId: yachtId!, startDate: startDate!, numberOfGuests });
        if (!cancelled) setSettled({ key, data });
      } catch (error) {
        console.error('Live availability check failed', error);
        if (!cancelled) setSettled({ key, error: LIVE_CHECK_ERROR });
      }
    }, LIVE_CHECK_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt]);

  const retry = useCallback(() => {
    setSettled({ key: null });
    setAttempt(a => a + 1);
  }, []);

  const current = settled.key === key && key !== null ? settled : null;
  return {
    status: current?.data?.status ?? null,
    message: current?.data?.message ?? '',
    alternatives: current?.data?.alternatives ?? [],
    loading: key !== null && current === null,
    error: current?.error ?? null,
    retry
  };
}
