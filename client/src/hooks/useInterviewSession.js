/**
 * @file useInterviewSession.js
 * @description Hook to fetch and track an interview session record by its unique ID.
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchSessionById } from '../api/client';

/**
 * Hook to retrieve and observe an interview session.
 *
 * @param {string|null} sessionId - The session ID to fetch.
 * @returns {{
 *   session: object|null,
 *   loading: boolean,
 *   error: Error|null,
 *   refresh: () => Promise<void>
 * }}
 */
export function useInterviewSession(sessionId) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(Boolean(sessionId));
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!sessionId) {
      setSession(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchSessionById(sessionId);
      setSession(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    session,
    loading,
    error,
    refresh,
  };
}

