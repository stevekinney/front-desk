import { useCallback, useEffect, useState } from 'react';

export interface ApiState<T> {
  data: T | undefined;
  error: Error | undefined;
  loading: boolean;
  reload: () => void;
  setData: (data: T) => void;
}

interface Result<T> {
  key: string;
  data?: T;
  error?: Error;
}

/**
 * Load something from the API and reload it on demand. `key` changes trigger
 * a fresh load; pass everything the loader depends on. The previous data
 * stays visible while a reload is in flight.
 */
export function useApi<T>(load: () => Promise<T>, key: string): ApiState<T> {
  const [generation, setGeneration] = useState(0);
  const [result, setResult] = useState<Result<T>>({ key: '' });
  const requestKey = `${key}#${generation}`;

  useEffect(() => {
    let current = true;
    load().then(
      (data) => {
        if (current) setResult({ key: requestKey, data });
      },
      (err: unknown) => {
        if (!current) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setResult((previous) => ({ key: requestKey, data: previous.data, error }));
      },
    );
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for the loader
  }, [requestKey]);

  const reload = useCallback(() => setGeneration((g) => g + 1), []);
  const setData = useCallback((data: T) => setResult((previous) => ({ ...previous, data })), []);

  return {
    data: result.data,
    error: result.error,
    loading: result.key !== requestKey,
    reload,
    setData,
  };
}
