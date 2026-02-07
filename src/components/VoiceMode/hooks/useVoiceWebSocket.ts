/**
 * Hook for voice WebSocket communication
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceState =
  | "disconnected"
  | "connecting"
  | "idle"
  | "listening"
  | "transcribing"
  | "thinking"
  | "speaking"
  | "error";

export interface VoiceMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ServerMessage {
  type: string;
  sessionId?: string;
  state?: string;
  text?: string;
  data?: string;
  final?: boolean;
  error?: string;
}

export interface UseVoiceWebSocketReturn {
  state: VoiceState;
  sessionId: string | null;
  messages: VoiceMessage[];
  lastTranscription: string | null;
  lastResponse: string | null;
  error: string | null;
  connect: () => void;
  disconnect: () => void;
  sendAudioChunk: (data: ArrayBuffer) => void;
  stopRecording: () => void;
  cancel: () => void;
  interrupt: () => void;
  onAudioReceived: (callback: (audioData: string) => void) => void;
}

export function useVoiceWebSocket(): UseVoiceWebSocketReturn {
  const [state, setState] = useState<VoiceState>("disconnected");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [lastTranscription, setLastTranscription] = useState<string | null>(
    null,
  );
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCallbackRef = useRef<((audioData: string) => void) | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const getWebSocketUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/api/voice/ws`;
  }, []);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "session_started":
        setSessionId(message.sessionId || null);
        setState("idle");
        console.log("[VoiceWS] Session started:", message.sessionId);
        break;

      case "state_change":
        if (message.state) {
          setState(message.state as VoiceState);
        }
        break;

      case "transcription":
        setLastTranscription(message.text || null);
        if (message.text) {
          const text = message.text;
          setMessages((prev) => [
            ...prev,
            { role: "user", content: text, timestamp: Date.now() },
          ]);
        }
        break;

      case "response_text":
        setLastResponse(message.text || null);
        if (message.text) {
          const text = message.text;
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              content: text,
              timestamp: Date.now(),
            },
          ]);
        }
        break;

      case "audio_data":
        if (message.data && audioCallbackRef.current) {
          audioCallbackRef.current(message.data);
        }
        break;

      case "error":
        setError(message.error || "Unknown error");
        setState("error");
        break;

      case "pong":
        // Heartbeat response
        break;

      default:
        console.log("[VoiceWS] Unknown message type:", message.type);
    }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setState("connecting");
    setError(null);

    const ws = new WebSocket(getWebSocketUrl());
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("[VoiceWS] Connected");
      // Start a new session
      ws.send(JSON.stringify({ type: "start_session" }));
    };

    ws.onclose = (event) => {
      console.log("[VoiceWS] Disconnected", event.code, event.reason);
      setState("disconnected");
      wsRef.current = null;

      // Auto-reconnect if not intentional disconnect
      if (event.code !== 1000) {
        reconnectTimeoutRef.current = window.setTimeout(() => {
          console.log("[VoiceWS] Attempting to reconnect...");
          connect();
        }, 3000);
      }
    };

    ws.onerror = (event) => {
      console.error("[VoiceWS] Error:", event);
      setError("Connection error");
    };

    ws.onmessage = (event) => {
      try {
        const message: ServerMessage = JSON.parse(event.data);
        handleMessage(message);
      } catch (err) {
        console.error("[VoiceWS] Failed to parse message:", err);
      }
    };
  }, [getWebSocketUrl, handleMessage]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, "User disconnect");
      wsRef.current = null;
    }

    setState("disconnected");
    setSessionId(null);
  }, []);

  const sendAudioChunk = useCallback(
    (data: ArrayBuffer) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN || !sessionId) return;

      const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));

      wsRef.current.send(
        JSON.stringify({
          type: "audio_data",
          sessionId,
          data: base64,
        }),
      );
    },
    [sessionId],
  );

  const stopRecording = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !sessionId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "stop_recording",
        sessionId,
      }),
    );
  }, [sessionId]);

  const cancel = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !sessionId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "cancel",
        sessionId,
      }),
    );
  }, [sessionId]);

  const interrupt = useCallback(() => {
    if (wsRef.current?.readyState !== WebSocket.OPEN || !sessionId) return;

    wsRef.current.send(
      JSON.stringify({
        type: "interrupt",
        sessionId,
      }),
    );
  }, [sessionId]);

  const onAudioReceived = useCallback(
    (callback: (audioData: string) => void) => {
      audioCallbackRef.current = callback;
    },
    [],
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  // Heartbeat to keep connection alive
  useEffect(() => {
    if (state === "disconnected") return;

    const interval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "ping" }));
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [state]);

  return {
    state,
    sessionId,
    messages,
    lastTranscription,
    lastResponse,
    error,
    connect,
    disconnect,
    sendAudioChunk,
    stopRecording,
    cancel,
    interrupt,
    onAudioReceived,
  };
}
