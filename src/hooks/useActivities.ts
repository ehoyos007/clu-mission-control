import { useCallback, useEffect, useState } from "react";
import {
  type Activity,
  type ActivityType,
  createActivity,
  getActivities,
  isSupabaseConfigured,
  subscribeToActivities,
} from "@/lib/supabase";

export interface UseActivitiesResult {
  activities: Activity[];
  loading: boolean;
  error: Error | null;
  isConfigured: boolean;
  refresh: () => Promise<void>;
  logActivity: (
    type: ActivityType,
    title: string,
    description?: string,
    metadata?: Record<string, unknown>,
  ) => Promise<Activity | null>;
}

export function useActivities(limit = 50): UseActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const isConfigured = isSupabaseConfigured();

  const refresh = useCallback(async () => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    try {
      const data = await getActivities(limit);
      setActivities(data);
      setError(null);
    } catch (e) {
      setError(
        e instanceof Error ? e : new Error("Failed to fetch activities"),
      );
    } finally {
      setLoading(false);
    }
  }, [isConfigured, limit]);

  // Initial fetch
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!isConfigured) return;

    const subscription = subscribeToActivities((updatedActivities) => {
      setActivities(updatedActivities);
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, [isConfigured]);

  const logActivity = useCallback(
    async (
      type: ActivityType,
      title: string,
      description?: string,
      metadata?: Record<string, unknown>,
    ): Promise<Activity | null> => {
      const result = await createActivity(type, title, description, metadata);
      if (result) {
        await refresh();
      }
      return result;
    },
    [refresh],
  );

  return {
    activities,
    loading,
    error,
    isConfigured,
    refresh,
    logActivity,
  };
}
