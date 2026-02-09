/**
 * OpenClaw Gateway client for voice conversations
 * Routes voice messages through the OpenClaw gateway to access Clu's full capabilities
 */

import WebSocket from "ws";

// biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
const GATEWAY_URL = process.env.OPENCLAW_GATEWAY_URL || "ws://127.0.0.1:18789";

interface GatewayFrame {
  type: "req" | "res" | "event";
  id?: string;
  method?: string;
  params?: Record<string, unknown>;
  ok?: boolean;
  payload?: Record<string, unknown>;
  event?: string;
  error?: { code: string; message: string };
}

interface ChatResponse {
  text: string;
  complete: boolean;
}

let connectionPromise: Promise<WebSocket> | null = null;
let activeConnection: WebSocket | null = null;
let requestId = 0;

/**
 * Get or create a connection to the OpenClaw gateway
 */
async function getConnection(): Promise<WebSocket> {
  if (activeConnection?.readyState === WebSocket.OPEN) {
    return activeConnection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = new Promise((resolve, reject) => {
    console.log(`[OpenClaw] Connecting to gateway at ${GATEWAY_URL}`);
    const ws = new WebSocket(GATEWAY_URL);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Gateway connection timeout"));
    }, 10000);

    ws.on("open", () => {
      console.log("[OpenClaw] WebSocket connected, sending handshake");

      // Send connect handshake
      const connectFrame: GatewayFrame = {
        type: "req",
        id: `c${++requestId}`,
        method: "connect",
        params: {
          minProtocol: 3,
          maxProtocol: 3,
          client: {
            id: "clu-mission-control-voice",
            displayName: "Clu Mission Control Voice",
            version: "1.0.0",
            platform: "node",
            mode: "api",
          },
        },
      };

      ws.send(JSON.stringify(connectFrame));
    });

    ws.on("message", (data) => {
      try {
        const frame: GatewayFrame = JSON.parse(data.toString());

        // Handle connect response
        if (
          frame.type === "res" &&
          frame.ok &&
          frame.payload?.type === "hello-ok"
        ) {
          console.log("[OpenClaw] Gateway handshake complete");
          clearTimeout(timeout);
          activeConnection = ws;
          connectionPromise = null;
          resolve(ws);
        } else if (frame.type === "res" && !frame.ok) {
          console.error("[OpenClaw] Gateway rejected connection:", frame.error);
          clearTimeout(timeout);
          connectionPromise = null;
          reject(
            new Error(frame.error?.message || "Gateway rejected connection"),
          );
        }
      } catch (err) {
        console.error("[OpenClaw] Error parsing gateway message:", err);
      }
    });

    ws.on("error", (err) => {
      console.error("[OpenClaw] WebSocket error:", err);
      clearTimeout(timeout);
      connectionPromise = null;
      reject(err);
    });

    ws.on("close", () => {
      console.log("[OpenClaw] WebSocket closed");
      activeConnection = null;
      connectionPromise = null;
    });
  });

  return connectionPromise;
}

/**
 * Send a voice message through the OpenClaw gateway and get a response
 * This routes through Clu, giving access to all tools and memory
 */
export async function sendToOpenClaw(
  userMessage: string,
  _conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
): Promise<string> {
  const ws = await getConnection();
  const reqId = `chat${++requestId}`;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("OpenClaw response timeout"));
    }, 120000); // 2 minute timeout for complex operations

    let responseText = "";
    let _isComplete = false;

    const messageHandler = (data: WebSocket.Data) => {
      try {
        const frame: GatewayFrame = JSON.parse(data.toString());

        // Handle chat.send response (ack)
        if (frame.type === "res" && frame.id === reqId) {
          if (!frame.ok) {
            clearTimeout(timeout);
            ws.off("message", messageHandler);
            reject(new Error(frame.error?.message || "Chat request failed"));
            return;
          }
          // Ack received, wait for chat events
          console.log(
            "[OpenClaw] Chat request acknowledged, waiting for response...",
          );
        }

        // Handle chat events (streaming response)
        if (frame.type === "event" && frame.event === "chat") {
          const payload = frame.payload as {
            kind?: string;
            text?: string;
            delta?: string;
            final?: boolean;
            complete?: boolean;
          };

          // Accumulate text from delta or text field
          if (payload.delta) {
            responseText += payload.delta;
          } else if (payload.text && payload.kind === "assistant") {
            responseText = payload.text;
          }

          // Check if response is complete
          if (payload.final || payload.complete) {
            _isComplete = true;
            clearTimeout(timeout);
            ws.off("message", messageHandler);

            // Clean up response for voice (remove markdown, etc.)
            const cleanedResponse = cleanResponseForVoice(responseText);
            console.log(
              `[OpenClaw] Response complete: "${cleanedResponse.slice(0, 50)}..."`,
            );
            resolve(cleanedResponse);
          }
        }
      } catch (err) {
        console.error("[OpenClaw] Error parsing message:", err);
      }
    };

    ws.on("message", messageHandler);

    // Send the chat.send request
    // Note: We're sending to the main session which routes to Clu
    const chatFrame: GatewayFrame = {
      type: "req",
      id: reqId,
      method: "chat.send",
      params: {
        text: userMessage,
        sessionKey: "main",
        idempotencyKey: `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      },
    };

    console.log(`[OpenClaw] Sending message: "${userMessage.slice(0, 50)}..."`);
    ws.send(JSON.stringify(chatFrame));
  });
}

/**
 * Clean up response text for voice output
 * Removes markdown, code blocks, and other formatting that doesn't work well spoken
 */
function cleanResponseForVoice(text: string): string {
  return (
    text
      // Remove code blocks
      .replace(/```[\s\S]*?```/g, "I've written some code for that.")
      // Remove inline code
      .replace(/`([^`]+)`/g, "$1")
      // Remove markdown headers
      .replace(/^#{1,6}\s+/gm, "")
      // Remove bold/italic
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/__([^_]+)__/g, "$1")
      .replace(/_([^_]+)_/g, "$1")
      // Remove links, keep text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove bullet points
      .replace(/^[-*•]\s+/gm, "")
      // Remove numbered lists
      .replace(/^\d+\.\s+/gm, "")
      // Clean up multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      // Trim
      .trim()
  );
}

/**
 * Check if the OpenClaw gateway is available
 */
export async function isOpenClawAvailable(): Promise<boolean> {
  try {
    const ws = await getConnection();
    return ws.readyState === WebSocket.OPEN;
  } catch {
    return false;
  }
}

/**
 * Disconnect from the gateway
 */
export function disconnectFromOpenClaw(): void {
  if (activeConnection) {
    activeConnection.close();
    activeConnection = null;
  }
  connectionPromise = null;
}
