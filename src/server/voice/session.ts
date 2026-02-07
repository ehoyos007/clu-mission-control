/**
 * Voice session state management
 */

import { ulid } from "ulid";

export type VoiceSessionState =
  | "idle" // Waiting for user
  | "listening" // Recording user audio
  | "transcribing" // Converting speech to text
  | "thinking" // Claude is processing
  | "speaking" // Playing TTS response
  | "error"; // Error state

export interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  audioUrl?: string; // For playback reference
}

export interface VoiceSession {
  id: string;
  projectId?: string;
  state: VoiceSessionState;
  messages: VoiceMessage[];
  createdAt: number;
  lastActivityAt: number;
  error?: string;
}

// In-memory session store (could be moved to Supabase later)
const sessions = new Map<string, VoiceSession>();

// Session timeout: 30 minutes of inactivity
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Create a new voice session
 */
export function createVoiceSession(projectId?: string): VoiceSession {
  const session: VoiceSession = {
    id: ulid(),
    projectId,
    state: "idle",
    messages: [],
    createdAt: Date.now(),
    lastActivityAt: Date.now(),
  };

  sessions.set(session.id, session);
  console.log(`[VoiceSession] Created session ${session.id}`);

  return session;
}

/**
 * Get an existing session
 */
export function getVoiceSession(sessionId: string): VoiceSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Check for timeout
  if (Date.now() - session.lastActivityAt > SESSION_TIMEOUT_MS) {
    sessions.delete(sessionId);
    console.log(`[VoiceSession] Session ${sessionId} expired`);
    return null;
  }

  return session;
}

/**
 * Update session state
 */
export function updateSessionState(
  sessionId: string,
  state: VoiceSessionState,
  error?: string,
): VoiceSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  session.state = state;
  session.lastActivityAt = Date.now();
  if (error) session.error = error;
  else if (state !== "error") session.error = undefined;

  console.log(`[VoiceSession] ${sessionId} state: ${state}`);

  return session;
}

/**
 * Add a message to the session
 */
export function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string,
  audioUrl?: string,
): VoiceMessage | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  const message: VoiceMessage = {
    id: ulid(),
    role,
    content,
    timestamp: Date.now(),
    audioUrl,
  };

  session.messages.push(message);
  session.lastActivityAt = Date.now();

  console.log(
    `[VoiceSession] ${sessionId} +${role}: "${content.slice(0, 50)}..."`,
  );

  return message;
}

/**
 * Get conversation history for Claude context
 */
export function getConversationHistory(
  sessionId: string,
): { role: "user" | "assistant"; content: string }[] {
  const session = sessions.get(sessionId);
  if (!session) return [];

  return session.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
}

/**
 * Delete a session
 */
export function deleteVoiceSession(sessionId: string): boolean {
  const deleted = sessions.delete(sessionId);
  if (deleted) {
    console.log(`[VoiceSession] Deleted session ${sessionId}`);
  }
  return deleted;
}

/**
 * Get all active sessions (for debugging)
 */
export function getAllSessions(): VoiceSession[] {
  return Array.from(sessions.values());
}

/**
 * Cleanup expired sessions (call periodically)
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;

  for (const [id, session] of sessions) {
    if (now - session.lastActivityAt > SESSION_TIMEOUT_MS) {
      sessions.delete(id);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[VoiceSession] Cleaned up ${cleaned} expired sessions`);
  }

  return cleaned;
}

// Cleanup every 5 minutes
setInterval(cleanupExpiredSessions, 5 * 60 * 1000);
