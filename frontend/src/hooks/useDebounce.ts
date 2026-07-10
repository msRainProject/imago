import { useEffect, useState } from 'react';

/**
 * Return `value` after it has stayed stable for `delay` ms.
 * Use for debouncing text inputs (search, rename, etc.).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
