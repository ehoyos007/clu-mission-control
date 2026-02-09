/**
 * Voice Mode component - Full voice chat interface
 */

import { Loader2, Mic, Phone, Volume2, VolumeX, X } from "lucide-react";
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
  const [isMuted, setIsMuted] = useState(false);
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

  // Handle audio playback when received, then auto-listen
  useEffect(() => {
    voiceWs.onAudioReceived((audioData) => {
      if (!isMuted) {
        player
          .play(audioData)
          .then(() => {
            // Auto-start listening after Clu finishes speaking
            if (voiceWs.state === "idle" && !isRecordingRef.current) {
              // Small delay before auto-listening
              setTimeout(() => {
                if (voiceWs.state === "idle" && !isRecordingRef.current) {
                  void recorder
                    .startRecording()
                    .then(() => {
                      isRecordingRef.current = true;
                      setIsRecordingLocal(true);
                    })
                    .catch(console.error);
                }
              }, 500);
            }
          })
          .catch(console.error);
      }
    });
  }, [voiceWs, player, isMuted, recorder]);

  // Track recording state with a ref to avoid stale closure issues
  const [isRecordingLocal, setIsRecordingLocal] = useState(false);
  const isRecordingRef = useRef(false);

  // Tap-to-toggle recording
  const handleMicTap = useCallback(async () => {
    if (isRecordingRef.current) {
      // Currently recording - stop and send
      isRecordingRef.current = false;
      setIsRecordingLocal(false);
      void recorder.stopRecording();
      voiceWs.stopRecording();
    } else if (voiceWs.state === "idle") {
      // Start recording
      player.stop();
      voiceWs.interrupt();

      try {
        await recorder.startRecording();
        isRecordingRef.current = true;
        setIsRecordingLocal(true);
      } catch (err) {
        console.error("[Voice] Recording failed:", err);
        isRecordingRef.current = false;
        setIsRecordingLocal(false);
      }
    }
  }, [
    voiceWs.state,
    voiceWs.interrupt,
    voiceWs.stopRecording,
    recorder,
    player,
  ]);

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
  const _canRecord = voiceWs.state === "idle";

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
            <p className="text-lg font-medium">Tap to start talking</p>
            <p className="text-sm">I'll listen and respond</p>
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
      </div>

      {/* Controls */}
      <div className="p-8 border-t bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          {/* Tap-to-toggle mic button */}
          <button
            type="button"
            onClick={handleMicTap}
            disabled={
              voiceWs.state === "thinking" || voiceWs.state === "transcribing"
            }
            className={cn(
              "w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300",
              "focus:outline-none",
              "select-none z-50 relative",
              "active:scale-95",
              "shadow-xl",
              isRecordingLocal || recorder.isRecording
                ? "bg-red-500 text-white scale-105 shadow-red-500/40 animate-pulse"
                : voiceWs.state === "speaking"
                  ? "bg-primary/80 text-primary-foreground"
                  : voiceWs.state === "thinking" ||
                      voiceWs.state === "transcribing"
                    ? "bg-gray-400 dark:bg-gray-600 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {isRecordingLocal || recorder.isRecording ? (
              <div className="flex flex-col items-center">
                <Mic className="w-10 h-10 mb-1" />
                <span className="text-xs font-medium">Listening...</span>
              </div>
            ) : voiceWs.state === "speaking" ? (
              <div className="flex flex-col items-center">
                <Volume2 className="w-10 h-10 mb-1 animate-pulse" />
                <span className="text-xs font-medium">Speaking</span>
              </div>
            ) : voiceWs.state === "thinking" ||
              voiceWs.state === "transcribing" ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-10 h-10 mb-1 animate-spin" />
                <span className="text-xs font-medium">Thinking...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Mic className="w-10 h-10 mb-1" />
                <span className="text-xs font-medium">Tap to talk</span>
              </div>
            )}
          </button>

          {/* Connection status - only show if disconnected */}
          {!isConnected && (
            <Button
              variant="outline"
              onClick={() => voiceWs.connect()}
              className="gap-2 mt-4"
            >
              <Phone className="w-4 h-4" />
              {voiceWs.state === "connecting" ? "Connecting..." : "Connect"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoiceMode;
