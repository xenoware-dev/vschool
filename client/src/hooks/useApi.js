import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const apiError = (err, fallback) => err?.response?.data?.message || err?.message || fallback;

/**
 * Runs `fetcher` on mount and whenever `deps` change.
 * - `reload()` refetches without blanking the current data (no spinner flash)
 * - responses from superseded requests are ignored
 */
export const useApi = (fetcher, deps = []) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const requestId = useRef(0);

  // Always call the latest fetcher, but only refetch when `deps` change
  const fetcherRef = useRef(fetcher);
  useLayoutEffect(() => {
    fetcherRef.current = fetcher;
  });
  const depsKey = JSON.stringify(deps);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      const id = ++requestId.current;
      if (!silent) setLoading(true);
      try {
        const result = await fetcherRef.current();
        if (id === requestId.current) {
          setData(result);
          setError('');
        }
      } catch (err) {
        if (id === requestId.current) setError(apiError(err, 'Could not load data.'));
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [depsKey]
  );

  useEffect(() => {
    load();
  }, [load]);

  const reload = useCallback(() => load({ silent: true }), [load]);

  return { data, setData, loading, error, reload };
};

// Debounces a fast-changing value (e.g. a search box)
export const useDebounced = (value, delay = 300) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
};
