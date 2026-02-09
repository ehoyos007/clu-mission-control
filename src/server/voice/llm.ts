/**
 * LLM integration for voice conversations
 * Supports two modes:
 * - "clu": Routes through OpenClaw gateway (Clu with full tools/memory)
 * - "direct": Direct Anthropic API call (quick, isolated questions)
 */

import Anthropic from "@anthropic-ai/sdk";
import { sendToOpenClaw } from "./openclaw";

export type VoiceMode = "clu" | "direct";

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required");
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// System prompt optimized for voice conversations
const VOICE_SYSTEM_PROMPT = `You are Clu, a helpful AI assistant engaged in a voice conversation. 

Guidelines for voice responses:
- Keep responses concise (1-3 sentences typically)
- Use natural, conversational language
- Avoid bullet points, numbered lists, or formatting that doesn't work well spoken
- Don't use markdown, code blocks, or special characters
- If asked to do something complex, acknowledge briefly and confirm you'll do it
- Be warm and personable, like talking to a friend
- For technical topics, explain simply without jargon
- If you need clarification, ask one clear question

Remember: Your response will be spoken aloud, so write how you would naturally speak.`;

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
}

export interface VoiceResponseOptions {
  maxTokens?: number;
  temperature?: number;
  model?: string;
  mode?: VoiceMode;
}

/**
 * Generate a voice-optimized response from Claude
 * Supports two modes:
 * - "clu" (default): Routes through OpenClaw gateway for full Clu capabilities
 * - "direct": Direct Anthropic API for quick, isolated questions
 */
export async function generateVoiceResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[] = [],
  options?: VoiceResponseOptions,
): Promise<string> {
  const mode = options?.mode || "clu";
  const startTime = Date.now();

  // Clu mode: Route through OpenClaw gateway
  if (mode === "clu") {
    try {
      console.log("[LLM] Using Clu mode (OpenClaw gateway)");
      const response = await sendToOpenClaw(userMessage, conversationHistory);
      const duration = Date.now() - startTime;
      console.log(
        `[LLM] Clu response in ${duration}ms: "${response.slice(0, 50)}..."`,
      );
      return response;
    } catch (error) {
      console.error(
        "[LLM] OpenClaw error, falling back to direct mode:",
        error,
      );
      // Fall through to direct mode on error
    }
  }

  // Direct mode: Use Anthropic API directly
  console.log("[LLM] Using direct mode (Anthropic API)");
  const anthropic = getAnthropic();

  const model = options?.model || "claude-sonnet-4-20250514";
  const maxTokens = options?.maxTokens || 300; // Keep responses short for voice
  const temperature = options?.temperature || 0.7; // Slightly more creative for natural speech

  // Build messages array
  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user",
      content: userMessage,
    },
  ];

  const response = await anthropic.messages.create({
    model,
    max_tokens: maxTokens,
    temperature,
    system: VOICE_SYSTEM_PROMPT,
    messages,
  });

  const duration = Date.now() - startTime;

  // Extract text content
  const textContent = response.content.find((c) => c.type === "text");
  const responseText =
    textContent?.text || "I'm sorry, I couldn't generate a response.";

  console.log(
    `[LLM] Direct response in ${duration}ms: "${responseText.slice(0, 50)}..."`,
  );

  return responseText;
}

/**
 * Generate a streaming voice response (for lower perceived latency)
 */
export async function* generateVoiceResponseStream(
  userMessage: string,
  conversationHistory: ConversationMessage[] = [],
  options?: VoiceResponseOptions,
): AsyncGenerator<string> {
  const anthropic = getAnthropic();

  const model = options?.model || "claude-sonnet-4-20250514";
  const maxTokens = options?.maxTokens || 300;
  const temperature = options?.temperature || 0.7;

  const messages: Anthropic.MessageParam[] = [
    ...conversationHistory.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    {
      role: "user",
      content: userMessage,
    },
  ];

  const stream = anthropic.messages.stream({
    model,
    max_tokens: maxTokens,
    temperature,
    system: VOICE_SYSTEM_PROMPT,
    messages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Check if LLM is available for a given mode
 */
export function isLLMAvailable(mode: VoiceMode = "clu"): boolean {
  if (mode === "clu") {
    // OpenClaw gateway should be available on localhost
    // We'll do a quick check on first use
    return true;
  }
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  return !!process.env.ANTHROPIC_API_KEY;
}

/**
 * Check if OpenClaw gateway is reachable
 */
export { isOpenClawAvailable } from "./openclaw";
