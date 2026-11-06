import { useCallback, useEffect, useState } from 'react';
import { getYachts } from '../api/client';
import type { Yacht } from '../../shared/types';

export function useYachts() {
  const [yachts, setYachts] = useState<Yacht[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getYachts()
      .then(data => !cancelled && setYachts(data))
      .catch(err => {
        console.error('Could not load yachts', err);
        if (!cancelled) setError('Could not load yachts');
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt(a => a + 1), []);
  return { yachts, loading, error, retry };
}
