"use client";

import { useEffect, useRef, useState } from "react";
import { useFeaturesStore } from "@/store/featuresStore";
import { runAssistantCommand } from "@/engine/aiAssistant";

interface Message {
  from: "user" | "assistant";
  text: string;
}

export default function AIAssistantPanel() {
  const aiOpen = useFeaturesStore((s) => s.aiAssistantOpen);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollTo({
      top: bottomRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  if (!aiOpen) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await runAssistantCommand(text);
      setMessages((m) => [...m, { from: "assistant", text: res.reply }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Something went wrong.";
      setMessages((m) => [...m, { from: "assistant", text: msg }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-40 w-80 h-96 flex flex-col select-none rounded-xl border border-white/10 bg-gray-900/95 shadow-2xl shadow-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">AI Assistant</span>
      </div>
      <div ref={bottomRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2.5 text-xs">
        {messages.length === 0 && !loading && (
          <div className="text-[11px] text-gray-500">
            Hi! I can edit this canvas. Try: remove background, invert, grayscale, blur, sharpen,
            brighten, duplicate layer, flip horizontal, resize 50%, export png.
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={
              "rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed break-words " +
              (m.from === "user"
                ? "ml-auto max-w-[85%] bg-indigo-500/15 text-gray-100"
                : "mr-auto max-w-[85%] bg-white/5 text-gray-200")
            }
          >
            {m.text}
          </div>
        ))}
        {loading && (
          <div className="mr-auto max-w-[85%] rounded-lg bg-white/5 px-2.5 py-1.5 text-[12px] text-gray-400">
            Thinking…
          </div>
        )}
      </div>
      <div className="border-t border-white/10 p-2">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
            disabled={loading}
            placeholder="Ask the AI assistant…"
            className="flex-1 bg-gray-800 border border-white/10 rounded-md px-2.5 py-1.5 text-[12px] text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          />
          <button
            onClick={() => void send()}
            disabled={loading || !input.trim()}
            className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
