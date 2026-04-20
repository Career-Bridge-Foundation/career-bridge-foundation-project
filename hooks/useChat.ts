"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, Prompt } from "@/types";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your simulation coach. I can help guide your thinking on this task — just ask me a question. I won't write your answers, but I'll help you think through the problem.",
};

interface UseChatOptions {
  prompt: Prompt;
}

interface UseChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  send: () => Promise<void>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

export function useChat({ prompt }: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const userMessage = input.trim();
    if (!userMessage || isStreaming) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage,
          taskTitle: prompt.title,
          taskDescription: prompt.question,
          taskGuidance: prompt.guidance,
        }),
      });

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let delimIdx = buffer.indexOf("\n\n");
        while (delimIdx !== -1) {
          const rawEvent = buffer.slice(0, delimIdx);
          buffer = buffer.slice(delimIdx + 2);
          delimIdx = buffer.indexOf("\n\n");

          for (const line of rawEvent.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as { type?: string; text?: string; message?: string };
              if (parsed.type === "error") throw new Error(parsed.message || "Stream error");
              if (parsed.type === "delta" && parsed.text) {
                setMessages((prev) => {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...updated[updated.length - 1],
                    content: updated[updated.length - 1].content + parsed.text,
                  };
                  return updated;
                });
              }
            } catch (e) {
              if ((e as Error).message !== "Stream error") continue;
              throw e;
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          content: "Sorry, I couldn't connect. Please try again.",
        };
        return updated;
      });
    } finally {
      setIsStreaming(false);
    }
  }, [input, isStreaming, prompt]);

  return { messages, input, setInput, isStreaming, isOpen, setIsOpen, send, chatEndRef };
}
