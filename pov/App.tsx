
import React, { useState, useEffect, useRef } from 'react';
import { AppState, GeneratedImage } from './types';
import { generateProImage } from './services/geminiService';
import CropOverlay from './components/CropOverlay';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.KEY_SELECTION);
  const [prompt, setPrompt] = useState('');
  const [resolution, setResolution] = useState<'1K' | '2K' | '4K'>('1K');
  const [gridSize, setGridSize] = useState<number>(2);
  const [isGridMode, setIsGridMode] = useState(true);
  const [aspectRatio, setAspectRatio] = useState<"1:1" | "3:4" | "4:3" | "9:16" | "16:9">("1:1");
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [history, setHistory] = useState<GeneratedImage[]>([]);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [selectedForCrop, setSelectedForCrop] = useState<GeneratedImage | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      try {
        // @ts-ignore
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (hasKey) {
          setAppState(AppState.IDLE);
        }
      } catch (e) {
        console.error("Key selection check failed", e);
      }
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    try {
      // @ts-ignore
      await window.aistudio.openSelectKey();
      // guidelines: assume success after trigger
      setAppState(AppState.IDLE);
    } catch (e) {
      console.error("Key selection window failed", e);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setUploadedImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const runGeneration = async (isRefining = false, refinePromptOverride?: string, imageOverride?: string) => {
    if (!prompt && !isRefining) return;
    
    setAppState(isRefining ? AppState.UPSCALING : AppState.GENERATING);
    setLoadingMessage(isRefining ? "UPSCALE_TO_4K_REFINEMENT..." : "EXECUTING_GRID_GENERATION...");
    
    try {
      const resultUrl = await generateProImage({
        prompt: refinePromptOverride || prompt,
        imageInput: imageOverride || uploadedImage || undefined,
        isGrid: isRefining ? false : isGridMode,
        gridSize: gridSize,
        resolution: isRefining ? '4K' : resolution,
        aspectRatio: aspectRatio
      });

      const newImage: GeneratedImage = {
        id: Math.random().toString(36).substring(7),
        url: resultUrl,
        prompt: refinePromptOverride || prompt,
        timestamp: Date.now(),
        isGrid: isRefining ? false : isGridMode,
        gridSize: isRefining ? 1 : gridSize,
        resolution: isRefining ? '4K' : resolution
      };

      setHistory(prev => [newImage, ...prev]);
      setAppState(AppState.IDLE);
    } catch (error: any) {
      console.error(error);
      if (error.message === 'AUTH_REQUIRED') {
        alert("AUTHORIZATION REQUIRED: PLEASE SELECT A PAID API KEY.");
        setAppState(AppState.KEY_SELECTION);
      } else {
        alert("CORE_ERROR: " + error.message);
        setAppState(AppState.IDLE);
      }
    }
  };

  const handleCropConfirm = (croppedImageData: string) => {
    if (!selectedForCrop) return;
    
    const refinePrompt = `Conceptual refinement: Expand and upscale this specific variant into a high-fidelity 4K output. Maintain the artistic essence, lighting, and composition precisely: ${selectedForCrop.prompt}`;
    
    setSelectedForCrop(null);
    runGeneration(true, refinePrompt, croppedImageData);
  };

  if (appState === AppState.KEY_SELECTION) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center font-mono bg-black text-zinc-400">
        <div className="bg-zinc-950 p-16 border border-zinc-900 w-full max-w-xl">
          <div className="w-10 h-10 bg-white mx-auto mb-10"></div>
          <h1 className="text-2xl font-bold mb-4 tracking-[0.5em] uppercase text-zinc-100">CONCEPT_ART_STUDIO</h1>
          <p className="text-[10px] mb-12 leading-relaxed uppercase tracking-[0.3em] text-zinc-600 max-w-xs mx-auto">
            High-end 4K Image Generation & Variation Refining Suite.
          </p>
          <button
            onClick={handleSelectKey}
            className="w-full py-5 bg-zinc-100 text-black font-bold border border-zinc-100 hover:bg-white transition text-xs tracking-[0.4em]"
          >
            AUTHORIZE_API_SESSION
          </button>
          <p className="mt-8 text-[9px] text-zinc-700 tracking-widest uppercase">
            Paid project billing required (Gemini 3 Pro)
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black font-mono text-zinc-500 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-96 border-r border-zinc-900 flex flex-col p-8 overflow-y-auto bg-zinc-950">
        <div className="flex flex-col gap-2 mb-20 border-l border-zinc-100 pl-4">
          <span className="font-bold text-sm tracking-[0.5em] uppercase text-zinc-100">CONCEPT_ART</span>
          <span className="text-[10px] tracking-[0.2em] uppercase text-zinc-700 font-bold">STUDIO_V2.5</span>
        </div>

        <div className="space-y-14">
          <section>
            <div className="flex justify-between items-center mb-5">
              <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em]">01_CORE_PROMPT</label>
              <span className="text-[8px] text-zinc-800">[AUTO_SAVE: ON]</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="DEFINE_ARTISTIC_CONCEPT..."
              className="w-full bg-black border border-zinc-900 p-5 text-[11px] text-zinc-300 focus:outline-none focus:border-zinc-100 min-h-[180px] resize-none leading-loose placeholder:text-zinc-800 transition-colors"
            />
          </section>

          <section>
            <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] block mb-5">02_INPUT_REFERENCE</label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-40 border border-zinc-900 flex flex-col items-center justify-center cursor-pointer hover:bg-zinc-900 transition-all overflow-hidden relative group"
            >
              {uploadedImage ? (
                <>
                  <img src={uploadedImage} alt="Reference" className="w-full h-full object-cover opacity-30 grayscale group-hover:opacity-50 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold bg-black/70 tracking-[0.3em] text-zinc-200 opacity-0 group-hover:opacity-100 transition-opacity">OVERWRITE_FILE</div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-4 h-4 border border-zinc-800 group-hover:border-zinc-500 transition-colors"></div>
                  <span className="text-[8px] text-zinc-800 font-bold tracking-[0.4em] uppercase group-hover:text-zinc-600">BIND_LOCAL_ASSET</span>
                </div>
              )}
            </div>
            <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" accept="image/*" />
          </section>

          <section className="space-y-10">
            <div>
              <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] block mb-5">03_GRID_CONFIGURATION</label>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 4].map(size => (
                  <button
                    key={size}
                    onClick={() => { setIsGridMode(true); setGridSize(size); }}
                    className={`py-3 text-[10px] border transition-all ${isGridMode && gridSize === size ? 'bg-zinc-100 text-black border-zinc-100 font-bold' : 'bg-black border-zinc-900 text-zinc-700 hover:border-zinc-500'}`}
                  >
                    {size}X{size}
                  </button>
                ))}
                <button
                  onClick={() => setIsGridMode(false)}
                  title="Single Image Mode"
                  className={`py-3 text-[10px] border transition-all ${!isGridMode ? 'bg-zinc-100 text-black border-zinc-100 font-bold' : 'bg-black border-zinc-900 text-zinc-700 hover:border-zinc-500'}`}
                >
                  SGL
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] block mb-5">04_DIMENSION</label>
                <div className="flex border border-zinc-900">
                  {['1K', '2K', '4K'].map(res => (
                    <button
                      key={res}
                      onClick={() => setResolution(res as any)}
                      className={`flex-1 py-2.5 text-[9px] transition-all ${resolution === res ? 'bg-zinc-100 text-black font-bold' : 'text-zinc-800 hover:text-zinc-600'}`}
                    >
                      {res}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.4em] block mb-5">05_RATIO</label>
                <div className="relative">
                  <select
                    value={aspectRatio}
                    onChange={(e) => setAspectRatio(e.target.value as any)}
                    className="w-full bg-black border border-zinc-900 p-2.5 text-[9px] focus:outline-none focus:border-zinc-100 appearance-none cursor-pointer uppercase text-zinc-700"
                  >
                    <option value="1:1">1:1 SQUARE</option>
                    <option value="16:9">16:9 CINEMA</option>
                    <option value="9:16">9:16 MOBILE</option>
                    <option value="4:3">4:3 PHOTO</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[8px] text-zinc-800">▼</div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="mt-auto pt-14">
          <button
            disabled={appState !== AppState.IDLE || (!prompt && !uploadedImage)}
            onClick={() => runGeneration()}
            className="w-full py-6 bg-zinc-100 text-black font-bold hover:bg-white disabled:opacity-5 disabled:cursor-not-allowed transition-all text-[11px] tracking-[0.5em] uppercase"
          >
            {appState === AppState.IDLE ? 'EXECUTE_PIPELINE' : 'TRANSMITTING...'}
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex-1 overflow-y-auto p-16 bg-black">
        {history.length === 0 && appState === AppState.IDLE && (
          <div className="h-full flex flex-col items-center justify-center">
            <div className="w-1 h-1 bg-zinc-900 mb-6"></div>
            <p className="text-[10px] text-zinc-900 tracking-[1em] uppercase">SYSTEM_IDLE</p>
          </div>
        )}

        {(appState === AppState.GENERATING || appState === AppState.UPSCALING) && (
          <div className="flex flex-col items-center justify-center h-full space-y-10">
             <div className="w-10 h-[1px] bg-zinc-800 overflow-hidden relative">
               <div className="absolute inset-0 bg-white animate-[ping_1.5s_infinite]"></div>
             </div>
             <p className="text-[9px] text-zinc-700 tracking-[0.4em] uppercase animate-pulse">{loadingMessage}</p>
          </div>
        )}

        {history.length > 0 && appState === AppState.IDLE && (
          <div className="max-w-6xl mx-auto space-y-40 pb-60">
            {history.map((img, idx) => (
              <div key={img.id} className="group relative">
                <div className="flex items-end justify-between mb-8 pb-4 border-b border-zinc-900">
                  <div className="flex items-center gap-10">
                    <span className="text-[10px] font-bold text-zinc-900 tabular-nums tracking-widest">SEQ_ID_{String(history.length - idx).padStart(3, '0')}</span>
                    <span className="text-[9px] text-zinc-700 uppercase tracking-[0.3em]">
                      {img.isGrid ? `LAYOUT_${img.gridSize}X${img.gridSize}_GRID` : 'REFINED_UHD_OUTPUT'} • {img.resolution}
                    </span>
                  </div>
                  <div className="flex gap-10">
                    {img.isGrid && (
                      <button 
                        onClick={() => setSelectedForCrop(img)}
                        className="text-[9px] font-bold text-zinc-400 hover:text-white transition-all uppercase tracking-[0.3em] border-b border-transparent hover:border-zinc-500 pb-1"
                      >
                        [ SELECT_CELL ]
                      </button>
                    )}
                    <a 
                      href={img.url} 
                      download={`concept-${img.id}.png`}
                      className="text-[9px] font-bold text-zinc-800 hover:text-zinc-200 transition-all uppercase tracking-[0.3em]"
                    >
                      DOWNLOAD
                    </a>
                  </div>
                </div>
                <div className="bg-zinc-950 border border-zinc-900 aspect-video flex items-center justify-center transition-all hover:border-zinc-700 overflow-hidden shadow-2xl">
                  <img 
                    src={img.url} 
                    alt={img.prompt} 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <div className="mt-8 flex justify-between items-start gap-10">
                   <div className="flex-1">
                     <p className="text-[8px] font-bold text-zinc-800 uppercase tracking-widest mb-2">PROMPT_METADATA</p>
                     <p className="text-[10px] text-zinc-600 leading-relaxed uppercase tracking-[0.15em]">
                       {img.prompt}
                     </p>
                   </div>
                   <div className="text-right">
                     <p className="text-[8px] font-bold text-zinc-800 uppercase tracking-widest mb-2">TIME_LOG</p>
                     <p className="text-[10px] text-zinc-800 tabular-nums">
                       {new Date(img.timestamp).toLocaleTimeString([], {hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit'})}
                     </p>
                   </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {selectedForCrop && (
        <CropOverlay
          imageUrl={selectedForCrop.url}
          gridSize={selectedForCrop.gridSize}
          onConfirm={handleCropConfirm}
          onCancel={() => setSelectedForCrop(null)}
        />
      )}
    </div>
  );
};

export default App;
