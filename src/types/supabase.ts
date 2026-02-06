// Supabase Database Types
// Generated manually - can be auto-generated with `supabase gen types typescript`

export interface Database {
  public: {
    Tables: {
      clu_sessions: {
        Row: {
          id: string;
          session_id: string;
          project_path: string;
          owner_type: "clu" | "user";
          status: "running" | "paused" | "completed" | "error";
          task_id: string | null;
          started_at: string;
          ended_at: string | null;
          created_at: string;
          metadata: Record<string, unknown> | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          project_path: string;
          owner_type: "clu" | "user";
          status: "running" | "paused" | "completed" | "error";
          task_id?: string | null;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown> | null;
        };
        Update: {
          id?: string;
          session_id?: string;
          project_path?: string;
          owner_type?: "clu" | "user";
          status?: "running" | "paused" | "completed" | "error";
          task_id?: string | null;
          started_at?: string;
          ended_at?: string | null;
          created_at?: string;
          metadata?: Record<string, unknown> | null;
        };
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          status: "not_started" | "in_progress" | "completed" | "blocked";
          priority: number;
          project: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          status?: "not_started" | "in_progress" | "completed" | "blocked";
          priority?: number;
          project?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          status?: "not_started" | "in_progress" | "completed" | "blocked";
          priority?: number;
          project?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      activities: {
        Row: {
          id: string;
          type: string;
          title: string;
          description: string | null;
          metadata: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: string;
          title: string;
          description?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string;
          title?: string;
          description?: string | null;
          metadata?: Record<string, unknown> | null;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
