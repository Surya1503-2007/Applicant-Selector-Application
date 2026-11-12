/**
 * @file useAsync.js
 * @description Generic asynchronous execution hook managing loading, error, and data states.
 */

import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * Custom hook to execute asynchronous functions with normalized state tracking.
 *
 * @param {Function} asyncFunction - An asynchronous function returning a Promise.
 * @param {boolean} [immediate=false] - Whether to invoke the asyncFunction immediately upon mount.
 * @returns {{
 *   data: any,
 *   loading: boolean,
 *   error: Error|null,
 *   execute: (...args: any[]) => Promise<any>,
 *   setData: import('react').Dispatch<any>,
 *   reset: () => void
 * }}
 */
export function useAsync(asyncFunction, immediate = false) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(immediate);
  const [error, setError] = useState(null);

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);

      try {
        const result = await asyncFunction(...args);
        if (isMountedRef.current) {
          setData(result);
          setLoading(false);
        }
        return result;
      } catch (err) {
        if (isMountedRef.current) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setLoading(false);
        }
        throw err;
      }
    },
    [asyncFunction]
  );

  const reset = useCallback(() => {
    setData(null);
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return {
    data,
    loading,
    error,
    execute,
    setData,
    reset,
  };
}

