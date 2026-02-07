/**
 * Hook for playing audio responses
 */

import { useCallback, useRef, useState } from "react";

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isPaused: boolean;
  duration: number;
  currentTime: number;
  play: (base64Audio: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
}

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (timeUpdateIntervalRef.current) {
      clearInterval(timeUpdateIntervalRef.current);
      timeUpdateIntervalRef.current = null;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }

    setIsPlaying(false);
    setIsPaused(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  const play = useCallback(
    async (base64Audio: string) => {
      // Clean up any existing playback
      cleanup();

      return new Promise<void>((resolve, reject) => {
        try {
          // Convert base64 to blob
          const binaryString = atob(base64Audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: "audio/mpeg" });
          const url = URL.createObjectURL(blob);

          // Create audio element
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onloadedmetadata = () => {
            setDuration(audio.duration);
          };

          audio.onplay = () => {
            setIsPlaying(true);
            setIsPaused(false);

            // Start time update interval
            timeUpdateIntervalRef.current = window.setInterval(() => {
              if (audioRef.current) {
                setCurrentTime(audioRef.current.currentTime);
              }
            }, 100);
          };

          audio.onpause = () => {
            setIsPaused(true);
          };

          audio.onended = () => {
            cleanup();
            URL.revokeObjectURL(url);
            resolve();
          };

          audio.onerror = (e) => {
            console.error("Audio playback error:", e);
            cleanup();
            URL.revokeObjectURL(url);
            reject(new Error("Failed to play audio"));
          };

          // Start playback
          audio.play().catch((err) => {
            console.error("Failed to start audio playback:", err);
            cleanup();
            URL.revokeObjectURL(url);
            reject(err);
          });
        } catch (err) {
          console.error("Failed to decode audio:", err);
          cleanup();
          reject(err);
        }
      });
    },
    [cleanup],
  );

  const pause = useCallback(() => {
    if (audioRef.current && !audioRef.current.paused) {
      audioRef.current.pause();
    }
  }, []);

  const resume = useCallback(() => {
    if (audioRef.current?.paused) {
      audioRef.current.play().catch(console.error);
    }
  }, []);

  const stop = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const setVolume = useCallback((volume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = Math.max(0, Math.min(1, volume));
    }
  }, []);

  return {
    isPlaying,
    isPaused,
    duration,
    currentTime,
    play,
    pause,
    resume,
    stop,
    setVolume,
  };
}
