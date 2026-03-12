"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronUp, ChevronDown } from "lucide-react";
import { useSession } from "next-auth/react";
import { useAppTabs } from "@/lib/appTabsContext";
import { getAppUrl } from "@/lib/appUrls";

type Message = { role: "user" | "ai"; text: string };

const COLLAPSED_H = 32;
const EXPANDED_H_DEFAULT = 220;
const EXPANDED_H_MIN = 80;
const EXPANDED_H_MAX = 700;
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

const APP_LABELS: Record<string, string> = {
  cineprompt: "CinePrompt",
  chronos: "Chronos",
  swag: "Swag",
  avatar: "Avatar",
  render: "Render",
  "frame-variator": "Frame Variator",
  connect: "Connect",
  nanobanana: "NanoBanana",
  feedback: "Feedback",
};

type PatasAction =
  | { type: "createFeedbackProject"; name: string }
  | { type: "openApp"; slug: string }
  | { type: "moveFeedbackSessions"; fromSlug: string; toSlug: string }
  | { type: "loadImage"; slug: string; url: string; field: string }
  | { type: "saveInbox"; message: string };

function extractAction(text: string): PatasAction | null {
  const m = text.match(/\{\{action:([a-zA-Z]+):([^}]+)\}\}/);
  if (!m) return null;
  const [, type, payload] = m;
  if (type === "createFeedbackProject") return { type, name: payload.trim() };
  if (type === "openApp") return { type, slug: payload.trim() };
  if (type === "moveFeedbackSessions") {
    const [fromSlug, toSlug] = payload.split("|").map((s: string) => s.trim());
    if (fromSlug && toSlug) return { type, fromSlug, toSlug };
  }
  if (type === "loadImage") {
    const parts = payload.split("|").map((s: string) => s.trim());
    const [slug, url, field = "input"] = parts;
    if (slug && url) return { type, slug, url, field };
  }
  if (type === "saveInbox") return { type, message: payload.trim() };
  return null;
}

function stripMarkers(text: string) {
  return text
    .replace(/\{\{zone:[a-z-]+\}\}/g, "")
    .replace(/\{\{global-save:[^}]+\}\}/g, "")
    .replace(/\{\{action:[a-zA-Z]+:[^}]+\}\}/g, "")
    .trim();
}

function extractZone(text: string): string | null {
  const m = text.match(/\{\{zone:([a-z-]+)\}\}/);
  return m ? m[1] : null;
}

function extractGlobalSave(text: string): string | null {
  const m = text.match(/\{\{global-save:([^}]+)\}\}/);
  return m ? m[1].trim() : null;
}

const SUMMARIZE_EVERY_N = 10; // AI messages between summaries
const MAX_STORED_MESSAGES = 120; // localStorage cap (long-term memory is in DB)


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
  const [expandedH, setExpandedH] = useState(EXPANDED_H_DEFAULT);
  const [history, setHistory] = useState<Message[]>([]);
  const [animatedText, setAnimatedText] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlight, setHighlight] = useState<DOMRect | null>(null);
  const [patasMemory, setPatasMemory] = useState<string | null>(null);
  const [textOverflows, setTextOverflows] = useState(false);
  const aiMessageCountRef = useRef(0);
  const collapsedTextSpanRef = useRef<HTMLSpanElement>(null);
  const dragStateRef = useRef<{ startY: number; startH: number } | null>(null);

  const highlightTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const animTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyEndRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { activeSlug, openTab } = useAppTabs();
  const router = useRouter();
  const { data: session } = useSession();
  const userName = (session?.user as { name?: string } | undefined)?.name ?? null;
  const userEmail = (session?.user as { email?: string } | undefined)?.email ?? null;
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const adminWelcomeRef = useRef(false);
  const lastInteractionRef = useRef<number>(Date.now());
  const userEmailRef2 = useRef(userEmail);
  useEffect(() => { userEmailRef2.current = userEmail; }, [userEmail]);

  const patasMemoryRef = useRef<string | null>(null);
  useEffect(() => { patasMemoryRef.current = patasMemory; }, [patasMemory]);

  // Load persisted history + DB memory once session is known
  useEffect(() => {
    if (session === undefined) return; // still loading
    const stored = loadHistory(userEmail);
    if (stored.length > 0) setHistory(stored);
    // Load long-term memory from DB (best-effort)
    fetch("/api/me/patas-memory")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.memory) setPatasMemory(data.memory); })
      .catch(() => {});
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Admin welcome: fetch inbox and greet once per session
  useEffect(() => {
    if (!isAdmin || adminWelcomeRef.current || session === undefined) return;
    adminWelcomeRef.current = true;
    fetch("/api/patas-inbox")
      .then(r => r.ok ? r.json() : { items: [] })
      .then(async ({ items }: { items: { id: number; message: string; user_name: string | null; user_email: string | null; created_at: string }[] }) => {
        if (items.length === 0) return;
        try {
          const reader = await callPatas(`__admin_welcome__:${JSON.stringify(items)}`, true);
          const decoder = new TextDecoder();
          let text = "";
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            text += decoder.decode(value, { stream: true });
          }
          const clean = stripMarkers(text);
          setHistory(prev => [...prev, { role: "ai", text: clean }]);
          animateWords(clean);
        } catch { /* silently ignore */ }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, session]);

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

  // Execute hub actions emitted by Patas
  const executeAction = useCallback(async (action: PatasAction) => {
    if (action.type === "createFeedbackProject") {
      try {
        const res = await fetch("/api/feedback/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: action.name }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const project = await res.json() as { name: string; slug: string };
        const msg = `Proyecto "${project.name}" creado.`;
        setHistory(prev => [...prev, { role: "ai", text: msg }]);
        animateWords(msg);
      } catch (e) {
        const msg = `No pude crear el proyecto: ${e instanceof Error ? e.message : "error"}.`;
        setHistory(prev => [...prev, { role: "ai", text: msg }]);
        animateWords(msg);
      }
    } else if (action.type === "openApp") {
      const slug = action.slug;
      const label = APP_LABELS[slug] ?? slug;
      const url = getAppUrl(slug);
      openTab(slug, label, url);
      router.push(`/apps/${slug}`);
    } else if (action.type === "moveFeedbackSessions") {
      try {
        const res = await fetch(`/api/feedback/projects/${action.fromSlug}/move-sessions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetSlug: action.toSlug }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const { moved, from, to } = await res.json() as { moved: number; from: string; to: string };
        const msg = `${moved} sesión${moved !== 1 ? "es" : ""} movida${moved !== 1 ? "s" : ""} de "${from}" a "${to}".`;
        setHistory(prev => [...prev, { role: "ai", text: msg }]);
        animateWords(msg);
      } catch (e) {
        const msg = `No pude mover las sesiones: ${e instanceof Error ? e.message : "error"}.`;
        setHistory(prev => [...prev, { role: "ai", text: msg }]);
        animateWords(msg);
      }
    } else if (action.type === "saveInbox") {
      fetch("/api/patas-inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: action.message }),
      }).catch(() => {});
    } else if (action.type === "loadImage") {
      try {
        // Convert R2 URL to base64 dataUrl (same as ReferencePickerModal does)
        let dataUrl = action.url;
        if (!dataUrl.startsWith("data:")) {
          const resp = await fetch(dataUrl);
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const blob = await resp.blob();
          dataUrl = await new Promise<string>((res, rej) => {
            const reader = new FileReader();
            reader.onload = () => res(reader.result as string);
            reader.onerror = rej;
            reader.readAsDataURL(blob);
          });
        }
        // Find the app iframe and send the command
        const iframe = document.querySelector(`iframe[src*="/embed/${action.slug}/"]`) as HTMLIFrameElement | null;
        if (!iframe?.contentWindow) throw new Error(`App "${action.slug}" no está abierta`);
        iframe.contentWindow.postMessage(
          { type: "BASEMENT_PATAS_COMMAND", action: "loadImage", field: action.field, dataUrl },
          "*"
        );
      } catch (e) {
        const msg = `No pude cargar la imagen: ${e instanceof Error ? e.message : "error"}.`;
        setHistory(prev => [...prev, { role: "ai", text: msg }]);
        animateWords(msg);
      }
    }
  }, [animateWords, openTab, router]);

  // Fetch helper
  const callPatas = useCallback(async (message: string, spontaneous = false) => {
    const res = await fetch("/api/ai-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        spontaneous,
        history: historyRef.current.slice(-30),
        memory: patasMemoryRef.current,
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
          const clean = stripMarkers(text);
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

  // Auto-scroll — también al expandir
  useEffect(() => {
    if (!expanded) return;
    historyEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, animatedText, expanded]);

  // Detect text overflow in collapsed bar
  useEffect(() => {
    const el = collapsedTextSpanRef.current;
    if (!el) return;
    const check = () => setTextOverflows(el.scrollWidth > el.clientWidth + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [animatedText, history, expanded]);

  // Drag-to-resize handlers
  const handleResizeDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragStateRef.current = { startY: e.clientY, startH: expandedH };
    const onMove = (ev: MouseEvent) => {
      if (!dragStateRef.current) return;
      const delta = dragStateRef.current.startY - ev.clientY; // drag up = bigger
      const next = Math.min(EXPANDED_H_MAX, Math.max(EXPANDED_H_MIN, dragStateRef.current.startH + delta));
      setExpandedH(next);
    };
    const onUp = () => {
      dragStateRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [expandedH]);

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
      const globalSave = extractGlobalSave(fullText);
      if (globalSave) {
        fetch("/api/patas-global-memory", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ append: globalSave }),
        }).catch(() => {});
      }
      const action = extractAction(fullText);
      const cleanText = stripMarkers(fullText);
      setHistory(prev => {
        const next = [...prev, { role: "ai" as const, text: cleanText }];
        // Trigger memory summarization every N AI messages
        aiMessageCountRef.current += 1;
        if (aiMessageCountRef.current % SUMMARIZE_EVERY_N === 0) {
          fetch("/api/me/patas-memory", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: next.slice(-60),
              currentMemory: patasMemoryRef.current,
              userName: userNameRef.current,
            }),
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.memory) setPatasMemory(data.memory); })
            .catch(() => {});
        }
        return next;
      });
      animateWords(cleanText, action ? () => executeAction(action) : undefined);
    } catch (e) {
      const errText = e instanceof Error ? `Error: ${e.message}` : "Error al contactar al asistente.";
      setHistory(prev => [...prev, { role: "ai", text: errText }]);
      animateWords(errText);
    } finally {
      setLoading(false);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [input, loading, callPatas, triggerZone, animateWords, executeAction]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") submit();
    if (e.key === "Escape") setInput("");
  };

  const C = "rgb(255,77,0)";
  const Cfaint = "rgba(255,77,0,0.25)";
  const Cdim = "rgba(255,77,0,0.45)";

  // What to show in collapsed bar
  const collapsedText = animatedText || (history.findLast(h => h.role === "ai")?.text ?? "");

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
      @keyframes patas-more-glow {
        0%, 100% { box-shadow: 0 0 0px rgba(255,77,0,0); border-color: rgba(255,77,0,0.3); color: rgba(255,77,0,0.55); }
        50% { box-shadow: 0 0 6px rgba(255,77,0,0.5); border-color: rgba(255,77,0,0.75); color: rgb(255,77,0); }
      }
      .patas-more {
        cursor: pointer;
        display: inline-flex; align-items: center; gap: 3px;
        font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
        padding: 2px 7px; border-radius: 3px;
        border: 1px solid rgba(255,77,0,0.5);
        background: rgba(255,77,0,0.12);
        animation: patas-more-glow 2s ease-in-out infinite;
        vertical-align: middle; margin-left: 6px; line-height: 14px;
        user-select: none; flex-shrink: 0; white-space: nowrap;
      }
      .patas-more:hover { animation: none; box-shadow: 0 0 8px rgba(255,77,0,0.55); border-color: rgb(255,77,0); color: rgb(255,77,0); background: rgba(255,77,0,0.2); }
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
        height: expanded ? expandedH + COLLAPSED_H : COLLAPSED_H,
        transition: dragStateRef.current ? "none" : "height 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden",
      }}
    >
      {/* Resize handle — drag up/down to resize expanded area */}
      {expanded && (
        <div
          onMouseDown={handleResizeDragStart}
          style={{
            height: 6, cursor: "ns-resize", display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent", flexShrink: 0,
          }}
          title="Arrastrar para redimensionar"
        >
          <div style={{ width: 32, height: 2, borderRadius: 2, background: "rgba(255,77,0,0.25)" }} />
        </div>
      )}

      {/* Expanded history */}
      <div
        id="patas-history"
        className="overflow-y-auto flex flex-col gap-0.5 px-3 py-1.5"
        style={{ height: expanded ? expandedH - 6 : 0, display: expanded ? "flex" : "none" }}
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
          <div className="flex-1 min-w-0 px-2 text-xs overflow-hidden" style={{ color: C }}>
            {loading && (
              <span className="animate-pulse" style={{ color: Cfaint }}>▊▊▊</span>
            )}
            {!loading && collapsedText && (
              <span
                ref={collapsedTextSpanRef}
                className="whitespace-nowrap"
                style={{ overflow: "hidden", textOverflow: "ellipsis", display: "block" }}
              >
                {collapsedText}
                {isAnimating && (
                  <span className="animate-pulse" style={{ color: Cdim }}>▊</span>
                )}
              </span>
            )}
          </div>
        )}

        {/* "Ver más" — fixed at the right edge, only when collapsed text overflows */}
        {!expanded && !isAnimating && textOverflows && (
          <span
            className="patas-more shrink-0"
            style={{ color: Cdim }}
            onClick={() => setExpanded(true)}
            title="Ver respuesta completa"
          >
            ver más ↗
          </span>
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
