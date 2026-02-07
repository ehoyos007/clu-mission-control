/**
 * Text-to-Speech service using ElevenLabs API
 */

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

// Default voice - can be overridden via env
const DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM"; // Rachel - clear, conversational

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export interface TTSOptions {
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  style?: number;
  useSpeakerBoost?: boolean;
}

function getApiKey(): string {
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY environment variable is required for voice mode",
    );
  }
  return apiKey;
}

function getDefaultVoiceId(): string {
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  return process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID;
}

/**
 * Synthesize text to speech, returns audio buffer (MP3)
 */
export async function synthesizeSpeech(
  text: string,
  options?: TTSOptions,
): Promise<Buffer> {
  const apiKey = getApiKey();
  const voiceId = options?.voiceId || getDefaultVoiceId();
  const modelId = options?.modelId || "eleven_turbo_v2_5"; // Fastest model

  const startTime = Date.now();

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarityBoost ?? 0.75,
          style: options?.style ?? 0.0,
          use_speaker_boost: options?.useSpeakerBoost ?? true,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const duration = Date.now() - startTime;
  console.log(
    `[TTS] Synthesized ${text.length} chars in ${duration}ms (${buffer.length} bytes)`,
  );

  return buffer;
}

/**
 * Stream synthesized speech (for lower latency)
 */
export async function synthesizeSpeechStream(
  text: string,
  options?: TTSOptions,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = getApiKey();
  const voiceId = options?.voiceId || getDefaultVoiceId();
  const modelId = options?.modelId || "eleven_turbo_v2_5";

  const response = await fetch(
    `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}/stream`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text,
        model_id: modelId,
        voice_settings: {
          stability: options?.stability ?? 0.5,
          similarity_boost: options?.similarityBoost ?? 0.75,
          style: options?.style ?? 0.0,
          use_speaker_boost: options?.useSpeakerBoost ?? true,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ElevenLabs API error: ${response.status} - ${error}`);
  }

  if (!response.body) {
    throw new Error("No response body from ElevenLabs");
  }

  return response.body;
}

/**
 * Get available voices
 */
export async function getVoices(): Promise<Voice[]> {
  const apiKey = getApiKey();

  const response = await fetch(`${ELEVENLABS_API_URL}/voices`, {
    headers: {
      "xi-api-key": apiKey,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch voices: ${response.status}`);
  }

  const data = await response.json();
  // biome-ignore lint/suspicious/noExplicitAny: ElevenLabs API response type
  return data.voices.map((v: any) => ({
    voice_id: v.voice_id,
    name: v.name,
    category: v.category,
    description: v.description,
  }));
}

/**
 * Check if TTS is available (API key configured)
 */
export function isTTSAvailable(): boolean {
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  return !!process.env.ELEVENLABS_API_KEY;
}

/**
 * Get current default voice ID
 */
export function getCurrentVoiceId(): string {
  return getDefaultVoiceId();
}
