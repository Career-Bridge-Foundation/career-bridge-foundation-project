"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ChatMessage, Prompt } from "@/types";

const INITIAL_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi! I'm your practice coach. Ask me anything about this task — I won't write your answer, but I'll help you think it through. This is a free practice run, so there's no score or credential at the end, just quick feedback.",
};

const CAP_REACHED_MESSAGE: ChatMessage = {
  role: "assistant",
  content: "You've reached the conversation limit for this practice run. You can still submit your response whenever you're ready.",
};

interface UsePracticeChatOptions {
  runId: string | null;
  prompt: Prompt;
}

interface UsePracticeChatReturn {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  isStreaming: boolean;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  capReached: boolean;
  send: () => Promise<void>;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Mirrors hooks/useChat.ts, but targets the practice message endpoint
 * (lightweight model, persisted per-run cap) instead of /api/chat. Kept as
 * a separate hook rather than a mode flag on useChat — Spec 14 decision 7's
 * "enforced by routing, not a conditional" applies here too: the assessed
 * coaching chat and the practice chat must not share a code path that a
 * flag could cross-wire.
 */
export function usePracticeChat({ runId, prompt }: UsePracticeChatOptions): UsePracticeChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [capReached, setCapReached] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(async () => {
    const userMessage = input.trim();
    if (!userMessage || isStreaming || capReached || !runId) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch(`/api/practice/runs/${runId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            ...messages.slice(1).filter((m) => m.content !== ""),
            { role: "user" as const, content: userMessage },
          ],
          taskTitle: prompt.title,
          taskDescription: prompt.question,
          taskGuidance: prompt.guidance,
        }),
      });

      // cap_reached comes back as a normal 200 JSON body, not a stream
      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.error === "cap_reached") {
          setCapReached(true);
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = CAP_REACHED_MESSAGE;
            return updated;
          });
          return;
        }
        throw new Error(data.error ?? "API error");
      }

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + text,
          };
          return updated;
        });
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
  }, [input, isStreaming, capReached, runId, prompt, messages]);

  return { messages, input, setInput, isStreaming, isOpen, setIsOpen, capReached, send, chatEndRef };
}
