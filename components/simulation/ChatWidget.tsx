"use client";

import { cn } from "@/lib/cn";
import type { ChatMessage, Prompt } from "@/types";
import { useChat } from "@/hooks/useChat";

interface ChatWidgetProps {
  prompt: Prompt;
}

export function ChatWidget({ prompt }: ChatWidgetProps) {
  const { messages, input, setInput, isStreaming, isOpen, setIsOpen, send, chatEndRef } =
    useChat({ prompt });

  return (
    <>
      {/* Floating chat panel */}
      <div
        className={cn(
          "chat-panel fixed z-[100] flex flex-col overflow-hidden bg-white border border-[#E5E7EB]",
          isOpen ? "chat-panel-open" : "chat-panel-closed"
        )}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between px-4 py-3 shrink-0 bg-navy">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.png"
              alt="CB"
              className="w-[22px] h-[22px] object-contain rounded-[4px]"
            />
            <span className="text-sm font-bold text-white">Simulation Assistant</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="chat-close-btn flex items-center justify-center w-7 h-7 text-white/70"
            aria-label="Close chat"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Messages area */}
        <div className="flex-1 flex flex-col gap-3 p-4 overflow-y-auto bg-[#F9FAFB]">
          {messages.map((msg: ChatMessage, i: number) => (
            <div
              key={i}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <img
                  src="/logo.png"
                  alt="CB"
                  className="w-5 h-5 object-contain rounded-[3px] shrink-0 mt-0.5"
                />
              )}
              <div
                className={cn(
                  "max-w-[85%] px-3 py-2.5 rounded-lg text-[13px] leading-[1.65]",
                  msg.role === "user"
                    ? "bg-link-blue text-white"
                    : "bg-white text-navy border border-border-light"
                )}
              >
                {msg.role === "assistant" &&
                msg.content === "" &&
                isStreaming &&
                i === messages.length - 1 ? (
                  <span className="flex gap-1 items-center h-4">
                    {(["typing-dot-1", "typing-dot-2", "typing-dot-3"] as const).map((cls) => (
                      <span
                        key={cls}
                        className={`${cls} size-1.5 rounded-full bg-teal inline-block animate-bounce`}
                      />
                    ))}
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input row */}
        <div className="flex shrink-0 border-t border-[#E5E7EB]">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); send(); }
            }}
            placeholder="Ask your coach..."
            disabled={isStreaming}
            className={cn(
              "flex-1 px-4 py-3 text-sm text-[#333] border-none outline-none font-[inherit]",
              isStreaming ? "bg-[#fafafa]" : "bg-white"
            )}
          />
          <button
            onClick={send}
            disabled={isStreaming || !input.trim()}
            className={cn(
              "flex items-center justify-center px-4 transition-colors",
              isStreaming || !input.trim() ? "bg-[#b2e4ea] cursor-not-allowed" : "bg-teal"
            )}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13" />
              <polygon points="22,2 15,22 11,13 2,9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Floating toggle FAB */}
      <div className="fixed bottom-6 right-6 z-[101]">
        {/* Notification dot */}
        {!isOpen && (
          <div className="absolute top-0.5 right-0.5 size-3 rounded-full bg-teal border-2 border-white z-[1]" />
        )}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="chat-fab bg-navy flex items-center justify-center"
          aria-label="Toggle coaching assistant"
        >
          {isOpen ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <img
              src="/logo.png"
              alt="Open assistant"
              className="w-[30px] h-[30px] object-contain"
            />
          )}
        </button>
      </div>
    </>
  );
}
