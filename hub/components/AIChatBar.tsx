"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useAppTabs } from "@/lib/appTabsContext";

type Message = { role: "user" | "ai"; text: string };

const COLLAPSED_H = 32;
const EXPANDED_H = 120;

export function AIChatBar() {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { activeSlug } = useAppTabs();

  // Eye animation
  const eyeRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(0);
  const animRef = useRef<number>();
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    function tick() {
      const speed = loadingRef.current ? 0.09 : 0.016;
      const ampX = loadingRef.current ? 4 : 3;
      const ampY = loadingRef.current ? 1.5 : 0;
      phaseRef.current += speed;
      const x = Math.sin(phaseRef.current) * ampX;
      const y = loadingRef.current ? Math.sin(phaseRef.current * 1.7) * ampY : 0;
      if (eyeRef.current) {
        eyeRef.current.style.transform = `translate(${x}px, ${y}px)`;
      }
      animRef.current = requestAnimationFrame(tick);
    }
    animRef.current = requestAnimationFrame(tick);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // Scroll history to bottom
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, streaming]);

  const submit = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setLoading(true);
    setStreaming("");

    const userMsg: Message = { role: "user", text: msg };
    setHistory((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          context: { pathname, activeApp: activeSlug ?? null },
        }),
      });

      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreaming(fullText);
      }

      setHistory((prev) => [...prev, { role: "ai", text: fullText }]);
    } catch (e) {
      const errText = e instanceof Error ? `Error: ${e.message}` : "Error al contactar al asistente.";
      setHistory((prev) => [...prev, { role: "ai", text: errText }]);
    } finally {
      setLoading(false);
      setStreaming("");
    }
  }, [input, loading, pathname, activeSlug]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") setInput("");
  };

  const lastAiMsg = [...history].reverse().find((h) => h.role === "ai")?.text ?? "";

  return (
    <div
      className="shrink-0 border-t border-amber-800/50 bg-amber-950"
      style={{
        height: expanded ? EXPANDED_H : COLLAPSED_H,
        transition: "height 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      {/* Expanded history */}
      <div
        className="overflow-y-auto flex flex-col gap-0.5 px-3 py-1.5"
        style={{ height: EXPANDED_H - COLLAPSED_H, display: expanded ? "flex" : "none" }}
      >
        {history.length === 0 && (
          <p className="text-xs text-amber-900 italic select-none">
            Preguntá sobre el hub o la empresa…
          </p>
        )}
        {history.map((h, i) => (
          <div
            key={i}
            className={`text-xs leading-relaxed ${
              h.role === "user" ? "text-amber-600" : "text-amber-200/90"
            }`}
          >
            <span className="select-none text-amber-800 mr-1">
              {h.role === "user" ? "›" : "◈"}
            </span>
            {h.text}
          </div>
        ))}
        {/* Streaming preview in expanded mode */}
        {loading && streaming && (
          <div className="text-xs leading-relaxed text-amber-200/90">
            <span className="select-none text-amber-800 mr-1">◈</span>
            {streaming}
            <span className="animate-pulse text-amber-500">▊</span>
          </div>
        )}
        {loading && !streaming && (
          <div className="text-xs text-amber-800 animate-pulse select-none">
            <span className="mr-1">◈</span>pensando…
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {/* Input row — always visible */}
      <div className="flex items-center gap-0 h-8 shrink-0">
        {/* Eye container */}
        <div
          className="flex items-center justify-center shrink-0"
          style={{ width: 36, height: 32 }}
        >
          {/* Outer eye shape */}
          <div
            className="relative flex items-center justify-center border border-amber-800/60"
            style={{ width: 18, height: 11, borderRadius: 9999 }}
          >
            {/* Pupil (animated square) */}
            <div
              ref={eyeRef}
              className="absolute"
              style={{
                width: 6,
                height: 6,
                backgroundColor: loading ? "#f59e0b" : "#b45309",
                transition: "background-color 0.4s",
              }}
            />
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-4 bg-amber-800/40 shrink-0" />

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "pensando…" : "preguntá sobre el hub o basement…"}
          disabled={loading}
          spellCheck={false}
          className="h-full px-2 bg-transparent text-amber-200 placeholder-amber-900 text-xs outline-none shrink-0"
          style={{ width: 220, caretColor: "#fbbf24" }}
        />

        {/* Divider */}
        <div className="w-px h-4 bg-amber-800/40 shrink-0" />

        {/* Inline response (collapsed mode only) */}
        {!expanded && (
          <div className="flex-1 min-w-0 px-2 text-xs text-amber-300/80 truncate">
            {loading && !streaming && (
              <span className="text-amber-800 animate-pulse select-none">▊▊▊</span>
            )}
            {loading && streaming && (
              <>
                {streaming}
                <span className="animate-pulse text-amber-500">▊</span>
              </>
            )}
            {!loading && (streaming || lastAiMsg) && (
              <span>{streaming || lastAiMsg}</span>
            )}
            {!loading && !streaming && !lastAiMsg && (
              <span className="text-amber-900 select-none italic">
                {history.length > 0 ? history[history.length - 1]?.text ?? "" : ""}
              </span>
            )}
          </div>
        )}

        {expanded && <div className="flex-1" />}

        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 px-3 h-full flex items-center text-amber-800 hover:text-amber-500 transition-colors"
          title={expanded ? "Colapsar" : "Expandir chat"}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>
    </div>
  );
}
