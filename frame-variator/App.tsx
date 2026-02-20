import React, { useState, useEffect } from 'react';
import { GeminiService, CAMERA_POVS } from './services/geminiService';
import { Variation, SceneAnalysis, GridState } from './types';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';
import { 
  Upload, 
  RefreshCw, 
  Download, 
  X, 
  Camera, 
  Layers, 
  AlertCircle,
  Maximize,
  CheckCircle2,
  Film,
  Zap,
  Target,
  Terminal,
  Activity,
  Cpu,
  Scissors
} from 'lucide-react';

const TaskStatus: React.FC<{ active: boolean; stage: string }> = ({ active, stage }) => {
  if (!active) return null;
  return (
    <div className="fixed bottom-6 right-6 z-[200] bg-black border border-[#333] p-4 w-72 shadow-[0_0_30px_rgba(0,0,0,0.8)] animate-in slide-in-from-right-10 duration-500">
      <div className="flex justify-between items-center text-[9px] tracking-[0.4em] text-zinc-600 mb-3 font-bold">
        <span>ENGINE_STATUS</span>
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-zinc-700 animate-pulse"></div>
          <div className="w-1 h-1 bg-zinc-400 animate-pulse delay-75"></div>
          <div className="w-1 h-1 bg-zinc-100 animate-pulse delay-150"></div>
        </div>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-zinc-900 border border-[#333]">
            <Cpu className="w-3 h-3 text-zinc-400 animate-spin" style={{ animationDuration: '3s' }} />
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-[10px] text-zinc-100 uppercase tracking-widest truncate font-bold">{stage}</div>
            <div className="text-[8px] text-zinc-600 uppercase tracking-tighter">Latent Space Processing...</div>
          </div>
        </div>
        
        <div className="h-0.5 bg-zinc-900 w-full overflow-hidden">
          <div className="h-full bg-zinc-100 animate-progress" />
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Terminal className="w-3 h-3 text-zinc-800" />
          <span className="text-[8px] text-zinc-800 font-mono italic">Continuity_Verified</span>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [hasKey, setHasKey] = useState<boolean>(false);
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<SceneAnalysis | null>(null);
  
  const [cameraGrid, setCameraGrid] = useState<GridState>({ imageUrl: null, variations: [], selectedIndex: null });
  const [narrativeGrid, setNarrativeGrid] = useState<GridState>({ imageUrl: null, variations: [], selectedIndex: null });
  
  const [finalImage, setFinalImage] = useState<string | null>(null);
  const [topic, setTopic] = useState<string>('');
  const [mode, setMode] = useState<'camera' | 'narrative'>('camera');
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingStage, setLoadingStage] = useState<string>('Initializing');
  const [error, setError] = useState<string | null>(null);

  const currentGrid = mode === 'camera' ? cameraGrid : narrativeGrid;
  const setCurrentGrid = mode === 'camera' ? setCameraGrid : setNarrativeGrid;

  useEffect(() => {
    const checkKey = async () => {
      const exists = await (window as any).aistudio?.hasSelectedApiKey();
      setHasKey(!!exists);
    };
    checkKey();
  }, []);

  const handleSelectKey = async () => {
    await (window as any).aistudio?.openSelectKey();
    setHasKey(true);
  };

  const applyOriginalImage = (dataUrl: string) => {
    setOriginalImage(dataUrl);
    setCameraGrid({ imageUrl: null, variations: [], selectedIndex: null });
    setNarrativeGrid({ imageUrl: null, variations: [], selectedIndex: null });
    setFinalImage(null);
    setAnalysis(null);
    setError(null);
  };

  const onFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => applyOriginalImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSourcePlateClick = () => {
    if (isHubEnv()) {
      openReferencePicker().then(applyOriginalImage).catch(() => {});
    } else {
      document.getElementById('frame-variator-file-input')?.click();
    }
  };

  const generateProcess = async () => {
    if (!originalImage || loading) return;
    setLoading(true);
    setLoadingStage('Analyzing Plate');
    setError(null);
    try {
      let sceneData = analysis;
      if (!sceneData) {
        sceneData = await GeminiService.analyzeImage(originalImage);
        setAnalysis(sceneData);
      }

      let vars: Variation[] = [];

      if (mode === 'camera') {
        setLoadingStage('Mapping POV Matrix');
        vars = CAMERA_POVS.map((p, i) => ({ id: i, prompt: p, type: 'camera' as const }));
      } else {
        setLoadingStage('Narrative Synthesis');
        const suggestions = await GeminiService.getNarrativeSuggestions(sceneData, topic);
        vars = suggestions.map((s, i) => ({ id: i, prompt: `${s.title}: ${s.description}`, type: 'narrative' as const }));
      }

      setLoadingStage('Rendering Contact Sheet');
      const gridUrl = await GeminiService.generateGrid(originalImage, sceneData, vars);
      setCurrentGrid({ imageUrl: gridUrl, variations: vars, selectedIndex: null });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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

  const downloadGrid = async () => {
    if (!currentGrid.imageUrl) return;
    if (isHubEnv()) {
      try {
        const dataUrl = await urlToDataUrl(currentGrid.imageUrl);
        await openDownloadAction(dataUrl, 'frame-variator');
      } catch {
        const link = document.createElement('a');
        link.href = currentGrid.imageUrl;
        link.download = `FV_Grid_${mode}_${Date.now()}.png`;
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = currentGrid.imageUrl;
      link.download = `FV_Grid_${mode}_${Date.now()}.png`;
      link.click();
    }
  };

  const downloadSelectedPreview = () => {
    if (currentGrid.selectedIndex === null || !currentGrid.imageUrl) return;
    
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      const cellSize = img.width / 3;
      canvas.width = cellSize;
      canvas.height = cellSize;
      
      const x = (currentGrid.selectedIndex! % 3) * cellSize;
      const y = Math.floor(currentGrid.selectedIndex! / 3) * cellSize;
      
      ctx.drawImage(img, x, y, cellSize, cellSize, 0, 0, cellSize, cellSize);
      
      const link = document.createElement('a');
      link.href = canvas.toDataURL('image/png');
      link.download = `FV_Preview_FRM0${currentGrid.selectedIndex! + 1}_${mode}.png`;
      link.click();
    };
    img.src = currentGrid.imageUrl;
  };

  const renderFinal = async (size: "1K" | "2K" | "4K" = "4K") => {
    if (currentGrid.selectedIndex === null || !analysis || !originalImage || !currentGrid.imageUrl || loading) return;
    setLoading(true);
    setLoadingStage(`Master Render ${size}`);
    setFinalImage(null);
    try {
      const selectedVariation = currentGrid.variations[currentGrid.selectedIndex];
      const url = await GeminiService.generateSingle(
        originalImage, 
        currentGrid.imageUrl, 
        analysis, 
        currentGrid.selectedIndex, 
        selectedVariation.prompt, 
        size
      );
      setFinalImage(url);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-400 flex flex-col font-mono text-[11px] overflow-hidden">
      <TaskStatus active={loading} stage={loadingStage} />

      <header className="border-b border-[#333] p-4 flex justify-between items-center bg-[#0a0a0a] z-50">
        <div className="flex items-center gap-4">
          <Film className="w-5 h-5 text-zinc-500" />
          <h1 className="font-bold tracking-[0.4em] text-zinc-100 uppercase">Frame_Variator // V2.5_PRO</h1>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex border border-[#333] bg-[#111]">
            <button 
              disabled={loading}
              onClick={() => setMode('camera')}
              className={`px-3 py-1 uppercase tracking-widest text-[9px] transition-colors ${mode === 'camera' ? 'bg-zinc-200 text-black font-bold' : 'hover:text-zinc-200'} disabled:opacity-50`}
            >
              POV_MODE
            </button>
            <button 
              disabled={loading}
              onClick={() => setMode('narrative')}
              className={`px-3 py-1 uppercase tracking-widest text-[9px] transition-colors ${mode === 'narrative' ? 'bg-zinc-200 text-black font-bold' : 'hover:text-zinc-200'} disabled:opacity-50`}
            >
              NARRATIVE_MODE
            </button>
          </div>
          {!hasKey && (
            <button onClick={handleSelectKey} className="text-[9px] border border-[#333] px-3 py-1 bg-red-950/20 text-red-400 hover:bg-red-900/40 font-bold uppercase">
              OFFLINE_KEY
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <aside className="w-80 border-r border-[#333] p-6 space-y-8 flex flex-col overflow-y-auto bg-[#0a0a0a]">
          <section>
            <label className="text-[9px] uppercase tracking-widest text-zinc-600 block mb-3">01 // SOURCE_PLATE</label>
            <div className="aspect-video bg-[#111] border border-[#333] flex items-center justify-center relative group">
              {originalImage ? (
                <>
                  <img src={originalImage} className="w-full h-full object-cover opacity-50 transition-opacity group-hover:opacity-70" />
                  <button 
                    disabled={loading}
                    onClick={() => setOriginalImage(null)} 
                    className="absolute top-2 right-2 p-1 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity disabled:hidden"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </>
              ) : (
                <label className="cursor-pointer flex flex-col items-center p-4 text-center" onClick={(e) => { e.preventDefault(); handleSourcePlateClick(); }}>
                  <Upload className="w-5 h-5 mb-2 text-zinc-700" />
                  <span className="text-[9px] text-zinc-600">{isHubEnv() ? 'UPLOAD_OR_FROM_HISTORY' : 'UPLOAD_PLATE'}</span>
                  <input id="frame-variator-file-input" type="file" className="hidden" onChange={onFileUpload} disabled={loading} />
                </label>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <label className="text-[9px] uppercase tracking-widest text-zinc-600 block">02 // CONFIG</label>
            {mode === 'narrative' && (
              <div className="space-y-2">
                <span className="text-[9px] text-zinc-500 block uppercase italic">Exploration_Topic</span>
                <input 
                  type="text" 
                  placeholder="e.g. Action sequence, Melancholy" 
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  disabled={loading}
                  className="w-full bg-black border border-[#333] p-3 text-[10px] outline-none focus:border-zinc-500 transition-colors text-zinc-200 disabled:opacity-50"
                />
              </div>
            )}
            <div className="p-3 border border-[#333] bg-[#111]/50 space-y-2">
              <span className="text-[9px] text-zinc-500 block uppercase italic">Active_Preset</span>
              <p className="text-[10px] text-zinc-300 flex items-center gap-2">
                {mode === 'camera' ? <Target className="w-3 h-3 text-zinc-500" /> : <Zap className="w-3 h-3 text-zinc-500" />}
                {mode === 'camera' ? "STRICT_POV_MATRIX" : "NARRATIVE_STORYBOARD"}
              </p>
            </div>
          </section>

          <button 
            disabled={!originalImage || loading}
            onClick={generateProcess}
            className="w-full py-5 bg-zinc-100 text-black font-bold text-[10px] tracking-[0.2em] hover:bg-white transition-all disabled:opacity-10 uppercase flex items-center justify-center gap-3"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : currentGrid.imageUrl ? "REGENERATE_MATRIX" : "PROCESS_3X3_MATRIX"}
          </button>

          {analysis && (
            <div className="flex-1 overflow-y-auto pt-6 border-t border-[#333] space-y-4 opacity-50 hover:opacity-100 transition-opacity">
              <label className="text-[9px] uppercase tracking-widest text-zinc-600 block">DNA_METADATA</label>
              <div className="text-[10px] leading-relaxed space-y-4 font-light text-zinc-500">
                <div><span className="text-zinc-400 uppercase font-bold block mb-1">LIKENESS:</span> {analysis.actor.substring(0, 150)}...</div>
                <div className="p-2 bg-zinc-900/40 border border-[#333]">
                  <span className="text-zinc-200 uppercase font-bold block mb-1 flex items-center gap-2">
                    <CheckCircle2 className="w-3 h-3" />
                    LUT_LOCKED_TO_SOURCE
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 border border-red-900 bg-red-950/10 text-red-500 text-[9px] flex gap-2">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </aside>

        <main className="flex-1 p-8 bg-[#0a0a0a] flex flex-col relative overflow-y-auto">
          {currentGrid.imageUrl ? (
            <div className="max-w-4xl mx-auto w-full space-y-10">
              <div className="animate-in fade-in duration-700">
                <div className="flex justify-between items-end mb-4">
                  <label className="text-[9px] uppercase tracking-widest text-zinc-500">Contact_Sheet // {mode.toUpperCase()}_MODE</label>
                  <button 
                    onClick={downloadGrid}
                    disabled={loading}
                    className="flex items-center gap-2 text-[9px] text-zinc-400 hover:text-white border border-[#333] px-3 py-1 transition-colors uppercase font-bold disabled:opacity-30"
                  >
                    <Download className="w-3 h-3" />
                    EXPORT_FULL_GRID
                  </button>
                </div>
                <div className="relative aspect-square border border-[#333] bg-black shadow-[0_0_50px_rgba(0,0,0,1)]">
                  <img src={currentGrid.imageUrl} className="w-full h-full object-contain" alt="Grid" />
                  
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3">
                    {currentGrid.variations.map((v, i) => (
                      <div 
                        key={i}
                        onClick={() => !loading && setCurrentGrid(prev => ({ ...prev, selectedIndex: i }))}
                        className={`border border-white/5 cursor-pointer transition-all flex flex-col justify-end p-2 group relative
                          ${currentGrid.selectedIndex === i ? 'bg-white/10 ring-2 ring-zinc-100 border-transparent z-10 shadow-[inset_0_0_20px_rgba(255,255,255,0.1)]' : 'hover:bg-white/5'}
                          ${loading ? 'cursor-wait' : ''}
                        `}
                      >
                        <div className="flex justify-between items-end w-full">
                          <span className={`text-[9px] font-bold ${currentGrid.selectedIndex === i ? 'text-white' : 'text-zinc-800'}`}>FRM_0{i+1}</span>
                        </div>
                        {currentGrid.selectedIndex === i && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/5 backdrop-blur-[1px]">
                            <Target className="w-6 h-6 text-white/50" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {currentGrid.selectedIndex !== null && (
                <div className="border border-[#333] p-8 flex flex-col md:flex-row gap-10 bg-[#111]/30 animate-in fade-in slide-in-from-bottom-6 duration-700 shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
                  <div className="flex-1 space-y-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] px-2 py-1 bg-zinc-800 text-zinc-200 font-bold uppercase tracking-widest">SELECTED: FRAME_0{currentGrid.selectedIndex + 1}</span>
                      <div className="h-px bg-zinc-900 flex-1"></div>
                    </div>
                    <p className="text-zinc-100 text-[13px] leading-relaxed font-light italic border-l-2 border-zinc-800 pl-4">
                      "{currentGrid.variations[currentGrid.selectedIndex].prompt}"
                    </p>
                  </div>
                  <div className="w-full md:w-72 space-y-3">
                    <button 
                      onClick={downloadSelectedPreview}
                      disabled={loading}
                      className="w-full py-4 bg-zinc-900 border border-[#333] text-zinc-300 text-[9px] font-bold tracking-[0.2em] hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 disabled:opacity-20 uppercase"
                    >
                      <Scissors className="w-3 h-3" />
                      Download_Crop_Preview
                    </button>
                    <button 
                      onClick={() => renderFinal("4K")}
                      disabled={loading}
                      className="w-full py-5 bg-transparent border-2 border-zinc-100 text-zinc-100 text-[10px] font-bold tracking-[0.3em] hover:bg-zinc-100 hover:text-black transition-all flex items-center justify-center gap-3 disabled:opacity-20"
                    >
                      {loading && loadingStage.includes('Master') ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Maximize className="w-4 h-4" />}
                      RENDER_4K_MASTER
                    </button>
                    <div className="text-[9px] text-zinc-800 text-center uppercase tracking-widest font-bold pt-2">
                      LUT_FIDELITY: VERIFIED_LOCKED
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
              <div className="relative mb-8 opacity-5">
                <Camera className="w-32 h-32 text-zinc-500" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Layers className="w-12 h-12 text-zinc-400" />
                </div>
              </div>
              <p className="text-[10px] tracking-[1.5em] text-zinc-800 uppercase font-bold">Awaiting_Source_Plate</p>
              {mode === 'narrative' && narrativeGrid.imageUrl === null && cameraGrid.imageUrl !== null && (
                <p className="text-[8px] text-zinc-700 uppercase mt-4">Note: POV results are stored in POV_MODE</p>
              )}
              {mode === 'camera' && cameraGrid.imageUrl === null && narrativeGrid.imageUrl !== null && (
                <p className="text-[8px] text-zinc-700 uppercase mt-4">Note: Narrative results are stored in NARRATIVE_MODE</p>
              )}
            </div>
          )}
        </main>
      </div>

      {finalImage && (
        <div className="fixed inset-0 z-[100] bg-black/98 flex items-center justify-center p-4 backdrop-blur-md">
          <div className="max-w-[95vw] w-full bg-black border border-[#333] flex flex-col shadow-[0_0_100px_rgba(0,0,0,1)] animate-in zoom-in-95 duration-300">
            <div className="p-4 border-b border-[#333] flex justify-between items-center bg-[#111]">
              <div className="flex items-center gap-3">
                <Maximize className="w-4 h-4 text-zinc-500" />
                <span className="text-[10px] tracking-[0.4em] text-zinc-400 font-bold uppercase">Master_Output // RES: 4K // LUT: LOCKED</span>
              </div>
              <div className="flex gap-4 items-center">
                <button 
                  onClick={async () => {
                    if (isHubEnv()) {
                      try {
                        await openDownloadAction(finalImage, 'frame-variator');
                      } catch {
                        const link = document.createElement('a');
                        link.href = finalImage;
                        link.download = `FV_Frame_4K_${Date.now()}.png`;
                        link.click();
                      }
                    } else {
                      const link = document.createElement('a');
                      link.href = finalImage;
                      link.download = `FV_Frame_4K_${Date.now()}.png`;
                      link.click();
                    }
                  }}
                  className="text-[10px] bg-zinc-100 text-black px-6 py-2 font-bold hover:bg-white tracking-widest transition-colors"
                >
                  DOWNLOAD_MASTER_PNG
                </button>
                <button onClick={() => setFinalImage(null)} className="text-zinc-600 hover:text-zinc-100 p-2 transition-colors border border-[#333]">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-8 flex items-center justify-center bg-[#111] min-h-0">
              <img src={finalImage} className="max-w-full max-h-[70vh] object-contain shadow-[0_0_120px_rgba(255,255,255,0.03)] border border-[#333]" alt="Final" />
            </div>
            <div className="p-4 bg-[#111]/50 border-t border-[#333] flex justify-between text-[9px] text-zinc-800 uppercase tracking-widest font-bold">
               <span className="flex items-center gap-2"><Activity className="w-3 h-3"/> TECHNICAL_PASS: COMPLETE</span>
               <span className="flex items-center gap-2"><Target className="w-3 h-3"/> STYLE_CONTINUITY: 100%_SECURED</span>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .animate-progress {
          animation: progress 1.5s infinite linear;
        }
        .cursor-wait {
          cursor: wait !important;
        }
      `}</style>
    </div>
  );
};

export default App;
