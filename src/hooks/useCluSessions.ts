import { useCallback, useEffect, useState } from "react";
import {
  type CluSession,
  type CluSessionUpdate,
  getCluSessionBySessionId,
  getCluSessions,
  isSupabaseConfigured,
  markSessionAsClu,
  subscribeToCluSessions,
  updateCluSession,
} from "@/lib/supabase";

export interface UseCluSessionsResult {
  sessions: CluSession[];
  loading: boolean;
  error: Error | null;
  isConfigured: boolean;
  refresh: () => Promise<void>;
  getSessionOwner: (sessionId: string) => CluSession | undefined;
  markAsClu: (
    sessionId: string,
    projectPath: string,
  ) => Promise<CluSession | null>;
  updateSession: (
    id: string,
    updates: CluSessionUpdate,
  ) => Promise<CluSession | null>;
}

export function useCluSessions(): UseCluSessionsResult {
  const [sessions, setSessions] = useState<CluSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isConfigured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    try {
      const data = await getCluSessions();
      setSessions(data);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e : new Error("Failed to fetch sessions"));
    } finally {
      setLoading(false);
    }
  }, [isConfigured]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isConfigured) return;

    const subscription = subscribeToCluSessions((updatedSessions) => {
      setSessions(updatedSessions);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [isConfigured]);

  const getSessionOwner = useCallback(
    (sessionId: string): CluSession | undefined => {
      return sessions.find((s) => s.session_id === sessionId);
    },
    [sessions],
  );

  const markAsClu = useCallback(
    async (
      sessionId: string,
      projectPath: string,
    ): Promise<CluSession | null> => {
      const result = await markSessionAsClu(sessionId, projectPath);
      if (result) {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  const updateSession = useCallback(
    async (
      id: string,
      updates: CluSessionUpdate,
    ): Promise<CluSession | null> => {
      const result = await updateCluSession(id, updates);
      if (result) {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  return {
    sessions,
    loading,
    error,
    isConfigured,
    refresh,
    getSessionOwner,
    markAsClu,
    updateSession,
  };
}

// Hook to get a single session's Clu status
export function useCluSession(sessionId: string | undefined) {
  const [session, setSession] = useState<CluSession | null>(null);
  const [loading, setLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  useEffect(() => {
    if (!sessionId || !isConfigured) {
      setLoading(false);
      return;
    }

    getCluSessionBySessionId(sessionId)
      .then(setSession)
      .finally(() => setLoading(false));
  }, [sessionId, isConfigured]);

  return {
    session,
    loading,
    isConfigured,
    isCluOwned: session?.owner_type === "clu",
  };
}
