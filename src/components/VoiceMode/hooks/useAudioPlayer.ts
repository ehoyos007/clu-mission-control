/**
 * Hook for playing audio responses
 */

import { useCallback, useRef, useState } from "react";

export interface UseAudioPlayerReturn {
  isPlaying: boolean;
  isPaused: boolean;
  duration: number;
  currentTime: number;
  isUnlocked: boolean;
  play: (base64Audio: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  unlock: () => Promise<void>;
}

// Track if audio has been unlocked globally
let audioUnlocked = false;

export function useAudioPlayer(): UseAudioPlayerReturn {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isUnlocked, setIsUnlocked] = useState(audioUnlocked);

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
      console.log(
        "[AudioPlayer] play() called, base64 length:",
        base64Audio.length,
      );

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
          console.log(
            "[AudioPlayer] Created blob URL:",
            url,
            "size:",
            blob.size,
          );

          // Create audio element
          const audio = new Audio(url);
          audioRef.current = audio;

          audio.onloadedmetadata = () => {
            console.log(
              "[AudioPlayer] Metadata loaded, duration:",
              audio.duration,
            );
            setDuration(audio.duration);
          };

          audio.onplay = () => {
            console.log("[AudioPlayer] Playing started");
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
            console.log("[AudioPlayer] Paused");
            setIsPaused(true);
          };

          audio.onended = () => {
            console.log("[AudioPlayer] Playback ended");
            cleanup();
            URL.revokeObjectURL(url);
            resolve();
          };

          audio.onerror = (e) => {
            console.error("[AudioPlayer] Audio error:", e, audio.error);
            cleanup();
            URL.revokeObjectURL(url);
            reject(
              new Error(
                `Failed to play audio: ${audio.error?.message || "unknown error"}`,
              ),
            );
          };

          // Start playback
          console.log("[AudioPlayer] Calling audio.play()");
          audio.play().catch((err) => {
            console.error("[AudioPlayer] play() promise rejected:", err);
            cleanup();
            URL.revokeObjectURL(url);
            reject(err);
          });
        } catch (err) {
          console.error("[AudioPlayer] Exception in play:", err);
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

  /**
   * Unlock audio playback on Safari/iOS
   * Must be called from a user interaction (click/tap)
   */
  const unlock = useCallback(async () => {
    if (audioUnlocked) {
      setIsUnlocked(true);
      return;
    }

    try {
      // Create and play a silent audio to unlock
      const audio = new Audio();
      // Tiny silent MP3 (base64)
      audio.src =
        "data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7//////////////////////////////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAYYoRwmHAAAAAAD/+1DEAAAGAAGn9AAAIgAANP8AAABEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//tQxAAAAAANIAAAAAAAAAA0gAAAAABExBTUUzLjEwMFVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVV";
      audio.volume = 0.01;

      await audio.play();
      audio.pause();

      audioUnlocked = true;
      setIsUnlocked(true);
      console.log("[AudioPlayer] Audio unlocked for Safari");
    } catch (err) {
      console.warn("[AudioPlayer] Failed to unlock audio:", err);
    }
  }, []);

  return {
    isPlaying,
    isPaused,
    duration,
    currentTime,
    isUnlocked,
    play,
    pause,
    resume,
    stop,
    setVolume,
    unlock,
  };
}
