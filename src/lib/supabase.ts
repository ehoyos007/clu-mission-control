import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Environment validation
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as
  | string
  | undefined;

// Create client only if credentials are provided
export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return !!supabase;
};

// ============================================================================
// CLU SESSIONS
// ============================================================================

export type CluSessionOwner = "clu" | "user";
export type CluSessionStatus = "running" | "paused" | "completed" | "error";

export interface CluSession {
  id: string;
  session_id: string;
  project_path: string;
  owner_type: CluSessionOwner;
  status: CluSessionStatus;
  task_id: string | null;
  started_at: string;
  ended_at: string | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export type CluSessionInsert = Omit<CluSession, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type CluSessionUpdate = Partial<Omit<CluSession, "id" | "created_at">>;

// Get all Clu sessions
export async function getCluSessions(): Promise<CluSession[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("clu_sessions")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch Clu sessions:", error);
    return [];
  }
  return (data || []) as CluSession[];
}

// Get Clu session by Claude Code session ID
export async function getCluSessionBySessionId(
  sessionId: string,
): Promise<CluSession | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clu_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .single();

  if (error) {
    if (error.code !== "PGRST116") {
      // Not found is OK
      console.error("Failed to fetch Clu session:", error);
    }
    return null;
  }
  return data as CluSession;
}

// Create a new Clu session
export async function createCluSession(
  session: CluSessionInsert,
): Promise<CluSession | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clu_sessions")
    .insert(session)
    .select()
    .single();

  if (error) {
    console.error("Failed to create Clu session:", error);
    return null;
  }
  return data as CluSession;
}

// Update a Clu session
export async function updateCluSession(
  id: string,
  updates: CluSessionUpdate,
): Promise<CluSession | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("clu_sessions")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Failed to update Clu session:", error);
    return null;
  }
  return data as CluSession;
}

// Mark a session as Clu-owned
export async function markSessionAsClu(
  sessionId: string,
  projectPath: string,
): Promise<CluSession | null> {
  // First check if it already exists
  const existing = await getCluSessionBySessionId(sessionId);
  if (existing) {
    return updateCluSession(existing.id, { owner_type: "clu" });
  }

  // Create new
  return createCluSession({
    session_id: sessionId,
    project_path: projectPath,
    owner_type: "clu",
    status: "running",
    task_id: null,
    started_at: new Date().toISOString(),
    ended_at: null,
    metadata: null,
  });
}

// Subscribe to Clu session changes
export function subscribeToCluSessions(
  callback: (sessions: CluSession[]) => void,
) {
  if (!supabase) return null;

  return supabase
    .channel("clu-sessions-changes")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "clu_sessions" },
      async () => {
        const sessions = await getCluSessions();
        callback(sessions);
      },
    )
    .subscribe();
}

// ============================================================================
// ACTIVITIES
// ============================================================================

export type ActivityType =
  | "session_marked_clu"
  | "session_unmarked_clu"
  | "task_assigned_clu"
  | "task_unassigned_clu"
  | "session_started"
  | "session_completed"
  | "system";

export interface Activity {
  id: string;
  type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// Get recent activities
export async function getActivities(limit = 50): Promise<Activity[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch activities:", error);
    return [];
  }
  return (data || []) as Activity[];
}

// Create an activity
export async function createActivity(
  type: ActivityType,
  title: string,
  description?: string,
  metadata?: Record<string, unknown>,
): Promise<Activity | null> {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("activities")
    .insert({
      type,
      title,
      description,
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create activity:", error);
    return null;
  }
  return data as Activity;
}

// Subscribe to activity changes
export function subscribeToActivities(
  callback: (activities: Activity[]) => void,
) {
  if (!supabase) return null;

  return supabase
    .channel("activities-changes")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activities" },
      async () => {
        const activities = await getActivities();
        callback(activities);
      },
    )
    .subscribe();
}
