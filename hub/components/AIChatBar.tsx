"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { useAppTabs } from "@/lib/appTabsContext";

type Message = { role: "user" | "ai"; text: string };

const COLLAPSED_H = 32;
const EXPANDED_H = 120;
const COLLAPSED_MAX_CHARS = 90;
const WORD_DELAY_MS = 36;

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

const MAX_STORED_MESSAGES = 80;

function truncateForBar(text: string): { visible: string; hasMore: boolean } {
  if (text.length <= COLLAPSED_MAX_CHARS) return { visible: text, hasMore: false };
  const cut = text.slice(0, COLLAPSED_MAX_CHARS).replace(/\s+\S*$/, "") || text.slice(0, COLLAPSED_MAX_CHARS);
  return { visible: cut, hasMore: true };
}

function loadHistory(userEmail: string | null): Message[] {
  try {
    const key = `patas-history:${userEmail ?? "anon"}`;
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as Message[];
  } catch { return []; }
}

function saveHistory(userEmail: string | null, history: Message[]) {
  try {
    const key = `patas-history:${userEmail ?? "anon"}`;
    const trimmed = history.slice(-MAX_STORED_MESSAGES);
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch { /* quota exceeded etc, ignore */ }
}

export function AIChatBar() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [history, setHistory] = useState<Message[]>([]);
  const [animatedText, setAnimatedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { activeSlug } = useAppTabs();
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? null;
  const userEmail = (session?.user as { email?: string } | undefined)?.email ?? null;
  const lastInteractionRef = useRef<number>(Date.now());
  const userEmailRef2 = useRef(userEmail);
  useEffect(() => { userEmailRef2.current = userEmail; }, [userEmail]);

  // Load persisted history once session is known
  useEffect(() => {
    if (session === undefined) return; // still loading
    const stored = loadHistory(userEmail);
    if (stored.length > 0) setHistory(stored);
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Persist history on every change
  useEffect(() => {
    if (history.length === 0) return;
    saveHistory(userEmailRef2.current, history);
  }, [history]);

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

  // Zone highlight
  const triggerZone = useCallback((zoneName: string) => {
    const sel = ZONES[zoneName];
    if (!sel) return;
    const el = document.querySelector(sel);
    if (!el) return;
    setHighlight(el.getBoundingClientRect());
    clearTimeout(highlightTimerRef.current);
    highlightTimerRef.current = setTimeout(() => setHighlight(null), 3500);
  }, []);

  // Word-by-word animation
  const animateWords = useCallback((text: string, onDone?: () => void) => {
    animTimersRef.current.forEach(clearTimeout);
    animTimersRef.current = [];
    setAnimatedText("");
    setIsAnimating(true);
    const words = text.split(" ");
    words.forEach((word, i) => {
      const t = setTimeout(() => {
        setAnimatedText(prev => i === 0 ? word : prev + " " + word);
        if (i === words.length - 1) {
          setIsAnimating(false);
          onDone?.();
        }
      }, i * WORD_DELAY_MS);
      animTimersRef.current.push(t);
    });
  }, []);

  useEffect(() => {
    return () => { animTimersRef.current.forEach(clearTimeout); };
  }, []);

  // Fetch helper
  const callPatas = useCallback(async (message: string, spontaneous = false) => {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        spontaneous,
        history: historyRef.current.slice(-30),
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

  // Spontaneous messages
  useEffect(() => {
    function scheduleNext() {
      const delay = (Math.random() * 4 + 4) * 60 * 1000;
      return setTimeout(async () => {
        const idleMs = Date.now() - lastInteractionRef.current;
        if (idleMs < 2 * 60 * 1000) { scheduleNext(); return; }
        try {
          const reader = await callPatas("__spontaneous__", true);
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
          }
          const zone = extractZone(text);
          if (zone) triggerZone(zone);
          const clean = stripZones(text);
          setHistory(prev => [...prev, { role: "ai", text: clean }]);
          animateWords(clean);
        } catch { /* silently ignore */ }
        scheduleNext();
      }, delay);
    }
    const t = scheduleNext();
    return () => clearTimeout(t);
  }, [callPatas, triggerZone, animateWords]);

  // Eye animation
  const eyeRef = useRef<HTMLDivElement>(null);
  const phaseRef = useRef(0);
  const rafRef = useRef<number>();
  const loadingRef = useRef(false);
  const blinkCountdownRef = useRef(Math.random() * 180 + 120);
  const blinkProgressRef = useRef(0);

  useEffect(() => { loadingRef.current = loading; }, [loading]);

  useEffect(() => {
    function tick() {
      const isLoading = loadingRef.current;
      phaseRef.current += isLoading ? 0.13 : 0.016;
      const x = Math.sin(phaseRef.current) * (isLoading ? 6 : 3);
      const y = isLoading ? Math.sin(phaseRef.current * 1.7) * 2.5 : 0;
      blinkCountdownRef.current -= 1;
      let scaleY = 1;
      if (blinkCountdownRef.current <= 0) {
        blinkProgressRef.current += 1 / 6;
        if (blinkProgressRef.current >= 2) {
          blinkProgressRef.current = 0;
          blinkCountdownRef.current = Math.random() * 240 + 120;
        }
        const t = blinkProgressRef.current <= 1 ? blinkProgressRef.current : 2 - blinkProgressRef.current;
        scaleY = 1 - t * 0.92;
      }
      if (eyeRef.current) {
        eyeRef.current.style.transform = `translate(${x}px, ${y}px) scaleY(${scaleY})`;
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, []);

  // Auto-scroll
  useEffect(() => {
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, animatedText]);

  const submit = useCallback(async () => {
    const msg = input.trim();
    if (!msg || loading) return;

    setInput("");
    setLoading(true);
    setAnimatedText("");
    lastInteractionRef.current = Date.now();
    setHistory(prev => [...prev, { role: "user", text: msg }]);

    try {
      const reader = await callPatas(msg);
      const decoder = new TextDecoder();
      let fullText = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }
      const zone = extractZone(fullText);
      if (zone) triggerZone(zone);
      const cleanText = stripZones(fullText);
      setHistory(prev => [...prev, { role: "ai", text: cleanText }]);
      animateWords(cleanText);
    } catch (e) {
      const errText = e instanceof Error ? `Error: ${e.message}` : "Error al contactar al asistente.";
      setHistory(prev => [...prev, { role: "ai", text: errText }]);
      animateWords(errText);
    } finally {
      setLoading(false);
    }
  }, [input, loading, callPatas, triggerZone, animateWords]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") setInput("");
  };

  const C = "rgb(255,77,0)";
  const Cfaint = "rgba(255,77,0,0.25)";
  const Cdim = "rgba(255,77,0,0.45)";

  // What to show in collapsed bar
  const collapsedText = animatedText || (history.findLast(h => h.role === "ai")?.text ?? "");
  const { visible: collapsedVisible, hasMore: collapsedHasMore } = truncateForBar(collapsedText);

  // In expanded history, animate the last AI entry
  const lastAiIndex = history.map((h, i) => h.role === "ai" ? i : -1).filter(i => i >= 0).at(-1) ?? -1;

  return (
    <>
    <style>{`
      #ai-chat-input::placeholder { color: rgba(255,77,0,0.3); }
      @keyframes patas-ping { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
      #patas-history::-webkit-scrollbar { width: 3px; }
      #patas-history::-webkit-scrollbar-track { background: transparent; }
      #patas-history::-webkit-scrollbar-thumb { background: rgba(255,77,0,0.25); border-radius: 2px; }
      #patas-history::-webkit-scrollbar-thumb:hover { background: rgba(255,77,0,0.5); }
      #patas-history { scrollbar-width: thin; scrollbar-color: rgba(255,77,0,0.25) transparent; }
      .patas-more { cursor: pointer; }
      .patas-more:hover { opacity: 0.7; }
    `}</style>

    {highlight && (
      <div style={{
        position: "fixed",
        top: highlight.top - 3, left: highlight.left - 3,
        width: highlight.width + 6, height: highlight.height + 6,
        border: "2px solid rgb(255,77,0)", pointerEvents: "none",
        zIndex: 9998, animation: "patas-ping 1s ease-in-out infinite",
        boxShadow: "0 0 8px rgba(255,77,0,0.4), inset 0 0 8px rgba(255,77,0,0.08)",
      }} />
    )}

    <div
      data-zone="ai-chat"
      className="shrink-0"
      style={{
        backgroundColor: "#110600",
        borderTop: "1px solid rgba(255,77,0,0.18)",
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
        {history.map((h, i) => {
          const isLastAiEntry = i === lastAiIndex;
          const text = isLastAiEntry && (isAnimating || animatedText) ? animatedText : h.text;
          return (
            <div key={i} className="text-xs leading-relaxed" style={{ color: h.role === "user" ? Cdim : C }}>
              <span className="select-none mr-1" style={{ color: Cfaint }}>
                {h.role === "user" ? "›" : "◈"}
              </span>
              {text}
              {isLastAiEntry && isAnimating && (
                <span className="animate-pulse" style={{ color: Cdim }}>▊</span>
              )}
            </div>
          );
        })}
        {loading && (
          <div className="text-xs animate-pulse select-none" style={{ color: Cfaint }}>
            <span className="mr-1">◈</span>pensando…
          </div>
        )}
        <div ref={historyEndRef} />
      </div>

      {/* Input row */}
      <div className="flex items-center gap-0 h-8 shrink-0">
        {/* Eye */}
        <div className="flex items-center justify-center shrink-0" style={{ width: 36, height: 32 }}>
          <div ref={eyeRef} style={{ width: 6, height: 6, backgroundColor: C }} />
        </div>

        <div className="w-px h-4 shrink-0" style={{ backgroundColor: Cfaint }} />

        {/* Input */}
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask Patas"
          disabled={loading}
          spellCheck={false}
          id="ai-chat-input"
          className="h-full px-2 bg-transparent text-xs outline-none min-w-0"
          style={{ flex: "0 1 180px", color: C, caretColor: C }}
        />

        <div className="w-px h-4 shrink-0" style={{ backgroundColor: Cfaint }} />

        {/* Inline response — collapsed only */}
        {!expanded && (
          <div className="flex-1 min-w-0 px-2 text-xs overflow-hidden whitespace-nowrap" style={{ color: C }}>
            {loading && (
              <span className="animate-pulse" style={{ color: Cfaint }}>▊▊▊</span>
            )}
            {!loading && collapsedText && (
              <>
                {collapsedVisible}
                {isAnimating && (
                  <span className="animate-pulse" style={{ color: Cdim }}>▊</span>
                )}
                {!isAnimating && collapsedHasMore && (
                  <span
                    className="patas-more"
                    style={{ color: Cdim }}
                    onClick={() => setExpanded(true)}
                  >
                    {" "}…
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {expanded && <div className="flex-1" />}

        {/* Expand/collapse */}
        <button
          type="button"
          onClick={() => setExpanded(e => !e)}
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
