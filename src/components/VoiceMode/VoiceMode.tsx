/**
 * Voice Mode component - Full voice chat interface
 */

import {
  BotIcon,
  Loader2,
  Mic,
  Phone,
  Square,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useVoiceWebSocket, type VoiceState } from "./hooks/useVoiceWebSocket";

interface VoiceModeProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string; // Reserved for future use with project-specific voice sessions
}

// Generate a stable key for audio level bars
const AUDIO_BAR_KEYS = ["bar-0", "bar-1", "bar-2", "bar-3", "bar-4"];

// Visual audio level indicator
const AudioLevelMeter: FC<{ level: number; isActive: boolean }> = ({
  level,
  isActive,
}) => {
  const bars = 5;
  return (
    <div className="flex items-end gap-1 h-8">
      {AUDIO_BAR_KEYS.map((key, i) => {
        const threshold = (i + 1) / bars;
        const isLit = isActive && level >= threshold * 0.8;
        return (
          <div
            key={key}
            className={cn(
              "w-1.5 rounded-full transition-all duration-75",
              isLit ? "bg-primary" : "bg-gray-300 dark:bg-gray-600",
            )}
            style={{
              height: `${20 + i * 15}%`,
            }}
          />
        );
      })}
    </div>
  );
};

// Status indicator with animation
const StatusIndicator: FC<{ state: VoiceState }> = ({ state }) => {
  const getStatusConfig = () => {
    switch (state) {
      case "connecting":
        return {
          text: "Connecting...",
          color: "text-yellow-500",
          animate: true,
        };
      case "idle":
        return { text: "Ready", color: "text-green-500", animate: false };
      case "listening":
        return { text: "Listening...", color: "text-blue-500", animate: true };
      case "transcribing":
        return {
          text: "Processing speech...",
          color: "text-purple-500",
          animate: true,
        };
      case "thinking":
        return {
          text: "Clu is thinking...",
          color: "text-orange-500",
          animate: true,
        };
      case "speaking":
        return {
          text: "Clu is speaking...",
          color: "text-primary",
          animate: true,
        };
      case "error":
        return { text: "Error", color: "text-red-500", animate: false };
      default:
        return { text: "Disconnected", color: "text-gray-500", animate: false };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          "w-2 h-2 rounded-full",
          config.color.replace("text-", "bg-"),
          config.animate && "animate-pulse",
        )}
      />
      <span className={cn("text-sm font-medium", config.color)}>
        {config.text}
      </span>
    </div>
  );
};

// Message bubble
const MessageBubble: FC<{
  role: "user" | "assistant";
  content: string;
}> = ({ role, content }) => {
  const isUser = role === "user";

  return (
    <div
      className={cn(
        "max-w-[80%] rounded-2xl px-4 py-2",
        isUser
          ? "ml-auto bg-primary text-primary-foreground"
          : "mr-auto bg-gray-100 dark:bg-gray-800 text-foreground",
      )}
    >
      <p className="text-sm leading-relaxed">{content}</p>
    </div>
  );
};

export const VoiceMode: FC<VoiceModeProps> = ({
  isOpen,
  onClose,
  projectId: _projectId,
}) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const animationFrameRef = useRef<number>();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Hooks
  const voiceWs = useVoiceWebSocket();
  const recorder = useAudioRecorder((chunk) => {
    // Send audio chunks as they're recorded
    chunk.arrayBuffer().then((buffer) => {
      voiceWs.sendAudioChunk(buffer);
    });
  });
  const player = useAudioPlayer();

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  // Connect/disconnect on open/close
  useEffect(() => {
    if (isOpen && voiceWs.state === "disconnected") {
      voiceWs.connect();
    }
  }, [isOpen, voiceWs.state, voiceWs.connect]);

  // Handle audio playback when received
  useEffect(() => {
    voiceWs.onAudioReceived((audioData) => {
      if (!isMuted) {
        player.play(audioData).catch(console.error);
      }
    });
  }, [voiceWs, player, isMuted]);

  // Update audio level visualization
  useEffect(() => {
    if (!recorder.isRecording) {
      setAudioLevel(0);
      return;
    }

    const updateLevel = () => {
      setAudioLevel(recorder.getAudioLevel());
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateLevel);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [recorder.isRecording, recorder.getAudioLevel]);

  // Push-to-talk handlers
  const handlePushToTalkStart = useCallback(async () => {
    if (voiceWs.state !== "idle") return;

    // Stop any playing audio
    player.stop();
    voiceWs.interrupt();

    await recorder.startRecording();
  }, [voiceWs.state, player, voiceWs.interrupt, recorder]);

  const handlePushToTalkEnd = useCallback(async () => {
    if (!recorder.isRecording) return;

    await recorder.stopRecording();
    voiceWs.stopRecording();
  }, [recorder, voiceWs]);

  // Close handler
  const handleClose = useCallback(() => {
    recorder.cancelRecording();
    player.stop();
    voiceWs.disconnect();
    onClose();
  }, [recorder, player, voiceWs, onClose]);

  if (!isOpen) return null;

  const isConnected =
    voiceWs.state !== "disconnected" && voiceWs.state !== "connecting";
  const canRecord = voiceWs.state === "idle";

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <BotIcon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold">Voice Chat with Clu</h2>
            <StatusIndicator state={voiceWs.state} />
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mute button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMuted(!isMuted)}
            className="h-10 w-10"
          >
            {isMuted ? (
              <VolumeX className="w-5 h-5" />
            ) : (
              <Volume2 className="w-5 h-5" />
            )}
          </Button>

          {/* Close button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClose}
            className="h-10 w-10"
          >
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {voiceWs.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Mic className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Hold the button to speak</p>
            <p className="text-sm">I'll respond with voice and text</p>
          </div>
        ) : (
          <>
            {voiceWs.messages.map((msg) => (
              <MessageBubble
                key={msg.timestamp}
                role={msg.role}
                content={msg.content}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}

        {/* Thinking indicator */}
        {voiceWs.state === "thinking" && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Clu is thinking...</span>
          </div>
        )}

        {/* Transcription preview */}
        {voiceWs.state === "transcribing" && voiceWs.lastTranscription && (
          <div className="text-sm text-muted-foreground italic">
            "{voiceWs.lastTranscription}"
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-6 border-t bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          {/* Audio level meter */}
          <AudioLevelMeter level={audioLevel} isActive={recorder.isRecording} />

          {/* Push-to-talk button */}
          <button
            type="button"
            onMouseDown={handlePushToTalkStart}
            onMouseUp={handlePushToTalkEnd}
            onMouseLeave={handlePushToTalkEnd}
            onTouchStart={handlePushToTalkStart}
            onTouchEnd={handlePushToTalkEnd}
            disabled={!canRecord}
            className={cn(
              "w-20 h-20 rounded-full flex items-center justify-center transition-all",
              "focus:outline-none focus:ring-4 focus:ring-primary/30",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              recorder.isRecording
                ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30"
                : canRecord
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:scale-105"
                  : "bg-gray-300 dark:bg-gray-700 text-gray-500",
            )}
          >
            {recorder.isRecording ? (
              <Square className="w-8 h-8" />
            ) : voiceWs.state === "speaking" ? (
              <Volume2 className="w-8 h-8 animate-pulse" />
            ) : voiceWs.state === "thinking" ||
              voiceWs.state === "transcribing" ? (
              <Loader2 className="w-8 h-8 animate-spin" />
            ) : (
              <Mic className="w-8 h-8" />
            )}
          </button>

          {/* Instructions */}
          <p className="text-sm text-muted-foreground">
            {recorder.isRecording
              ? "Release to send"
              : canRecord
                ? "Hold to speak"
                : voiceWs.state === "speaking"
                  ? "Tap to interrupt"
                  : "Please wait..."}
          </p>

          {/* Connection status */}
          {!isConnected && (
            <Button
              variant="outline"
              onClick={() => voiceWs.connect()}
              className="gap-2"
            >
              <Phone className="w-4 h-4" />
              Connect
            </Button>
          )}

          {/* Error display */}
          {voiceWs.error && (
            <p className="text-sm text-red-500">{voiceWs.error}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMode;
