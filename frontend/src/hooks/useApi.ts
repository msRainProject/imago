import { useCallback, useEffect, useState } from 'react';
import { HttpError } from '@api/client';

/**
 * Generic data-fetching hook.
 *
 * - `idle`   : nothing fetched yet
 * - `loading`: in flight
 * - `success`: completed with data
 * - `error`  : failed (HttpError attached)
 */
export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  error: HttpError | Error | null;
}

export interface UseApiResult<T> extends AsyncState<T> {
  refetch: () => void;
  setData: (updater: T | null | ((prev: T | null) => T | null)) => void;
}

export function useApi<T>(loader: () => Promise<T>, deps: unknown[] = []): UseApiResult<T> {
  const [state, setState] = useState<AsyncState<T>>({
    status: 'idle',
    data: null,
    error: null,
  });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, status: 'loading', error: null }));
    loader()
      .then((data) => {
        if (!cancelled) setState({ status: 'success', data, error: null });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const error = err instanceof Error ? err : new Error(String(err));
        setState({ status: 'error', data: null, error });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback(
    (updater: T | null | ((prev: T | null) => T | null)) => {
      setState((s) => ({
        ...s,
        data: typeof updater === 'function' ? (updater as (p: T | null) => T | null)(s.data) : updater,
      }));
    },
    [],
  );

  return { ...state, refetch, setData };
}
