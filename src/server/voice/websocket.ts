/**
 * WebSocket handler for voice communication
 */

import type { ServerWebSocket } from "bun";
import { generateVoiceResponse } from "./llm";
import {
  addMessage,
  createVoiceSession,
  getConversationHistory,
  getVoiceSession,
  updateSessionState,
} from "./session";
import { transcribeAudio } from "./stt";
import { synthesizeSpeech } from "./tts";

// Message types from client
interface ClientMessage {
  type:
    | "start_session"
    | "audio_data"
    | "stop_recording"
    | "cancel"
    | "interrupt"
    | "ping";
  sessionId?: string;
  projectId?: string;
  data?: string; // base64 audio data
}

// Message types to client
interface ServerMessage {
  type:
    | "session_started"
    | "state_change"
    | "transcription"
    | "response_text"
    | "audio_data"
    | "error"
    | "pong";
  sessionId?: string;
  state?: string;
  text?: string;
  data?: string; // base64 audio
  final?: boolean;
  error?: string;
}

// Active connections mapped to session IDs
const connections = new Map<ServerWebSocket<unknown>, string>();
const sessionConnections = new Map<string, Set<ServerWebSocket<unknown>>>();

// Audio buffer for accumulating chunks during recording
const audioBuffers = new Map<string, Buffer[]>();

/**
 * Send a message to a WebSocket client
 */
function send(ws: ServerWebSocket<unknown>, message: ServerMessage): void {
  try {
    ws.send(JSON.stringify(message));
  } catch (error) {
    console.error("[Voice WS] Error sending message:", error);
  }
}

/**
 * Send a message to all connections for a session
 */
function broadcast(sessionId: string, message: ServerMessage): void {
  const sockets = sessionConnections.get(sessionId);
  if (sockets) {
    for (const ws of sockets) {
      send(ws, message);
    }
  }
}

/**
 * Handle new WebSocket connection
 */
export function handleOpen(_ws: ServerWebSocket<unknown>): void {
  console.log("[Voice WS] New connection");
}

/**
 * Handle WebSocket close
 */
export function handleClose(ws: ServerWebSocket<unknown>): void {
  const sessionId = connections.get(ws);
  if (sessionId) {
    const sockets = sessionConnections.get(sessionId);
    if (sockets) {
      sockets.delete(ws);
      if (sockets.size === 0) {
        sessionConnections.delete(sessionId);
        audioBuffers.delete(sessionId);
      }
    }
    connections.delete(ws);
  }
  console.log("[Voice WS] Connection closed");
}

/**
 * Handle incoming WebSocket message
 */
export async function handleMessage(
  ws: ServerWebSocket<unknown>,
  message: string | Buffer,
): Promise<void> {
  try {
    const data: ClientMessage = JSON.parse(message.toString());

    switch (data.type) {
      case "ping":
        send(ws, { type: "pong" });
        break;

      case "start_session":
        await handleStartSession(ws, data.projectId);
        break;

      case "audio_data":
        await handleAudioData(ws, data.sessionId, data.data);
        break;

      case "stop_recording":
        await handleStopRecording(ws, data.sessionId);
        break;

      case "cancel":
        await handleCancel(ws, data.sessionId);
        break;

      case "interrupt":
        await handleInterrupt(ws, data.sessionId);
        break;

      default:
        send(ws, {
          type: "error",
          // biome-ignore lint/suspicious/noExplicitAny: Handling unknown message types
          error: `Unknown message type: ${(data as any).type}`,
        });
    }
  } catch (error) {
    console.error("[Voice WS] Error handling message:", error);
    send(ws, { type: "error", error: String(error) });
  }
}

/**
 * Start a new voice session
 */
async function handleStartSession(
  ws: ServerWebSocket<unknown>,
  projectId?: string,
): Promise<void> {
  const session = createVoiceSession(projectId);

  // Associate connection with session
  connections.set(ws, session.id);

  if (!sessionConnections.has(session.id)) {
    sessionConnections.set(session.id, new Set());
  }
  sessionConnections.get(session.id)?.add(ws);

  // Initialize audio buffer
  audioBuffers.set(session.id, []);

  send(ws, {
    type: "session_started",
    sessionId: session.id,
    state: session.state,
  });
}

/**
 * Handle incoming audio data chunk
 */
async function handleAudioData(
  ws: ServerWebSocket<unknown>,
  sessionId?: string,
  base64Data?: string,
): Promise<void> {
  if (!sessionId || !base64Data) {
    send(ws, { type: "error", error: "Missing sessionId or audio data" });
    return;
  }

  const session = getVoiceSession(sessionId);
  if (!session) {
    send(ws, { type: "error", error: "Session not found" });
    return;
  }

  // Update state to listening if idle
  if (session.state === "idle") {
    updateSessionState(sessionId, "listening");
    broadcast(sessionId, {
      type: "state_change",
      sessionId,
      state: "listening",
    });
  }

  // Accumulate audio data
  const buffer = Buffer.from(base64Data, "base64");
  const buffers = audioBuffers.get(sessionId) || [];
  buffers.push(buffer);
  audioBuffers.set(sessionId, buffers);
}

/**
 * Handle stop recording - process the accumulated audio
 */
async function handleStopRecording(
  ws: ServerWebSocket<unknown>,
  sessionId?: string,
): Promise<void> {
  if (!sessionId) {
    send(ws, { type: "error", error: "Missing sessionId" });
    return;
  }

  const session = getVoiceSession(sessionId);
  if (!session) {
    send(ws, { type: "error", error: "Session not found" });
    return;
  }

  const buffers = audioBuffers.get(sessionId) || [];
  if (buffers.length === 0) {
    send(ws, { type: "error", error: "No audio data recorded" });
    updateSessionState(sessionId, "idle");
    broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
    return;
  }

  // Combine audio buffers
  const audioBuffer = Buffer.concat(buffers);
  audioBuffers.set(sessionId, []); // Clear buffer

  try {
    // Step 1: Transcribe
    updateSessionState(sessionId, "transcribing");
    broadcast(sessionId, {
      type: "state_change",
      sessionId,
      state: "transcribing",
    });

    const transcription = await transcribeAudio(audioBuffer);
    const userText = transcription.text.trim();

    if (!userText) {
      send(ws, { type: "error", error: "Could not understand audio" });
      updateSessionState(sessionId, "idle");
      broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
      return;
    }

    // Send transcription to client
    broadcast(sessionId, { type: "transcription", sessionId, text: userText });

    // Add user message to history
    addMessage(sessionId, "user", userText);

    // Step 2: Generate response
    updateSessionState(sessionId, "thinking");
    broadcast(sessionId, {
      type: "state_change",
      sessionId,
      state: "thinking",
    });

    const history = getConversationHistory(sessionId);
    // Remove the last message (the one we just added) from history for the API call
    const previousHistory = history.slice(0, -1);

    const responseText = await generateVoiceResponse(userText, previousHistory);

    // Send text response to client
    broadcast(sessionId, {
      type: "response_text",
      sessionId,
      text: responseText,
    });

    // Add assistant message to history
    addMessage(sessionId, "assistant", responseText);

    // Step 3: Synthesize speech
    updateSessionState(sessionId, "speaking");
    broadcast(sessionId, {
      type: "state_change",
      sessionId,
      state: "speaking",
    });

    const audioResponse = await synthesizeSpeech(responseText);
    const base64Audio = audioResponse.toString("base64");

    // Send audio to client
    broadcast(sessionId, {
      type: "audio_data",
      sessionId,
      data: base64Audio,
      final: true,
    });

    // Back to idle
    updateSessionState(sessionId, "idle");
    broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
  } catch (error) {
    console.error("[Voice WS] Error processing audio:", error);
    updateSessionState(sessionId, "error", String(error));
    broadcast(sessionId, {
      type: "error",
      sessionId,
      error: String(error),
    });

    // Reset to idle after error
    setTimeout(() => {
      updateSessionState(sessionId, "idle");
      broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
    }, 2000);
  }
}

/**
 * Handle cancel - stop current operation
 */
async function handleCancel(
  _ws: ServerWebSocket<unknown>,
  sessionId?: string,
): Promise<void> {
  if (!sessionId) return;

  // Clear audio buffer
  audioBuffers.set(sessionId, []);

  // Reset to idle
  updateSessionState(sessionId, "idle");
  broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
}

/**
 * Handle interrupt - stop TTS playback
 */
async function handleInterrupt(
  _ws: ServerWebSocket<unknown>,
  sessionId?: string,
): Promise<void> {
  if (!sessionId) return;

  const session = getVoiceSession(sessionId);
  if (session?.state === "speaking") {
    updateSessionState(sessionId, "idle");
    broadcast(sessionId, { type: "state_change", sessionId, state: "idle" });
  }
}

/**
 * Export handlers for Hono WebSocket integration
 */
export const voiceWebSocketHandlers = {
  open: handleOpen,
  close: handleClose,
  message: handleMessage,
};
