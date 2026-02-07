/**
 * Speech-to-Text service using OpenAI Whisper API
 */

import type { Readable } from "node:stream";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY environment variable is required for voice mode",
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

export interface TranscriptionResult {
  text: string;
  duration?: number;
  language?: string;
}

/**
 * Transcribe audio buffer to text using Whisper
 */
export async function transcribeAudio(
  audioBuffer: Buffer,
  options?: {
    language?: string;
    prompt?: string;
  },
): Promise<TranscriptionResult> {
  const openai = getOpenAI();

  // Create a File-like object from the buffer
  const audioFile = new File([audioBuffer], "audio.webm", {
    type: "audio/webm",
  });

  const startTime = Date.now();

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: options?.language,
    prompt: options?.prompt,
    response_format: "verbose_json",
  });

  const duration = Date.now() - startTime;
  console.log(
    `[STT] Transcribed in ${duration}ms: "${response.text.slice(0, 50)}..."`,
  );

  return {
    text: response.text,
    duration: response.duration,
    language: response.language,
  };
}

/**
 * Transcribe audio from a readable stream
 */
export async function transcribeStream(
  stream: Readable,
  _mimeType = "audio/webm",
): Promise<TranscriptionResult> {
  // Collect stream into buffer
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const buffer = Buffer.concat(chunks);

  return transcribeAudio(buffer);
}

/**
 * Check if STT is available (API key configured)
 */
export function isSTTAvailable(): boolean {
  // biome-ignore lint/style/noProcessEnv: Voice module uses env vars directly
  return !!process.env.OPENAI_API_KEY;
}
