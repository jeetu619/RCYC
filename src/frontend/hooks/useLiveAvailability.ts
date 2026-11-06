import { useState, useEffect, useRef } from 'react';
import { checkLiveAvailability } from '../api/client';
import type { LiveCheckStatus, AlternativeOption } from '../../shared/types';

interface UseLiveAvailabilityResult {
  status: LiveCheckStatus | null;
  message: string;
  alternatives: AlternativeOption[];
  loading: boolean;
  error: string | null;
}

export function useLiveAvailability(
  yachtId: string | undefined,
  startDate: string | undefined,
  numberOfGuests: number
): UseLiveAvailabilityResult {
  const [result, setResult] = useState<UseLiveAvailabilityResult>({
    status: null,
    message: '',
    alternatives: [],
    loading: false,
    error: null
  });

  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!yachtId || !startDate || numberOfGuests === 0) {
      setResult({
        status: null,
        message: '',
        alternatives: [],
        loading: false,
        error: null
      });
      return;
    }

    const checkAvailability = async () => {
      setResult(prev => ({ ...prev, loading: true, error: null }));
      try {
        const response = await checkLiveAvailability({
          yachtId,
          startDate,
          numberOfGuests
        });
        setResult({
          status: response.status,
          message: response.message,
          alternatives: response.alternatives,
          loading: false,
          error: null
        });
      } catch (error: any) {
        setResult(prev => ({
          ...prev,
          loading: false,
          error: error.message
        }));
      }
    };

    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(checkAvailability, 400);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [yachtId, startDate, numberOfGuests]);

  return result;
}
