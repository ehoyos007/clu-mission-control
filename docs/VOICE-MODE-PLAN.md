# Voice Mode for Clu Mission Control

## Goal
Add voice chat capability to Clu Mission Control, allowing real-time voice conversations with Clu (Claude) through the web interface. Replace Telegram as primary communication channel.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (React)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Microphone  │  │  Speaker    │  │    Voice UI Component   │ │
│  │ (Web Audio) │  │  (Audio)    │  │  - Push-to-talk button  │ │
│  └──────┬──────┘  └──────▲──────┘  │  - Waveform visualizer  │ │
│         │                │         │  - Status indicators    │ │
│         ▼                │         └─────────────────────────┘ │
│  ┌──────────────────────────────┐                              │
│  │     WebSocket Connection     │                              │
│  └──────────────┬───────────────┘                              │
└─────────────────┼───────────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Clu Mission Control Server                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │  WebSocket  │  │   Voice     │  │     Session Manager     │ │
│  │   Handler   │──│   Router    │──│  - Conversation state   │ │
│  └─────────────┘  └──────┬──────┘  │  - Message history      │ │
│                          │         └─────────────────────────┘ │
│         ┌────────────────┼────────────────┐                    │
│         ▼                ▼                ▼                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │   Whisper   │  │   Claude    │  │ ElevenLabs  │            │
│  │    (STT)    │  │    API      │  │   (TTS)     │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| STT | OpenAI Whisper API | Fast, accurate, ~1s latency |
| LLM | Claude (via Anthropic) | Keep using Claude/Clu |
| TTS | ElevenLabs | Natural voice, streaming support |
| Transport | WebSocket (Hono) | Real-time bidirectional |
| Audio Capture | Web Audio API | Works on mobile browsers |
| Audio Playback | HTML5 Audio | Stream MP3 chunks |

## Phases

### Phase 1: Backend Voice Infrastructure
- [ ] Add WebSocket support to Hono server
- [ ] Create `/api/voice/ws` WebSocket endpoint
- [ ] Integrate OpenAI Whisper API for STT
- [ ] Integrate ElevenLabs API for TTS (streaming)
- [ ] Create voice session state management
- [ ] Audio format handling (webm → mp3)

### Phase 2: Frontend Voice UI
- [ ] Create VoiceMode component
- [ ] Microphone permission handling
- [ ] Audio recording with MediaRecorder API
- [ ] WebSocket client for voice data
- [ ] Audio playback queue for TTS responses
- [ ] Visual feedback:
  - Recording indicator (pulsing mic)
  - Waveform/level meter
  - "Clu is thinking..." / "Clu is speaking..."
- [ ] Push-to-talk button (hold to speak)
- [ ] Voice activity detection (VAD) option

### Phase 3: Conversation Integration
- [ ] Route transcribed text to Claude API
- [ ] System prompt for voice conversations (concise responses)
- [ ] Conversation history persistence
- [ ] Session continuity across refreshes
- [ ] Integration with existing chat UI (show voice messages in text too)

### Phase 4: Mobile Optimization
- [ ] Full-screen voice mode for mobile
- [ ] Large touch targets
- [ ] Background audio playback
- [ ] Wake lock to prevent screen sleep
- [ ] Haptic feedback on iOS/Android

### Phase 5: Advanced Features
- [ ] Interruption handling (stop TTS when user speaks)
- [ ] Multiple voice options
- [ ] Voice commands ("Hey Clu", "Stop", "Repeat")
- [ ] Call notifications (Clu can "call" you)
- [ ] Transcription display in real-time

## API Design

### WebSocket Messages

**Client → Server:**
```typescript
// Start recording
{ type: "start_recording" }

// Audio chunk (while recording)
{ type: "audio_chunk", data: base64_audio }

// Stop recording, process speech
{ type: "stop_recording" }

// Cancel current operation
{ type: "cancel" }

// Interrupt TTS playback
{ type: "interrupt" }
```

**Server → Client:**
```typescript
// Transcription result
{ type: "transcription", text: "user's speech" }

// Clu is processing
{ type: "thinking" }

// Text response (for display)
{ type: "response_text", text: "Clu's response" }

// Audio chunk for playback
{ type: "audio_chunk", data: base64_mp3, final: boolean }

// Error
{ type: "error", message: "..." }
```

### REST Endpoints

```
POST /api/voice/transcribe
  - Body: audio file (webm/mp3)
  - Returns: { text: "transcription" }

POST /api/voice/synthesize
  - Body: { text: "text to speak", voice?: "voice_id" }
  - Returns: audio stream (mp3)

GET /api/voice/voices
  - Returns: available ElevenLabs voices
```

## Environment Variables

```env
# OpenAI (for Whisper)
OPENAI_API_KEY=sk-...

# ElevenLabs
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=... # Default voice

# Optional: Anthropic (if not using existing config)
ANTHROPIC_API_KEY=sk-ant-...
```

## Voice UX Guidelines

1. **Latency Budget:** Target < 2 seconds end-to-end
   - STT: ~500ms
   - Claude: ~800ms (with streaming)
   - TTS: ~500ms (with streaming)

2. **Response Style:** 
   - Concise (1-3 sentences typical)
   - Conversational tone
   - Avoid lists/formatting (hard to speak)

3. **Feedback:**
   - Always show visual state (listening/thinking/speaking)
   - Play subtle sounds for state changes
   - Show transcription for confirmation

4. **Error Handling:**
   - "I didn't catch that" for unclear audio
   - Graceful fallback to text input
   - Auto-retry on transient failures

## File Structure

```
src/
├── server/
│   └── voice/
│       ├── websocket.ts      # WebSocket handler
│       ├── stt.ts            # Whisper integration
│       ├── tts.ts            # ElevenLabs integration
│       ├── session.ts        # Voice session state
│       └── routes.ts         # REST endpoints
├── components/
│   └── VoiceMode/
│       ├── VoiceMode.tsx     # Main component
│       ├── VoiceButton.tsx   # Push-to-talk button
│       ├── Waveform.tsx      # Audio visualizer
│       ├── VoiceStatus.tsx   # Status indicator
│       └── hooks/
│           ├── useAudioRecorder.ts
│           ├── useAudioPlayer.ts
│           └── useVoiceWebSocket.ts
└── lib/
    └── voice/
        ├── audioUtils.ts     # Format conversion
        └── vadUtils.ts       # Voice activity detection
```

## Estimated Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Phase 1 | 2-3 hours | Backend voice APIs working |
| Phase 2 | 3-4 hours | Basic voice UI functional |
| Phase 3 | 2 hours | Full conversation loop |
| Phase 4 | 2 hours | Mobile polished |
| Phase 5 | 4+ hours | Advanced features |

**MVP (Phases 1-3):** ~8 hours
**Full Feature Set:** ~15 hours

## Dependencies to Add

```bash
pnpm add openai          # Whisper API
pnpm add elevenlabs      # TTS API  
pnpm add hono            # Already have - add WebSocket adapter
pnpm add @hono/node-ws   # WebSocket support for Hono
```

## Notes

- Reusing patterns from claude-voice-commander where applicable
- Voice conversations should also appear in text chat history
- Consider adding "voice note" mode (record → send as audio message)
- Future: WebRTC for even lower latency
