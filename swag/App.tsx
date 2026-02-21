import React, { useState, useEffect, useRef } from 'react';
import { MockupType, AspectRatio, StylePreset, GenerationResult } from './types';
import { generateMockup } from './services/geminiService';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';

interface PendingGeneration {
  id: string;
  isPending: true;
  config: {
    mockup: MockupType;
    ratio: AspectRatio;
    resolution: string;
  };
}

type ResultItem = GenerationResult | PendingGeneration;

const App: React.FC = () => {
  const [logo, setLogo] = useState<string | null>(null);
  const [styleRef, setStyleRef] = useState<string | null>(null);
  const [mockupType, setMockupType] = useState<MockupType>(MockupType.TSHIRT);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(AspectRatio.SQUARE);
  const [stylePreset, setStylePreset] = useState<StylePreset>(StylePreset.MINIMALIST);
  const [resolution, setResolution] = useState<"1K" | "2K" | "4K">("1K");
  
  const [items, setItems] = useState<ResultItem[]>([]);
  const [viewMode, setViewMode] = useState<'GRID' | 'LIST'>('GRID');
  
  // In Hub embed we never need a client key (Hub uses server-side key). Same when served at /embed/ (same-origin).
  const isEmbedMode = typeof window !== "undefined" && window.location.pathname.startsWith("/embed/");
  const [hasKey, setHasKey] = useState(() => isHubEnv() || isEmbedMode || !!process.env.API_KEY);
  const [error, setError] = useState<string | null>(null);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const styleInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isHubEnv() || (typeof window !== "undefined" && window.location.pathname.startsWith("/embed/"))) {
      setHasKey(true);
      return;
    }
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        // @ts-ignore
        const selected = await window.aistudio.hasSelectedApiKey();
        if (selected) setHasKey(true);
      } else if (process.env.API_KEY) {
        setHasKey(true);
      }
    } catch (e) {
      console.warn("Key check failed, using fallback state");
    }
  };

  const handleOpenKeySelector = async () => {
    try {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
        // @ts-ignore
        await window.aistudio.openSelectKey();
      } else {
        console.warn("window.aistudio.openSelectKey not found");
      }
    } catch (e) {
      console.error("Error opening key selector:", e);
    } finally {
      // "You MUST assume the key selection was successful after triggering openSelectKey() and proceed to the app."
      setHasKey(true);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, setter: (val: string) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!logo) {
      setError("UPLOAD_LOGO_REQUIRED");
      return;
    }
    setError(null);
    
    const tempId = Math.random().toString(36).substr(2, 9);
    const pendingItem: PendingGeneration = {
      id: tempId,
      isPending: true,
      config: { mockup: mockupType, ratio: aspectRatio, resolution }
    };

    setItems(prev => [pendingItem, ...prev]);

    try {
      const imageUrl = await generateMockup({
        logoBase64: logo,
        styleBase64: styleRef || undefined,
        mockupType,
        aspectRatio,
        stylePreset,
        resolution
      });

      const finishedResult: GenerationResult = {
        id: tempId,
        imageUrl,
        timestamp: Date.now(),
        config: { mockup: mockupType, ratio: aspectRatio, resolution }
      };

      setItems(prev => prev.map(item => item.id === tempId ? finishedResult : item));
    } catch (err: any) {
      setItems(prev => prev.filter(item => item.id !== tempId));
      if (err.message === "API_KEY_RESET" || err.message?.includes("entity was not found")) {
        setHasKey(false);
        setError("API_KEY_EXPIRED_OR_INVALID. PLEASE RE-SELECT KEY.");
      } else {
        setError(err.message || "GENERATION_ERROR");
      }
    }
  };

  const urlToDataUrl = (url: string): Promise<string> => {
    if (url.startsWith('data:')) return Promise.resolve(url);
    return fetch(url).then(r => r.blob()).then(blob => new Promise<string>((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result as string);
      r.onerror = rej;
      r.readAsDataURL(blob);
    }));
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `swagify-${name}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownload = async (url: string, name: string) => {
    if (isHubEnv()) {
      try {
        const dataUrl = await urlToDataUrl(url);
        await openDownloadAction(dataUrl, 'swag');
      } catch {
        downloadImage(url, name);
      }
    } else {
      downloadImage(url, name);
    }
  };

  const handleLogoClick = () => {
    if (isHubEnv()) {
      openReferencePicker().then(setLogo).catch(() => {});
    } else {
      logoInputRef.current?.click();
    }
  };

  const handleStyleClick = () => {
    if (isHubEnv()) {
      openReferencePicker().then(setStyleRef).catch(() => {});
    } else {
      styleInputRef.current?.click();
    }
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const handleDownloadAll = () => {
    const completed = items.filter(item => !('isPending' in item)) as GenerationResult[];
    completed.forEach((res, index) => {
      setTimeout(() => {
        downloadImage(res.imageUrl, `${res.config.mockup}-${res.id}`);
      }, index * 400);
    });
  };

  const handleClearArchive = () => {
    if (confirm("Wipe all generated images from buffer?")) {
      setItems([]);
    }
  };

  const pendingCount = items.filter(item => 'isPending' in item).length;

  if (!hasKey) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4 font-mono">
        <div className="max-w-md w-full border border-[#333] p-8 text-center bg-[#0a0a0a]">
          <div className="w-12 h-12 border border-zinc-700 flex items-center justify-center mx-auto mb-6">
            <svg className="w-6 h-6 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="square" strokeLinejoin="miter" strokeWidth={1} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold mb-4 text-zinc-100 uppercase tracking-tighter">Key_Required</h1>
          <p className="text-zinc-500 text-[10px] mb-8 uppercase tracking-widest leading-relaxed">
            Gemini_3_Pro_Image access requires an authorized billing key.<br/>
            Select a project with billing enabled to proceed.
          </p>
          <div className="space-y-4">
            <button
              onClick={handleOpenKeySelector}
              className="w-full py-4 border border-zinc-700 text-zinc-100 uppercase text-xs tracking-widest hover:bg-white hover:text-black transition-all active:scale-95"
            >
              [ Trigger_Key_Selector ]
            </button>
            <a 
              href="https://ai.google.dev/gemini-api/docs/billing" 
              target="_blank" 
              rel="noopener noreferrer"
              className="block text-[9px] text-zinc-600 hover:text-zinc-400 uppercase tracking-widest"
            >
              View_Billing_Docs
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-400 font-mono">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#0a0a0a] backdrop-blur-md border-b border-[#333]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-6 h-6 border border-zinc-500 flex items-center justify-center">
              <div className="w-2 h-2 bg-zinc-500" />
            </div>
            <h1 className="text-xs font-bold tracking-[0.3em] text-zinc-100 uppercase">Swagify_System.v3</h1>
            {pendingCount > 0 && (
              <span className="text-[10px] bg-white text-black px-2 py-0.5 font-bold animate-pulse">
                TASKS: {pendingCount}
              </span>
            )}
          </div>
          {!isHubEnv() && (
            <button
              onClick={handleOpenKeySelector}
              className="text-[10px] text-zinc-600 hover:text-zinc-200 uppercase tracking-widest transition-colors"
            >
              [Change_Key]
            </button>
          )}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12 grid lg:grid-cols-12 gap-12">
        {/* Sidebar Controls */}
        <aside className="lg:col-span-4 space-y-10">
          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">01_Logo_Input</h2>
            <div 
              onClick={handleLogoClick}
              className={`aspect-video border border-[#333] flex items-center justify-center cursor-pointer transition-all bg-[#111] hover:border-zinc-500 ${logo ? 'border-zinc-500' : ''}`}
            >
              {logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-contain p-8" />
              ) : (
                <div className="text-center p-4">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-tighter">{isHubEnv() ? 'Upload_Or_From_History' : 'Upload_Source'}</p>
                </div>
              )}
              <input type="file" ref={logoInputRef} onChange={(e) => handleFileUpload(e, setLogo)} className="hidden" accept="image/*" />
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">02_Style_Control</h2>
            <div className="space-y-4">
              <select 
                value={stylePreset} 
                onChange={(e) => setStylePreset(e.target.value as StylePreset)}
                className="w-full bg-[#111] p-3 border border-[#333] text-xs text-zinc-400 focus:border-zinc-500 outline-none appearance-none"
              >
                {Object.values(StylePreset).map(preset => (
                  <option key={preset} value={preset}>{preset.toUpperCase().replace(/\s/g, '_')}</option>
                ))}
              </select>
              
              <div 
                onClick={handleStyleClick}
                className={`aspect-video border border-[#333] flex items-center justify-center cursor-pointer transition-all bg-[#111] hover:border-zinc-500 ${styleRef ? 'border-zinc-500' : ''}`}
              >
                {styleRef ? (
                  <img src={styleRef} alt="Style" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-center p-4">
                    <p className="text-[10px] text-zinc-600 uppercase tracking-tighter">{isHubEnv() ? 'Upload_Or_From_History' : 'Style_Reference'}</p>
                  </div>
                )}
                <input type="file" ref={styleInputRef} onChange={(e) => handleFileUpload(e, setStyleRef)} className="hidden" accept="image/*" />
              </div>
            </div>
          </section>

          <section className="space-y-4">
            <h2 className="text-[10px] font-bold text-zinc-600 uppercase tracking-[0.2em]">03_Output_Config</h2>
            <div className="space-y-6">
              <select 
                value={mockupType} 
                onChange={(e) => setMockupType(e.target.value as MockupType)}
                className="w-full bg-[#111] p-3 border border-[#333] text-xs text-zinc-400 focus:border-zinc-500 outline-none appearance-none"
              >
                {Object.values(MockupType).map(type => (
                  <option key={type} value={type}>{type.toUpperCase().replace(/\s/g, '_')}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-8">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-600 uppercase mb-1">Ratio</label>
                  {Object.values(AspectRatio).map(ratio => (
                    <button 
                      key={ratio}
                      onClick={() => setAspectRatio(ratio)}
                      className={`text-left p-2 text-[10px] border transition-all ${aspectRatio === ratio ? 'bg-zinc-100 text-black border-zinc-100' : 'border-[#333] text-zinc-600 hover:border-zinc-500'}`}
                    >
                      {ratio}
                    </button>
                  ))}
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] text-zinc-600 uppercase mb-1">Res</label>
                  {(["1K", "2K", "4K"] as const).map(res => (
                    <button 
                      key={res}
                      onClick={() => setResolution(res)}
                      className={`text-left p-2 text-[10px] border transition-all ${resolution === res ? 'bg-zinc-100 text-black border-zinc-100' : 'border-[#333] text-zinc-600 hover:border-zinc-500'}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <button
            onClick={handleGenerate}
            disabled={!logo}
            className={`w-full py-5 font-bold uppercase text-xs tracking-[0.4em] transition-all border ${!logo ? 'border-[#333] text-zinc-700 cursor-not-allowed' : 'bg-zinc-100 border-zinc-100 text-black hover:bg-[#111] hover:text-white hover:border-[#333] active:scale-[0.98]'}`}
          >
            Execute_Render
          </button>
          
          {error && (
            <div className="text-[10px] text-red-900 border border-red-900/20 p-4 bg-red-900/5 uppercase tracking-tighter">
              Error_Log: {error}
            </div>
          )}
        </aside>

        {/* Content Area */}
        <div className="lg:col-span-8 space-y-8">
          {/* Toolbar */}
          <div className="flex flex-col sm:flex-row items-center justify-between border-b border-[#333] pb-4 gap-4">
            <div className="flex items-center gap-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.5em] text-zinc-100">Archive</h2>
              <div className="flex border border-[#333]">
                <button 
                  onClick={() => setViewMode('GRID')}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-tighter transition-colors ${viewMode === 'GRID' ? 'bg-zinc-100 text-black' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  Grid
                </button>
                <button 
                  onClick={() => setViewMode('LIST')}
                  className={`px-3 py-1.5 text-[10px] uppercase tracking-tighter transition-colors ${viewMode === 'LIST' ? 'bg-zinc-100 text-black' : 'text-zinc-600 hover:text-zinc-400'}`}
                >
                  List
                </button>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <button 
                onClick={handleDownloadAll}
                disabled={items.filter(i => !('isPending' in i)).length === 0}
                className="text-[10px] text-zinc-400 hover:text-white uppercase tracking-widest disabled:opacity-30 transition-colors"
              >
                [Export_All]
              </button>
              <button 
                onClick={handleClearArchive}
                disabled={items.length === 0}
                className="text-[10px] text-red-900 hover:text-red-500 uppercase tracking-widest disabled:opacity-30 transition-colors"
              >
                [Clear_Archive]
              </button>
            </div>
          </div>

          {items.length === 0 ? (
            <div className="aspect-video border border-[#333] flex flex-col items-center justify-center space-y-6 opacity-30">
              <p className="text-[10px] uppercase tracking-[0.3em]">No_Output_Cached</p>
            </div>
          ) : (
            <div className={viewMode === 'GRID' ? "grid md:grid-cols-2 gap-10" : "flex flex-col gap-10"}>
              {items.map((item) => {
                const isPending = 'isPending' in item;
                return (
                  <div key={item.id} className="group border border-[#333] bg-[#111] overflow-hidden relative transition-all hover:border-zinc-500">
                    <div className="relative aspect-square overflow-hidden bg-zinc-950 flex items-center justify-center">
                      {isPending ? (
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-2 border-zinc-700 border-t-white animate-spin" />
                          <div className="text-center space-y-1">
                            <p className="text-[10px] uppercase tracking-widest text-zinc-100">Processing</p>
                            <p className="text-[8px] uppercase tracking-widest text-zinc-600">{item.config.mockup}</p>
                          </div>
                        </div>
                      ) : (
                        <>
                          <img 
                            src={item.imageUrl} 
                            alt={item.id} 
                            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-[#111]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button 
                              onClick={() => handleDownload(item.imageUrl, `${item.config.mockup}-${item.id}`)}
                              className="px-4 py-2 bg-white text-black text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 transition-all"
                            >
                              Download
                            </button>
                            <button 
                              onClick={() => handleDelete(item.id)}
                              className="px-4 py-2 border border-red-900 text-red-900 text-[10px] font-bold uppercase tracking-widest hover:bg-red-900 hover:text-white transition-all"
                            >
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    <div className="p-4 flex items-center justify-between border-t border-[#333] bg-[#111]">
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold text-zinc-100 uppercase tracking-tighter">{item.config.mockup}</p>
                        <p className="text-[8px] text-zinc-600 uppercase tracking-widest">
                          {item.config.resolution} // {item.config.ratio} // {isPending ? 'ID_PENDING' : `ID_${item.id.toUpperCase()}`}
                        </p>
                      </div>
                      {!isPending && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="text-[9px] text-zinc-600 hover:text-red-900 transition-colors uppercase"
                        >
                          [Remove]
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <div className="fixed inset-0 pointer-events-none opacity-[0.03] z-[-1]" 
           style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
    </div>
  );
};

export default App;
