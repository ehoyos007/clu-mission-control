/**
 * OpenClaw Gateway client for voice conversations
 * Uses the OpenAI-compatible HTTP API for simplicity
 */

const getEnv = (key: string, fallback: string): string => {
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  return process.env[key] || fallback;
};

const GATEWAY_URL = getEnv("OPENCLAW_GATEWAY_URL", "http://127.0.0.1:18789");
const GATEWAY_TOKEN = getEnv("OPENCLAW_GATEWAY_TOKEN", "");

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// Voice-optimized system prompt for Clu
const VOICE_SYSTEM_PROMPT = `You are Clu, responding via voice chat. Keep responses concise (1-3 sentences typically).

Guidelines:
- Use natural, conversational language
- Avoid bullet points, lists, or formatting that doesn't work well spoken
- Don't use markdown, code blocks, or special characters
- If asked to do something complex, acknowledge briefly and confirm you'll do it
- Be warm and personable
- For technical topics, explain simply without jargon

Remember: Your response will be spoken aloud, so write how you would naturally speak.

You have access to all your normal tools and capabilities. If the user asks you to do something that requires tools (search, file operations, spawning Claude Code sessions, etc.), you can do it and briefly confirm what you did.`;

/**
 * Send a voice message through the OpenClaw gateway HTTP API
 * This routes through Clu, giving access to all tools and memory
 */
export async function sendToOpenClaw(
  userMessage: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
): Promise<string> {
  const url = `${GATEWAY_URL.replace("ws://", "http://").replace("wss://", "https://")}/v1/chat/completions`;

  // Build messages array
  const messages: ChatMessage[] = [
    { role: "system", content: VOICE_SYSTEM_PROMPT },
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  console.log(`[OpenClaw] Sending to ${url}: "${userMessage.slice(0, 50)}..."`);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
        "x-openclaw-agent-id": "main",
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages,
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[OpenClaw] HTTP ${response.status}: ${errorText}`);
      throw new Error(`OpenClaw API error: ${response.status} ${errorText}`);
    }

    const data: ChatCompletionResponse = await response.json();
    const duration = Date.now() - startTime;

    const responseText =
      data.choices?.[0]?.message?.content ||
      "I'm sorry, I couldn't generate a response.";

    // Clean up response for voice
    const cleanedResponse = cleanResponseForVoice(responseText);

    console.log(
      `[OpenClaw] Response in ${duration}ms: "${cleanedResponse.slice(0, 50)}..."`,
    );

    return cleanedResponse;
  } catch (error) {
    console.error("[OpenClaw] Request failed:", error);
    throw error;
  }
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
 * Check if the OpenClaw gateway HTTP API is available
 */
export async function isOpenClawAvailable(): Promise<boolean> {
  const url = `${GATEWAY_URL.replace("ws://", "http://").replace("wss://", "https://")}/v1/chat/completions`;

  try {
    // Just check if the endpoint responds (even with auth error means it's available)
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GATEWAY_TOKEN}`,
      },
      body: JSON.stringify({
        model: "openclaw:main",
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      }),
    });

    // 200 = success, 401/403 = auth issue but endpoint exists
    return response.ok || response.status === 401 || response.status === 403;
  } catch {
    return false;
  }
}

/**
 * No-op for HTTP mode (was used for WebSocket cleanup)
 */
export function disconnectFromOpenClaw(): void {
  // No persistent connection to clean up with HTTP
}
