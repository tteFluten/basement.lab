import React, { useState, useRef, useEffect } from 'react';
import { Upload, Clipboard, Send, X, Image as ImageIcon, Maximize2, Download, RefreshCcw, Key, FolderOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { generateImage, isEmbedMode, getHubModel } from './services/geminiService';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';
import { prepareImagePartForApi } from './lib/imageResize';

// --- Types ---
interface AttachedImage {
  id: string;
  data: string; // base64
  mimeType: string;
  color: string;
}

interface HistoryItem {
  id: string;
  image: string;
  prompt: string;
  stats: { time: number; images: number } | null;
  text: string | null;
  timestamp: number;
  status: 'generating' | 'done' | 'error';
  elapsed: number;
  error?: string;
}

const MAX_CONCURRENT = 4;

const COLORS = [
  '#FF0000', '#FF4500', '#FF8C00', '#FFA500', '#FFD700',
  '#FFFF00', '#CCFF00', '#80FF00', '#00FF00', '#00FF80',
  '#00FFFF', '#0080FF', '#0000FF', '#4B0082', '#7F00FF',
  '#BF00FF', '#FF00FF', '#FF00BF', '#FF0080', '#FF0040',
];

export default function App() {
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<AttachedImage[]>([]);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const [aspectRatio, setAspectRatio] = useState<string>("1:1");
  const [imageSize, setImageSize] = useState<string>("1K");
  const [error, setError] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<AttachedImage | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeHistoryIndex, setActiveHistoryIndex] = useState<number>(-1);
  const [imageCounter, setImageCounter] = useState(1);
  const [mentionMenu, setMentionMenu] = useState<{
    isOpen: boolean; x: number; y: number;
    selectedIndex: number; filter: string; cursorPosition: number;
  }>({ isOpen: false, x: 0, y: 0, selectedIndex: 0, filter: '', cursorPosition: 0 });

  const MAX_IMAGES = 20;
  const highlighterRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const timerIntervalsRef = useRef<Record<string, ReturnType<typeof setInterval>>>({});

  const activeGenerations = history.filter(h => h.status === 'generating').length;
  const isGenerating = activeGenerations > 0;
  const latestResult = [...history].reverse().find(h => h.status === 'done');
  const resultText = latestResult?.text ?? null;

  useEffect(() => {
    if (isEmbedMode()) {
      setHasKey(true);
      return;
    }
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio?.hasSelectedApiKey) {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasKey(selected);
      } else {
        setHasKey(true);
      }
    };
    checkKey();
  }, []);

  const handleOpenKeySelector = async () => {
    // @ts-ignore
    if (window.aistudio?.openSelectKey) {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      setHasKey(true);
    }
  };

  const syncScroll = () => {
    if (promptRef.current && highlighterRef.current) {
      highlighterRef.current.scrollTop = promptRef.current.scrollTop;
    }
  };

  useEffect(() => { syncScroll(); }, [prompt]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) Array.from(files).forEach(file => processFile(file));
  };

  const processFile = (file: File | Blob) => {
    if (!file.type.startsWith('image/')) return;
    if (images.length >= MAX_IMAGES) {
      setError(`Maximum limit of ${MAX_IMAGES} images reached.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target?.result as string;
      const data = base64.split(',')[1];
      const mimeType = file.type;
      setImages(prev => {
        const nextId = imageCounter.toString();
        const color = COLORS[imageCounter % COLORS.length];
        setImageCounter(prevCount => prevCount + 1);
        return [...prev, { id: nextId, data, mimeType, color }];
      });
    };
    reader.readAsDataURL(file);
  };

  const processUrl = async (url: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      processFile(blob);
    } catch {
      setError("Failed to load image from external source.");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      Array.from(files).forEach(file => processFile(file));
    } else {
      const html = e.dataTransfer.getData('text/html');
      const match = html.match(/src="([^"]+)"/);
      if (match?.[1]) {
        processUrl(match[1]);
      } else {
        const url = e.dataTransfer.getData('text/plain');
        if (url?.startsWith('http')) processUrl(url);
      }
    }
  };

  const resetAll = () => {
    // Clear all running timers
    Object.values(timerIntervalsRef.current).forEach(clearInterval);
    timerIntervalsRef.current = {};
    setPrompt(''); setImages([]); setError(null); setHistory([]); setActiveHistoryIndex(-1);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) processFile(blob);
      }
    }
  };

  const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const cursor = e.target.selectionStart;
    setPrompt(value);
    const textBeforeCursor = value.substring(0, cursor);
    const lastAt = textBeforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && !textBeforeCursor.substring(lastAt).includes(' ')) {
      const filter = textBeforeCursor.substring(lastAt + 1);
      if (highlighterRef.current && promptRef.current?.getBoundingClientRect()) {
        setMentionMenu(prev => ({ ...prev, isOpen: true, filter, cursorPosition: cursor, selectedIndex: 0, x: 20, y: 40 }));
      }
    } else {
      setMentionMenu(prev => ({ ...prev, isOpen: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); generate(); return; }
    if (mentionMenu.isOpen) {
      const filtered = images.filter(img => img.id.startsWith(mentionMenu.filter));
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex + 1) % (filtered.length || 1) }));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionMenu(prev => ({ ...prev, selectedIndex: (prev.selectedIndex - 1 + (filtered.length || 1)) % (filtered.length || 1) }));
      } else if (e.key === 'Enter' || e.key === 'Tab') {
        if (filtered.length > 0) { e.preventDefault(); selectMention(filtered[mentionMenu.selectedIndex].id); }
      } else if (e.key === 'Escape') {
        setMentionMenu(prev => ({ ...prev, isOpen: false }));
      }
    }
  };

  const selectMention = (id: string) => {
    const textBeforeAt = prompt.substring(0, prompt.lastIndexOf('@', mentionMenu.cursorPosition - 1));
    const textAfterCursor = prompt.substring(mentionMenu.cursorPosition);
    setPrompt(textBeforeAt + `@${id} ` + textAfterCursor);
    setMentionMenu(prev => ({ ...prev, isOpen: false }));
    setTimeout(() => {
      promptRef.current?.focus();
      const newPos = textBeforeAt.length + id.length + 2;
      promptRef.current?.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleHistoryClick = (idx: number) => { setActiveHistoryIndex(idx); };

  const removeImage = (id: string) => { setImages(prev => prev.filter(img => img.id !== id)); };

  const insertId = (id: string) => {
    const textarea = promptRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const idToInsert = `@${id} `;
    setPrompt(prompt.substring(0, start) + idToInsert + prompt.substring(end));
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + idToInsert.length, start + idToInsert.length);
    }, 0);
  };

  const handleHubUpload = async () => {
    try {
      const dataUrl = await openReferencePicker();
      if (!dataUrl) return;
      const [meta, data] = dataUrl.split(',');
      const mimeType = meta.split(':')[1].split(';')[0];
      setImages(prev => {
        const nextId = imageCounter.toString();
        const color = COLORS[imageCounter % COLORS.length];
        setImageCounter(c => c + 1);
        return [...prev, { id: nextId, data, mimeType, color }];
      });
    } catch (e) {
      console.warn("Hub reference picker failed", e);
    }
  };

  const handleDownload = async (dataUrl: string, itemPrompt: string) => {
    if (isHubEnv()) {
      try {
        await openDownloadAction(dataUrl, 'nanobanana', { prompt: itemPrompt });
        return;
      } catch {
        // fallback to direct download
      }
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `nanobanana-${Date.now()}.png`;
    link.click();
  };

  const generate = () => {
    if (!prompt.trim() && images.length === 0) return;
    if (activeGenerations >= MAX_CONCURRENT) return;

    setError(null);

    const slotId = Date.now().toString();
    const capturedPrompt = prompt;
    const startTime = performance.now();

    // Prepare images synchronously before launching async work
    const mentionedImages = images.filter(img => capturedPrompt.includes(`@${img.id}`));
    const dataUrls = mentionedImages.map(img => `data:${img.mimeType};base64,${img.data}`);

    // Add placeholder history item immediately
    const newItem: HistoryItem = {
      id: slotId,
      image: '',
      prompt: capturedPrompt,
      stats: null,
      text: null,
      timestamp: Date.now(),
      status: 'generating',
      elapsed: 0,
    };
    setHistory(prev => { const next = [...prev, newItem]; setActiveHistoryIndex(next.length - 1); return next; });

    // Start per-slot timer
    timerIntervalsRef.current[slotId] = setInterval(() => {
      setHistory(prev => prev.map(h => h.id === slotId && h.status === 'generating' ? { ...h, elapsed: Math.round(performance.now() - startTime) } : h));
    }, 100);

    // Launch async generation (non-blocking)
    (async () => {
      try {
        const imageParts = await Promise.all(
          dataUrls.map((dataUrl, i) =>
            prepareImagePartForApi(dataUrl, mentionedImages[i].mimeType)
          )
        );
        const result = await generateImage({
          prompt: capturedPrompt,
          imageParts,
          aspectRatio,
          imageSize,
        });

        clearInterval(timerIntervalsRef.current[slotId]);
        delete timerIntervalsRef.current[slotId];
        const stats = { time: Math.round(performance.now() - startTime), images: mentionedImages.length };

        setHistory(prev => prev.map(h => h.id === slotId ? {
          ...h,
          status: 'done' as const,
          image: result.dataUrl ?? '',
          text: result.text ?? null,
          stats,
          elapsed: stats.time,
        } : h));

        // Auto-add generated image as next input
        if (result.dataUrl) {
          const [meta, data] = result.dataUrl.split(',');
          const mimeType = meta.split(':')[1].split(';')[0];
          setImages(prev => {
            const nextId = imageCounter.toString();
            const color = COLORS[imageCounter % COLORS.length];
            setImageCounter(c => c + 1);
            return [...prev, { id: nextId, data, mimeType, color }];
          });
        } else if (!result.text) {
          setHistory(prev => prev.map(h => h.id === slotId ? { ...h, status: 'error' as const, error: 'No output generated.' } : h));
        }
      } catch (err: unknown) {
        clearInterval(timerIntervalsRef.current[slotId]);
        delete timerIntervalsRef.current[slotId];
        const msg = err instanceof Error ? err.message : "An error occurred.";
        if (msg === "API_KEY_ERROR") setHasKey(false);
        else {
          setHistory(prev => prev.map(h => h.id === slotId ? { ...h, status: 'error' as const, error: msg } : h));
        }
      }
    })();
  };

  if (hasKey === false) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-6 font-mono">
        <div className="max-w-md w-full bg-[#111] border border-[#333] p-8 flex flex-col items-center text-center gap-6">
          <div className="w-16 h-16 bg-[#a0a0a0]/10 border border-[#333] flex items-center justify-center">
            <Key className="text-[#a0a0a0]" size={32} />
          </div>
          <div className="space-y-4">
            <h1 className="text-sm uppercase tracking-[0.3em] font-bold text-white">Access Restricted</h1>
            <p className="text-xs text-[#666] leading-relaxed uppercase tracking-tighter">
              Select a paid API key to use the image generation models.
            </p>
          </div>
          <button
            onClick={handleOpenKeySelector}
            className="w-full py-4 bg-[#a0a0a0] text-black text-xs font-bold uppercase tracking-widest hover:bg-white transition-colors"
          >
            Select API Key
          </button>
        </div>
      </div>
    );
  }

  if (hasKey === null) return null;

  return (
    <div
      className="min-h-screen bg-black text-[#bbb] flex flex-col p-4 md:p-8 selection:bg-[#444] selection:text-white font-mono"
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      {/* Header */}
      <header className="flex justify-between items-center mb-12 border-b border-[#333] pb-4">
        <div className="flex items-center gap-4">
          <h1 className="text-sm tracking-widest uppercase font-bold text-[#ccc]">NanoBanana Studio</h1>
        </div>
        <button
          onClick={resetAll}
          className="text-xs hover:text-white transition-colors flex items-center gap-2 uppercase tracking-tighter text-[#666]"
          title="Reset All"
        >
          <RefreshCcw size={14} />
          Reset
        </button>
      </header>

      {/* Timeline Carousel */}
      <div className="-mx-4 md:-mx-8 relative h-[600px] flex items-center overflow-hidden border-b border-[#282828] pb-8 mb-8">
          {history.length === 0 && !isGenerating && !error && (
            <div className="w-full flex flex-col items-center justify-center gap-6">
              <style>{`
                @keyframes nb-idle-spin { to { transform: rotate(360deg); } }
                @keyframes nb-idle-spin-rev { to { transform: rotate(-360deg); } }
                @keyframes nb-idle-pulse {
                  0%, 100% { opacity: 0.15; }
                  50% { opacity: 0.3; }
                }
                @keyframes nb-idle-dash { to { stroke-dashoffset: -20; } }
              `}</style>
              <svg width="160" height="160" viewBox="0 0 160 160" className="overflow-visible">
                {/* Outer dashed ring */}
                <g style={{ transformOrigin: '80px 80px', animation: 'nb-idle-spin 30s linear infinite' }}>
                  <circle cx="80" cy="80" r="72" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" strokeDasharray="4 6" style={{ animation: 'nb-idle-dash 3s linear infinite' }} />
                </g>
                {/* Middle ring */}
                <g style={{ transformOrigin: '80px 80px', animation: 'nb-idle-spin-rev 20s linear infinite' }}>
                  <circle cx="80" cy="80" r="55" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                </g>
                {/* Inner ring */}
                <circle cx="80" cy="80" r="38" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5"
                  style={{ animation: 'nb-idle-pulse 4s ease-in-out infinite' }} />
                {/* Orbiting bananas */}
                {[
                  { angle: 0, r: 58, dur: '8s', scale: 0.45, opacity: 0.25 },
                  { angle: 120, r: 45, dur: '12s', scale: 0.35, opacity: 0.15 },
                  { angle: 240, r: 52, dur: '10s', scale: 0.4, opacity: 0.2 },
                ].map((b, i) => (
                  <g key={i} style={{ transformOrigin: '80px 80px', animation: `nb-idle-spin ${b.dur} linear infinite` }}>
                    <g transform={`translate(${80 - 12 * b.scale},${80 - b.r - 12 * b.scale}) scale(${b.scale})`}
                      opacity={b.opacity} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
                      <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z" />
                    </g>
                  </g>
                ))}
                {/* Center banana */}
                <g transform="translate(71,71) scale(0.75)" opacity="0.2"
                  fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
                  <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z" />
                </g>
              </svg>
              <span className="text-[11px] uppercase tracking-[0.3em] text-white/20">Ready for Generation</span>
            </div>
          )}

          {/* Global animation keyframes for card spinners */}
          <style>{`
            @keyframes nb-spin { to { transform: rotate(360deg); } }
            @keyframes nb-spin-rev { to { transform: rotate(-360deg); } }
            @keyframes nb-dash { to { stroke-dashoffset: -20; } }
            @keyframes nb-core-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
            @keyframes nb-glow-pulse { 0%, 100% { r: 20; opacity: 0.03; } 50% { r: 24; opacity: 0.06; } }
            @keyframes nb-orbit { 0% { transform: rotate(0deg) translateX(42px) rotate(0deg); } 100% { transform: rotate(360deg) translateX(42px) rotate(-360deg); } }
            @keyframes nb-orbit2 { 0% { transform: rotate(120deg) translateX(30px) rotate(-120deg); } 100% { transform: rotate(480deg) translateX(30px) rotate(-480deg); } }
            @keyframes nb-orbit3 { 0% { transform: rotate(240deg) translateX(36px) rotate(-240deg); } 100% { transform: rotate(600deg) translateX(36px) rotate(-600deg); } }
            @keyframes nb-fade-pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }
            @keyframes nb-dot-wave { 0%, 60%, 100% { transform: translateY(0); opacity: 0.3; } 30% { transform: translateY(-3px); opacity: 1; } }
          `}</style>

          {error && (
            <div className="w-full flex flex-col items-center justify-center text-red-900 gap-4 p-8">
              <span className="text-xs uppercase tracking-widest text-center">System Error: {error}</span>
              <button onClick={() => setError(null)} className="text-[9px] border border-red-900/30 px-3 py-1 hover:bg-red-900/10">Dismiss</button>
            </div>
          )}

          <div
            className="flex items-center gap-8 px-12 transition-transform duration-500 ease-out"
            style={{ transform: `translateX(calc(50vw - ${48 + (activeHistoryIndex === -1 ? 0 : activeHistoryIndex) * 232 + 300}px))` }}
          >
            {history.map((item, idx) => {
              const isActive = idx === activeHistoryIndex;
              return (
                <div
                  key={item.id}
                  onClick={() => handleHistoryClick(idx)}
                  className={`relative flex-shrink-0 transition-all duration-500 cursor-pointer ${isActive ? 'w-[600px] opacity-100 scale-100' : 'w-[200px] opacity-20 scale-75 grayscale hover:opacity-40'}`}
                >
                  {/* Generating state — inline spinner card */}
                  {item.status === 'generating' && (
                    <div className="bg-black/50 border border-[#222] flex flex-col items-center justify-center" style={{ height: isActive ? 400 : 200, aspectRatio: isActive ? undefined : '1' }}>
                      <svg width="140" height="140" viewBox="0 0 140 140" className="overflow-visible">
                        <circle cx="70" cy="70" r="20" fill="white" style={{ animation: 'nb-glow-pulse 3s ease-in-out infinite' }} />
                        <g style={{ transformOrigin: '70px 70px', animation: 'nb-spin 20s linear infinite' }}>
                          <circle cx="70" cy="70" r="62" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="0.5" strokeDasharray="4 6" style={{ animation: 'nb-dash 2s linear infinite' }} />
                        </g>
                        <g style={{ transformOrigin: '70px 70px', animation: 'nb-spin-rev 12s linear infinite' }}>
                          <circle cx="70" cy="70" r="48" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="0.5" />
                        </g>
                        {[
                          { anim: 'nb-orbit', dur: '6s', scale: 0.4, opacity: 0.6 },
                          { anim: 'nb-orbit2', dur: '4.5s', scale: 0.3, opacity: 0.35 },
                          { anim: 'nb-orbit3', dur: '8s', scale: 0.35, opacity: 0.25 },
                        ].map((b, i) => (
                          <g key={i} style={{ transformOrigin: '70px 70px', animation: `${b.anim} ${b.dur} linear infinite` }}>
                            <g transform={`translate(${70 - 12 * b.scale},${70 - 12 * b.scale}) scale(${b.scale})`}
                              opacity={b.opacity} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
                              <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z" />
                            </g>
                          </g>
                        ))}
                        <circle cx="70" cy="70" r="18" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.5" style={{ animation: 'nb-core-pulse 3s ease-in-out infinite' }} />
                        <g transform="translate(62,62) scale(0.65)" opacity="0.8" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 13c3.5-2 8-2 10 2a5.5 5.5 0 0 1 8 5" />
                          <path d="M5.15 17.89c5.52-1.52 8.65-6.89 7-12C11.55 4 11.5 2 13 2c3.22 0 5 5.5 5 8 0 6.5-4.2 12-10.49 12C5.11 22 2 22 2 20c0-1.5 1.14-1.55 3.15-2.11Z" />
                        </g>
                      </svg>
                      {isActive && (
                        <div className="flex flex-col items-center gap-1 mt-2">
                          <div className="text-[16px] font-light text-white/80 tracking-[0.4em] tabular-nums">
                            {(item.elapsed / 1000).toFixed(1)}<span className="text-[10px] text-white/30 ml-0.5">s</span>
                          </div>
                          <div className="text-[9px] uppercase tracking-[0.25em] text-white/30" style={{ animation: 'nb-fade-pulse 2s ease-in-out infinite' }}>
                            Generating
                          </div>
                          <svg width="24" height="6" viewBox="0 0 24 6">
                            {[0, 1, 2].map(i => (
                              <circle key={i} cx={4 + i * 8} cy="3" r="1.5" fill="rgba(255,255,255,0.4)"
                                style={{ animation: 'nb-dot-wave 1.2s ease-in-out infinite', animationDelay: `${i * 0.15}s` }} />
                            ))}
                          </svg>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Error state */}
                  {item.status === 'error' && (
                    <div className="bg-black/50 border border-red-900/30 flex flex-col items-center justify-center gap-3 p-6" style={{ height: isActive ? 300 : 200 }}>
                      <X size={24} className="text-red-900/60" />
                      {isActive && (
                        <>
                          <span className="text-[10px] uppercase tracking-widest text-red-900/80 text-center">{item.error || 'Generation failed'}</span>
                          <button onClick={(e) => { e.stopPropagation(); setHistory(prev => prev.filter(h => h.id !== item.id)); }}
                            className="text-[9px] border border-red-900/30 px-3 py-1 hover:bg-red-900/10 text-red-900/60">Dismiss</button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Done state — show image */}
                  {item.status === 'done' && (
                    <div className="bg-black relative group cursor-pointer"
                      onClick={(e) => { if (isActive && item.image) { e.stopPropagation(); setViewingImage({ id: 'result', data: item.image.split(',')[1], mimeType: 'image/png', color: '#fff' }); } }}>
                      <img src={item.image} alt={`Generation ${idx}`} className="w-full object-contain" style={{ maxHeight: 520 }} />
                      {isActive && (
                        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <button
                            onClick={(e) => { e.stopPropagation(); setViewingImage({ id: 'result', data: item.image.split(',')[1], mimeType: 'image/png', color: '#fff' }); }}
                            className="p-2.5 bg-black/80 border border-[#333] hover:text-white"
                          >
                            <Maximize2 size={16} />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDownload(item.image, item.prompt); }}
                            className="p-2.5 bg-black/80 border border-[#333] hover:text-white"
                            title="Download / Save to History"
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Card metadata */}
                  {isActive && item.status !== 'generating' && (
                    <div className="mt-4 flex flex-col gap-2">
                      <div className="flex justify-between items-center text-[11px] uppercase tracking-widest text-[#777]">
                        <span>Step {idx + 1}</span>
                        <span>{item.stats ? `${(item.stats.time / 1000).toFixed(2)}s` : ''}</span>
                      </div>
                      <div className="text-[12px] text-[#888] line-clamp-2 italic">"{item.prompt}"</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      <main className="flex-1 flex flex-col max-w-5xl mx-auto w-full gap-8">

        {/* Interaction Area */}
        <div className="relative">
          {/* Settings Bar */}
          <div className="flex flex-wrap gap-8 mb-6 border-b border-[#282828] pb-4">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-widest text-[#777]">Aspect Ratio</span>
              <div className="flex flex-wrap gap-2">
                {["1:1", "3:4", "4:3", "9:16", "16:9", "1:4", "1:8", "4:1", "8:1"].map(ratio => (
                  <button
                    key={ratio}
                    onClick={() => setAspectRatio(ratio)}
                    className={`text-[12px] px-2 py-1 border ${aspectRatio === ratio ? 'bg-[#a0a0a0] text-black border-[#a0a0a0]' : 'border-[#333] text-[#777] hover:border-[#666]'}`}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] uppercase tracking-widest text-[#777]">Resolution</span>
              <div className="flex gap-2">
                {["512px", "1K", "2K", "4K"].map(size => (
                  <button
                    key={size}
                    onClick={() => setImageSize(size)}
                    className={`text-[12px] px-2 py-1 border ${imageSize === size ? 'bg-[#a0a0a0] text-black border-[#a0a0a0]' : 'border-[#333] text-[#777] hover:border-[#666]'}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Attached Images */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <div className="text-[11px] uppercase tracking-widest text-[#666] mr-2">
              Inputs [{images.length}/{MAX_IMAGES}]
            </div>
            {images.map((img) => (
              <div
                key={img.id}
                className="relative group transition-transform hover:-translate-y-1"
                style={{ border: `1px solid ${img.color}` }}
              >
                <img
                  src={`data:${img.mimeType};base64,${img.data}`}
                  alt={`ID ${img.id}`}
                  className="w-20 h-20 object-cover grayscale group-hover:grayscale-0 transition-all cursor-pointer"
                  onClick={() => insertId(img.id)}
                />
                <div
                  className="absolute -top-2 -left-2 text-[10px] px-1 font-bold"
                  style={{ backgroundColor: img.color, color: '#000' }}
                >
                  @{img.id}
                </div>
                <div
                  className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 cursor-pointer"
                  onClick={() => insertId(img.id)}
                >
                  <button onClick={(e) => { e.stopPropagation(); setViewingImage(img); }} className="p-1 hover:text-white" title="View">
                    <Maximize2 size={14} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="p-1 hover:text-red-500" title="Remove">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            {images.length > 0 && (
              <span className="text-[10px] uppercase tracking-widest text-[#666] ml-2">Click image to tag in prompt</span>
            )}
          </div>

          {/* Prompt Input */}
          <div className="border border-[#333] bg-[#080808] focus-within:border-[#444] transition-colors relative">
            {/* Syntax highlight overlay */}
            <div
              ref={highlighterRef}
              className="absolute inset-0 p-4 text-sm leading-relaxed pointer-events-none whitespace-pre-wrap break-words overflow-hidden"
              aria-hidden="true"
            >
              {prompt.split(/(@\d+)/g).map((part, i) => {
                if (part.startsWith('@')) {
                  const img = images.find(img => img.id === part.substring(1));
                  if (img) return <span key={i} style={{ color: img.color }}>{part}</span>;
                }
                return <span key={i} className="text-[#a0a0a0]">{part}</span>;
              })}
              {prompt.endsWith('\n') ? ' ' : ''}
            </div>

            <textarea
              ref={promptRef}
              value={prompt}
              onChange={handlePromptChange}
              onKeyDown={handleKeyDown}
              onScroll={syncScroll}
              onPaste={handlePaste}
              placeholder="Enter prompt... Use @ID to reference images. Ctrl+Enter to generate."
              className="w-full h-32 p-4 bg-transparent outline-none resize-none text-sm leading-relaxed placeholder:text-[#555] relative z-10 caret-[#a0a0a0] text-transparent selection:bg-[#333] selection:text-white"
              style={{ WebkitTextFillColor: 'transparent' }}
            />

            {/* Mention menu */}
            {mentionMenu.isOpen && (
              <div
                className="absolute z-30 bg-[#0a0a0a] border border-[#333] w-48 max-h-48 overflow-auto shadow-2xl"
                style={{ left: mentionMenu.x, top: mentionMenu.y }}
              >
                <div className="p-2 border-b border-[#282828] text-[10px] uppercase tracking-widest text-[#666] flex justify-between">
                  <span>Select Reference</span>
                  <span>{images.filter(img => img.id.startsWith(mentionMenu.filter)).length} found</span>
                </div>
                {images.filter(img => img.id.startsWith(mentionMenu.filter)).map((img, index) => (
                  <div
                    key={img.id}
                    className={`flex items-center gap-3 p-2 cursor-pointer transition-colors ${index === mentionMenu.selectedIndex ? 'bg-[#111] text-white' : 'hover:bg-[#050505]'}`}
                    onClick={() => selectMention(img.id)}
                    onMouseEnter={() => setMentionMenu(prev => ({ ...prev, selectedIndex: index }))}
                  >
                    <div className="w-8 h-8 border flex-shrink-0" style={{ borderColor: img.color }}>
                      <img src={`data:${img.mimeType};base64,${img.data}`} alt={img.id} className="w-full h-full object-cover grayscale" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-[12px] font-bold" style={{ color: img.color }}>@{img.id}</span>
                      <span className="text-[10px] text-[#666] uppercase">Ref Asset</span>
                    </div>
                  </div>
                ))}
                {images.filter(img => img.id.startsWith(mentionMenu.filter)).length === 0 && (
                  <div className="p-4 text-[10px] text-[#555] uppercase text-center">No matches</div>
                )}
              </div>
            )}

            <div className="flex justify-between items-center p-2 border-t border-[#282828] relative z-20">
              <div className="flex gap-2">
                {/* Hub upload (from history/library) */}
                {isHubEnv() && (
                  <button
                    onClick={handleHubUpload}
                    className="p-2 hover:bg-[#111] transition-colors text-[#666] hover:text-[#ccc]"
                    title="Pick from Hub History"
                  >
                    <FolderOpen size={16} />
                  </button>
                )}
                {/* Local file upload */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 hover:bg-[#111] transition-colors text-[#666] hover:text-[#ccc]"
                  title="Upload Image"
                >
                  <Upload size={16} />
                </button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleFileUpload} />
                {/* Clipboard paste */}
                <button
                  onClick={async () => {
                    try {
                      const items = await navigator.clipboard.read();
                      for (const item of items) {
                        for (const type of item.types) {
                          if (type.startsWith('image/')) {
                            const blob = await item.getType(type);
                            processFile(blob as File);
                          }
                        }
                      }
                    } catch (e) { console.error("Clipboard access denied", e); }
                  }}
                  className="p-2 hover:bg-[#111] transition-colors text-[#666] hover:text-[#ccc]"
                  title="Paste from Clipboard"
                >
                  <Clipboard size={16} />
                </button>
              </div>

              <button
                onClick={generate}
                disabled={activeGenerations >= MAX_CONCURRENT || (!prompt.trim() && images.length === 0)}
                className="flex items-center gap-2 px-6 py-2 bg-[#a0a0a0] text-black text-[12px] font-bold uppercase tracking-widest hover:bg-white disabled:bg-[#222] disabled:text-[#444] transition-all"
              >
                {activeGenerations > 0 ? `Execute (${activeGenerations}/${MAX_CONCURRENT})` : 'Execute'}
                <Send size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Text result */}
        {resultText && (
          <div className="border border-[#333] p-4 text-xs text-[#666] leading-relaxed">
            <ReactMarkdown>{resultText}</ReactMarkdown>
          </div>
        )}

        {!isEmbedMode() && (
          <footer className="mt-auto pt-8 flex justify-between items-end text-[10px] uppercase tracking-[0.3em] text-[#555]">
            <div>Model: Gemini 3.1 Flash Image</div>
            <div>Status: Operational // {new Date().toLocaleTimeString()}</div>
          </footer>
        )}
      </main>

      {/* Image Viewer Modal */}
      {viewingImage && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 md:p-12"
          onClick={() => setViewingImage(null)}
        >
          <div className="relative max-w-5xl w-full max-h-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
            <button className="absolute -top-8 right-0 text-[#444] hover:text-white transition-colors" onClick={() => setViewingImage(null)}>
              <X size={24} />
            </button>
            <div className="p-1 bg-black border" style={{ borderColor: viewingImage.color }}>
              <img
                src={`data:${viewingImage.mimeType};base64,${viewingImage.data}`}
                alt={`ID ${viewingImage.id}`}
                className="max-w-full max-h-[80vh] object-contain"
              />
            </div>
            <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest">
              <span style={{ color: viewingImage.color }}>ID @{viewingImage.id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
