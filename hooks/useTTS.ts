"use client";

import { useCallback, useEffect, useState } from "react";

type TTSState = "idle" | "playing" | "paused";

export function useTTS() {
  const [state, setState] = useState<TTSState>("idle");
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    setIsSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => setState("idle");
    utterance.onerror = () => setState("idle");
    window.speechSynthesis.speak(utterance);
    setState("playing");
  }, []);

  const pause = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.pause();
    setState("paused");
  }, []);

  const resume = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.resume();
    setState("playing");
  }, []);

  const stop = useCallback(() => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    setState("idle");
  }, []);

  // toggle: idle → play, playing → pause, paused → resume
  const toggle = useCallback(
    (text: string) => {
      if (state === "playing") {
        pause();
      } else if (state === "paused") {
        resume();
      } else {
        speak(text);
      }
    },
    [state, pause, resume, speak]
  );

  return { state, isSupported, stop, toggle };
}
