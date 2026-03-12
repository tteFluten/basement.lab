"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { useAppTabs } from "@/lib/appTabsContext";

type Message = { role: "user" | "ai"; text: string };

const COLLAPSED_H = 32;
const EXPANDED_H = 120;

const ZONES: Record<string, string> = {
  toolbar:             '[data-zone="toolbar"]',
  tabs:                '[data-zone="tabs"]',
  footer:              '[data-zone="footer"]',
  "model-selector":    '[data-zone="model-selector"]',
  "theme-toggle":      '[data-zone="theme-toggle"]',
  "visibility-toggle": '[data-zone="visibility-toggle"]',
  chat:                '[data-zone="ai-chat"]',
};

function stripZones(text: string) {
  return text.replace(/\{\{zone:[a-z-]+\}\}/g, "").trim();
}

function extractZone(text: string): string | null {
  const m = text.match(/\{\{zone:([a-z-]+)\}\}/);
  return m ? m[1] : null;
}

export function AIChatBar() {
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);

  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { activeSlug } = useAppTabs();
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? null;
  const userEmail = (session?.user as { email?: string } | undefined)?.email ?? null;
  const lastInteractionRef = useRef<number>(Date.now());

  const triggerZone = useCallback((zoneName: string) => {
    const sel = ZONES[zoneName];
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    setHighlight(el.getBoundingClientRect());
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlight(null), 3500);
  }, []);

  // Shared fetch helper — used by both submit and spontaneous
  const pathnameRef = useRef(pathname);
  const activeSlugRef = useRef(activeSlug);
  const userNameRef = useRef(userName);
  const userEmailRef = useRef(userEmail);
  const historyRef = useRef<Message[]>([]);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  useEffect(() => { activeSlugRef.current = activeSlug; }, [activeSlug]);
  useEffect(() => { userNameRef.current = userName; }, [userName]);
  useEffect(() => { userEmailRef.current = userEmail; }, [userEmail]);
  useEffect(() => { historyRef.current = history; }, [history]);

  const callPatas = useCallback(async (message: string, spontaneous = false) => {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        spontaneous,
        history: historyRef.current.slice(-20), // last 20 messages for context
        context: {
          pathname: pathnameRef.current,
          activeApp: activeSlugRef.current ?? null,
          userName: userNameRef.current,
          userEmail: userEmailRef.current,
        },
      }),
    });
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    return res.body.getReader();
  }, []);

  // Spontaneous messages — Patas speaks every 4-8 min if idle >2 min
  useEffect(() => {
    function scheduleNext() {
      const delay = (Math.random() * 4 + 4) * 60 * 1000; // 4–8 min
      return setTimeout(async () => {
        const idleMs = Date.now() - lastInteractionRef.current;
        if (idleMs < 2 * 60 * 1000) { scheduleNext(); return; } // too recent
        try {
          const reader = await callPatas("__spontaneous__", true);
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
            setStreaming(stripZones(text));
          }
          const zone = extractZone(text);
          if (zone) triggerZone(zone);
          const clean = stripZones(text);
          setStreaming("");
          setHistory(prev => [...prev, { role: "ai", text: clean }]);
        } catch { /* silently ignore */ }
        scheduleNext();
      }, delay);
    }
    const t = scheduleNext();
    return () => clearTimeout(t);
  }, [callPatas, triggerZone]);

  // Eye animation
  const eyeRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(0);
  const animRef = useRef<number>();
  const loadingRef = useRef(false);
  // Blink state: frames until next blink, and blink progress (0=open, peaks at 1=closed)
  const blinkCountdownRef = useRef(Math.random() * 180 + 120); // ~2-5s at 60fps
  const blinkProgressRef = useRef(0); // 0..1..0

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    function tick() {
      const isLoading = loadingRef.current;
      const speed = isLoading ? 0.13 : 0.016;
      const ampX = isLoading ? 6 : 3;
      const ampY = isLoading ? 2.5 : 0;

      phaseRef.current += speed;
      const x = Math.sin(phaseRef.current) * ampX;
      const y = isLoading ? Math.sin(phaseRef.current * 1.7) * ampY : 0;

      // Blink logic
      blinkCountdownRef.current -= 1;
      let scaleY = 1;
      if (blinkCountdownRef.current <= 0) {
        // Drive blink progress 0→1→0 over ~12 frames
        blinkProgressRef.current += 1 / 6;
        if (blinkProgressRef.current >= 2) {
          blinkProgressRef.current = 0;
          blinkCountdownRef.current = Math.random() * 240 + 120;
        }
        const t = blinkProgressRef.current <= 1 ? blinkProgressRef.current : 2 - blinkProgressRef.current;
        scaleY = 1 - t * 0.92; // squish to ~8% height at peak
      }

      if (eyeRef.current) {
        eyeRef.current.style.transform = `translate(${x}px, ${y}px) scaleY(${scaleY})`;
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
    lastInteractionRef.current = Date.now();

    const userMsg: Message = { role: "user", text: msg };
    setHistory((prev) => [...prev, userMsg]);

    try {
      const reader = await callPatas(msg);
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setStreaming(stripZones(fullText));
      }

      const zone = extractZone(fullText);
      if (zone) triggerZone(zone);
      const cleanText = stripZones(fullText);
      setHistory((prev) => [...prev, { role: "ai", text: cleanText }]);
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
  const C = "rgb(255,77,0)";
  const Cfaint = "rgba(255,77,0,0.25)";
  const Cdim = "rgba(255,77,0,0.45)";

  return (
    <>
    <style>{`
      #ai-chat-input::placeholder { color: rgba(255,77,0,0.3); }
      @keyframes patas-ping {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.35; }
      }
      #patas-history::-webkit-scrollbar { width: 3px; }
      #patas-history::-webkit-scrollbar-track { background: transparent; }
      #patas-history::-webkit-scrollbar-thumb { background: rgba(255,77,0,0.25); border-radius: 2px; }
      #patas-history::-webkit-scrollbar-thumb:hover { background: rgba(255,77,0,0.5); }
      #patas-history { scrollbar-width: thin; scrollbar-color: rgba(255,77,0,0.25) transparent; }
    `}</style>

    {/* Zone highlight overlay */}
    {highlight && (
      <div
        style={{
          position: "fixed",
          top: highlight.top - 3,
          left: highlight.left - 3,
          width: highlight.width + 6,
          height: highlight.height + 6,
          border: "2px solid rgb(255,77,0)",
          pointerEvents: "none",
          zIndex: 9998,
          animation: "patas-ping 1s ease-in-out infinite",
          boxShadow: "0 0 8px rgba(255,77,0,0.4), inset 0 0 8px rgba(255,77,0,0.08)",
        }}
      />
    )}

    <div
      data-zone="ai-chat"
      className="shrink-0"
      style={{
        backgroundColor: "#110600",
        borderTop: `1px solid rgba(255,77,0,0.18)`,
        height: expanded ? EXPANDED_H : COLLAPSED_H,
        transition: "height 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      {/* Expanded history */}
      <div
        id="patas-history"
        className="overflow-y-auto flex flex-col gap-0.5 px-3 py-1.5"
        style={{ height: EXPANDED_H - COLLAPSED_H, display: expanded ? "flex" : "none" }}
      >
        {history.length === 0 && (
          <p className="text-xs italic select-none" style={{ color: Cfaint }}>
            Preguntá sobre el hub o la empresa…
          </p>
        )}
        {history.map((h, i) => (
          <div key={i} className="text-xs leading-relaxed" style={{ color: h.role === "user" ? Cdim : C }}>
            <span className="select-none mr-1" style={{ color: Cfaint }}>
              {h.role === "user" ? "›" : "◈"}
            </span>
            {h.text}
          </div>
        ))}
        {loading && streaming && (
          <div className="text-xs leading-relaxed" style={{ color: C }}>
            <span className="select-none mr-1" style={{ color: Cfaint }}>◈</span>
            {streaming}
            <span className="animate-pulse" style={{ color: Cdim }}>▊</span>
          </div>
        )}
        {loading && !streaming && (
          <div className="text-xs animate-pulse select-none" style={{ color: Cfaint }}>
            <span className="mr-1">◈</span>pensando…
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {/* Input row — always visible */}
      <div className="flex items-center gap-0 h-8 shrink-0">
        {/* Eye — bare animated square, no border */}
        <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 32 }}>
          <div ref={eyeRef} style={{ width: 6, height: 6, backgroundColor: C }} />
        </div>

        {/* Divider */}
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: Cfaint }} />

        {/* Input field */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Patas"
          disabled={loading}
          spellCheck={false}
          id="ai-chat-input"
          className="h-full px-2 bg-transparent text-xs outline-none min-w-0"
          style={{ flex: "0 1 180px", color: C, caretColor: C }}
        />

        {/* Divider */}
        <div className="w-px h-4 shrink-0" style={{ backgroundColor: Cfaint }} />

        {/* Inline response (collapsed mode only) */}
        {!expanded && (
          <div className="flex-1 min-w-0 px-2 text-xs truncate" style={{ color: C }}>
            {loading && !streaming && (
              <span className="animate-pulse" style={{ color: Cfaint }}>▊▊▊</span>
            )}
            {loading && streaming && (
              <>
                {streaming}
                <span className="animate-pulse" style={{ color: Cdim }}>▊</span>
              </>
            )}
            {!loading && (streaming || lastAiMsg) && (
              <span>{streaming || lastAiMsg}</span>
            )}
          </div>
        )}

        {expanded && <div className="flex-1" />}

        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 px-3 h-full flex items-center transition-colors"
          style={{ color: Cdim }}
          title={expanded ? "Colapsar" : "Expandir chat"}
        >
          {expanded ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        </button>
      </div>
    </div>
    </>
  );
}
