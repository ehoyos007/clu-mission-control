/**
 * Voice module exports
 */

export { generateVoiceResponse, isLLMAvailable } from "./llm";
export { voiceRoutes } from "./routes";
export {
  addMessage,
  createVoiceSession,
  deleteVoiceSession,
  getConversationHistory,
  getVoiceSession,
  updateSessionState,
  type VoiceMessage,
  type VoiceSession,
  type VoiceSessionState,
} from "./session";
export { isSTTAvailable, transcribeAudio } from "./stt";
export { getVoices, isTTSAvailable, synthesizeSpeech } from "./tts";
export { voiceWebSocketHandlers } from "./websocket";
