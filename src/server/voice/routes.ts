/**
 * REST API routes for voice functionality
 */

import { Hono } from "hono";
import { isLLMAvailable } from "./llm";
import { getAllSessions } from "./session";
import { isSTTAvailable, transcribeAudio } from "./stt";
import {
  getCurrentVoiceId,
  getVoices,
  isTTSAvailable,
  synthesizeSpeech,
} from "./tts";

export const voiceRoutes = new Hono();

/**
 * GET /api/voice/status
 * Check voice service availability
 */
voiceRoutes.get("/status", (c) => {
  return c.json({
    available: isSTTAvailable() && isTTSAvailable() && isLLMAvailable(),
    services: {
      stt: isSTTAvailable(),
      tts: isTTSAvailable(),
      llm: isLLMAvailable(),
    },
    defaultVoiceId: getCurrentVoiceId(),
  });
});

/**
 * GET /api/voice/voices
 * Get available TTS voices
 */
voiceRoutes.get("/voices", async (c) => {
  try {
    const voices = await getVoices();
    return c.json({ voices });
  } catch (error) {
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/voice/transcribe
 * Transcribe audio file to text
 */
voiceRoutes.post("/transcribe", async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("audio") as File | null;

    if (!audioFile) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    const buffer = Buffer.from(await audioFile.arrayBuffer());
    const result = await transcribeAudio(buffer);

    return c.json({
      text: result.text,
      duration: result.duration,
      language: result.language,
    });
  } catch (error) {
    console.error("[Voice API] Transcription error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * POST /api/voice/synthesize
 * Synthesize text to speech
 */
voiceRoutes.post("/synthesize", async (c) => {
  try {
    const body = await c.req.json();
    const { text, voiceId } = body;

    if (!text) {
      return c.json({ error: "No text provided" }, 400);
    }

    const audioBuffer = await synthesizeSpeech(text, { voiceId });

    // Return as MP3 audio
    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audioBuffer.length),
      },
    });
  } catch (error) {
    console.error("[Voice API] Synthesis error:", error);
    return c.json({ error: String(error) }, 500);
  }
});

/**
 * GET /api/voice/sessions
 * Get all active voice sessions (for debugging)
 */
voiceRoutes.get("/sessions", (c) => {
  const sessions = getAllSessions();
  return c.json({
    count: sessions.length,
    sessions: sessions.map((s) => ({
      id: s.id,
      state: s.state,
      messageCount: s.messages.length,
      createdAt: s.createdAt,
      lastActivityAt: s.lastActivityAt,
    })),
  });
});
