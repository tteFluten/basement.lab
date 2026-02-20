
import React, { useState, useEffect, useRef } from 'react';
import { analyzeCausality, analyzeConsequence, reconstructFrame, AnalysisResult } from './services/geminiService';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';

type GeminiAspectRatio = "1:1" | "3:4" | "4:3" | "9:16" | "16:9";

interface TimelineFrame {
  id: string;
  data: string;
  timeLabel: string;
  analysis: string;
  visualPrompt: string;
  step: number; // 0 is original, negative is past, positive is future
}

const App: React.FC = () => {
  const [timeline, setTimeline] = useState<TimelineFrame[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [aspectRatio, setAspectRatio] = useState<GeminiAspectRatio>("1:1");
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [showComparison, setShowComparison] = useState<boolean>(false);
  const [editingPrompt, setEditingPrompt] = useState<string>('');
  
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timeline[selectedIndex]) {
      setEditingPrompt(timeline[selectedIndex].visualPrompt);
    }
  }, [selectedIndex, timeline]);

  const determineAspectRatio = (width: number, height: number): GeminiAspectRatio => {
    const ratio = width / height;
    if (ratio > 1.5) return "16:9";
    if (ratio > 1.1) return "4:3";
    if (ratio > 0.85) return "1:1";
    if (ratio > 0.65) return "3:4";
    return "9:16";
  };

  const applyReferenceImage = (result: string) => {
    const img = new Image();
    img.onload = () => {
      const ratio = determineAspectRatio(img.width, img.height);
      setAspectRatio(ratio);
      const initialFrame: TimelineFrame = {
        id: crypto.randomUUID(),
        data: result,
        timeLabel: 'T-0s',
        analysis: 'Original Reference Frame.',
        visualPrompt: '',
        step: 0
      };
      setTimeline([initialFrame]);
      setSelectedIndex(0);
      setError(null);
    };
    img.src = result;
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => applyReferenceImage(e.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleReferenceClick = () => {
    if (isHubEnv()) {
      openReferencePicker().then(applyReferenceImage).catch(() => {});
    } else {
      document.getElementById('chronos-file-input')?.click();
    }
  };

  const reverseTimeStep = async () => {
    const sourceFrame = timeline[0]; 
    setIsProcessing(true);
    setError(null);

    try {
      const analysisResult: AnalysisResult = await analyzeCausality(sourceFrame.data);
      const newImageData = await reconstructFrame(analysisResult.visualPrompt, sourceFrame.data, aspectRatio, "PAST");
      
      const newStep = sourceFrame.step - 1;
      const newFrame: TimelineFrame = {
        id: crypto.randomUUID(),
        data: newImageData,
        timeLabel: `T${newStep * 5}s`,
        analysis: analysisResult.thoughtProcess,
        visualPrompt: analysisResult.visualPrompt,
        step: newStep
      };

      setTimeline(prev => [newFrame, ...prev]);
      setSelectedIndex(0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const advanceTimeStep = async () => {
    const sourceFrame = timeline[timeline.length - 1];
    setIsProcessing(true);
    setError(null);

    try {
      const analysisResult: AnalysisResult = await analyzeConsequence(sourceFrame.data);
      const newImageData = await reconstructFrame(analysisResult.visualPrompt, sourceFrame.data, aspectRatio, "FUTURE");
      
      const newStep = sourceFrame.step + 1;
      const newFrame: TimelineFrame = {
        id: crypto.randomUUID(),
        data: newImageData,
        timeLabel: `T${newStep >= 0 ? '+' : ''}${newStep * 5}s`,
        analysis: analysisResult.thoughtProcess,
        visualPrompt: analysisResult.visualPrompt,
        step: newStep
      };

      setTimeline(prev => [...prev, newFrame]);
      setSelectedIndex(timeline.length);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const refineCurrentFrame = async () => {
    if (timeline.length === 0) return;
    const frameToRefine = timeline[selectedIndex];
    if (frameToRefine.step === 0) return;

    const sourceFrame = frameToRefine.step < 0 ? timeline[selectedIndex + 1] : timeline[selectedIndex - 1];

    setIsProcessing(true);
    setError(null);
    try {
      const result = await reconstructFrame(
        editingPrompt, 
        sourceFrame.data, 
        aspectRatio, 
        frameToRefine.step < 0 ? "PAST" : "FUTURE"
      );
      const updatedTimeline = [...timeline];
      updatedTimeline[selectedIndex] = {
        ...frameToRefine,
        data: result,
        visualPrompt: editingPrompt
      };
      setTimeline(updatedTimeline);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadFrame = async () => {
    const current = timeline[selectedIndex];
    if (!current) return;
    if (isHubEnv()) {
      try {
        await openDownloadAction(current.data, 'chronos');
      } catch {
        const link = document.createElement('a');
        link.href = current.data;
        link.download = `CHRONOS_${current.timeLabel}.png`;
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = current.data;
      link.download = `CHRONOS_${current.timeLabel}.png`;
      link.click();
    }
  };

  const reset = () => {
    setTimeline([]);
    setSelectedIndex(0);
    setError(null);
  };

  const currentFrame = timeline[selectedIndex];
  const originalFrame = timeline.find(f => f.step === 0);

  // SVG Linear Icons
  const IconUpload = () => <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M12 16V4m0 0l-4 4m4-4l4 4m-9 12h10" /></svg>;
  const IconBackwards = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>;
  const IconForwards = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M13 19l7-7-7-7m-8 14l7-7-7-7" /></svg>;
  const IconCompare = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" /></svg>;
  const IconDownload = () => <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>;
  const IconTrash = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>;
  const IconSparkles = () => <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1" viewBox="0 0 24 24"><path d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-7.714 2.143L11 21l-2.286-6.857L1 12l7.714-2.143L11 3z" /></svg>;

  return (
    <div className="flex flex-col h-screen bg-[#050505] text-zinc-400 font-mono overflow-hidden">
      {/* TOP HEADER */}
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-[#333] bg-[#0a0a0a] backdrop-blur-md z-20">
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-bold tracking-[0.3em] text-white">CHRONOS <span className="text-zinc-600 font-light">//</span> V4.6</h1>
          <div className="h-3 w-[1px] bg-white/10"></div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">{aspectRatio}_RATIO_LOCKED</span>
        </div>
        
        <div className="flex items-center gap-6">
          {timeline.length > 0 && (
            <button 
              onClick={reset}
              className="text-[9px] flex items-center gap-2 hover:text-white transition-all uppercase tracking-widest border border-[#333] px-2 py-1 rounded"
            >
              <IconTrash /> RESET_SESSION
            </button>
          )}
          <div className="text-[10px] text-zinc-600 flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${isProcessing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`}></div>
            {isProcessing ? 'PROCESSING_TEMPORAL_WAVES' : 'ENGINE_READY'}
          </div>
        </div>
      </header>

      {/* MAIN LAYOUT */}
      <div className="flex-grow flex min-h-0 overflow-hidden">
        
        {/* TIMELINE SIDEBAR */}
        <aside className="w-28 border-r border-[#333] flex flex-col bg-[#0a0a0a] overflow-hidden">
          <div className="p-3 text-[9px] font-bold text-zinc-600 border-b border-[#333] uppercase tracking-widest text-center">Timeline</div>
          <div ref={scrollRef} className="flex-grow overflow-y-auto no-scrollbar py-2">
            {timeline.map((frame, idx) => (
              <button
                key={frame.id}
                onClick={() => setSelectedIndex(idx)}
                className={`w-full p-2 mb-2 transition-all relative group ${selectedIndex === idx ? 'opacity-100 scale-100' : 'opacity-40 hover:opacity-70 scale-95'}`}
              >
                <div className={`aspect-square bg-black border ${selectedIndex === idx ? 'border-white/40' : 'border-white/5'} overflow-hidden rounded-sm mb-1`}>
                  <img src={frame.data} className="w-full h-full object-cover" alt="" />
                </div>
                <div className={`text-[8px] text-center uppercase tracking-tighter font-bold ${frame.step === 0 ? 'text-white' : 'text-zinc-500'}`}>
                  {frame.timeLabel}
                </div>
                {selectedIndex === idx && <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-8 bg-white"></div>}
              </button>
            ))}
            {timeline.length === 0 && (
              <div className="flex-grow flex items-center justify-center p-4">
                <div className="text-[8px] rotate-90 text-zinc-800 whitespace-nowrap uppercase tracking-widest opacity-30">Void_State</div>
              </div>
            )}
          </div>
        </aside>

        {/* WORKSPACE */}
        <main className="flex-grow flex flex-col min-w-0 bg-[#080808] relative">
          
          {/* IMAGE PREVIEW AREA */}
          <div className="flex-grow flex items-center justify-center p-6 min-h-0 relative overflow-hidden">
            {timeline.length > 0 ? (
              <div className="relative group max-w-full max-h-full flex items-center justify-center">
                {/* Fixed-size wrapper to ensure both images scale identically */}
                <div className="relative inline-block max-w-full max-h-full shadow-[0_0_80px_rgba(0,0,0,0.8)] border border-white/5 overflow-hidden transition-all duration-700 ease-out">
                  <img 
                    src={currentFrame.data} 
                    className={`max-w-full max-h-[70vh] object-contain transition-all duration-300 ${showComparison ? 'brightness-[0.2] grayscale' : ''}`} 
                    alt="Main view" 
                  />
                  
                  {/* Perfect 1:1 Comparison Overlay */}
                  {showComparison && originalFrame && (
                     <img 
                      src={originalFrame.data} 
                      className="absolute inset-0 w-full h-full object-contain z-10 mix-blend-screen opacity-70 pointer-events-none filter brightness-125" 
                      alt="Original comparison" 
                    />
                  )}
                  
                  {/* Processing Overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] z-30 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-[1px] bg-white/20 relative overflow-hidden">
                          <div className="absolute inset-0 bg-white w-1/2 animate-slide-infinite"></div>
                        </div>
                        <span className="text-[9px] uppercase tracking-[0.3em] text-white animate-pulse">Computing_Temporal_Flux</span>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="absolute top-4 left-4 flex gap-2 pointer-events-none z-40">
                  <span className="bg-black/90 text-white text-[9px] px-3 py-1.5 border border-white/10 backdrop-blur-md uppercase tracking-[0.2em] rounded-sm">
                    {currentFrame.timeLabel}
                  </span>
                  {showComparison && (
                    <span className="bg-white/10 text-white text-[9px] px-3 py-1.5 border border-white/20 backdrop-blur-md uppercase tracking-[0.2em] rounded-sm animate-pulse">
                      Ref_Comparison (T0)
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <label className="group flex flex-col items-center gap-8 cursor-pointer p-20 border border-[#333] bg-[#181818] hover:bg-[#1a1a1a] transition-all" onClick={(e) => { e.preventDefault(); handleReferenceClick(); }}>
                <div className="p-8 border border-[#333] group-hover:scale-110 group-hover:border-zinc-500 transition-all duration-500">
                  <IconUpload />
                </div>
                <div className="text-center">
                  <p className="text-[10px] tracking-[0.4em] uppercase text-zinc-500 group-hover:text-white transition-colors">{isHubEnv() ? 'Upload_Or_From_History' : 'Select_Reference_Frame'}</p>
                  <p className="text-[8px] text-zinc-600 mt-3 uppercase tracking-widest">Initial_Injection</p>
                </div>
                <input id="chronos-file-input" type="file" className="hidden" accept="image/*" onChange={handleFileUpload} />
              </label>
            )}

            {error && (
              <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-red-950/40 border border-red-500/50 text-red-200 text-[10px] px-6 py-3 uppercase font-bold backdrop-blur-xl z-50 rounded-sm">
                LOG_ERROR: {error}
              </div>
            )}
          </div>

          {/* CONTROL CONSOLE */}
          <div className="flex-shrink-0 border-t border-[#333] bg-[#0a0a0a] backdrop-blur-2xl px-8 py-6">
            <div className="grid grid-cols-12 gap-10 max-w-7xl mx-auto">
              
              {/* Analysis Log */}
              <div className="col-span-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <div className="w-1 h-1 bg-zinc-700"></div> Temporal_Causality_Analysis
                </div>
                <div className="h-28 border border-white/5 bg-black/40 p-3 overflow-y-auto text-[11px] leading-relaxed text-zinc-400 scrollbar-hide font-light italic">
                  {currentFrame?.analysis || 'System Standby. Injection Required.'}
                </div>
              </div>

              {/* Prompt Buffer */}
              <div className="col-span-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                    <div className="w-1 h-1 bg-zinc-700"></div> Continuity_Refinement_Buffer
                  </div>
                  {currentFrame && currentFrame.step !== 0 && (
                    <button 
                      onClick={refineCurrentFrame} 
                      disabled={isProcessing}
                      className="text-[9px] bg-white/5 hover:bg-white/10 text-white px-2 py-0.5 rounded transition-all flex items-center gap-1 uppercase tracking-tighter disabled:opacity-20"
                    >
                      <IconSparkles /> REGENERATE
                    </button>
                  )}
                </div>
                <textarea 
                  value={editingPrompt}
                  onChange={(e) => setEditingPrompt(e.target.value)}
                  disabled={!currentFrame || currentFrame.step === 0 || isProcessing}
                  className="h-28 w-full border border-white/5 bg-black/40 p-3 text-[11px] text-white/60 focus:outline-none focus:border-white/20 resize-none disabled:opacity-20 scrollbar-hide transition-colors"
                  placeholder="Triangulated logic mapping will appear here."
                />
              </div>

              {/* Command Interface */}
              <div className="col-span-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                  <div className="w-1 h-1 bg-zinc-700"></div> Command_Matrix
                </div>
                <div className="grid grid-cols-3 gap-2 h-20">
                  <button 
                    onClick={reverseTimeStep}
                    disabled={timeline.length === 0 || isProcessing}
                    className="flex flex-col items-center justify-center border border-white/5 hover:bg-white/[0.03] hover:border-white/20 transition-all disabled:opacity-5 group rounded-sm px-1"
                  >
                    <IconBackwards />
                    <span className="text-[8px] mt-2 font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white">Reverse_5S</span>
                  </button>

                  <button 
                    onClick={advanceTimeStep}
                    disabled={timeline.length === 0 || isProcessing}
                    className="flex flex-col items-center justify-center border border-white/5 hover:bg-white/[0.03] hover:border-white/20 transition-all disabled:opacity-5 group rounded-sm px-1"
                  >
                    <IconForwards />
                    <span className="text-[8px] mt-2 font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white">Advance_5S</span>
                  </button>
                  
                  <button 
                    onMouseDown={() => setShowComparison(true)}
                    onMouseUp={() => setShowComparison(false)}
                    onMouseLeave={() => setShowComparison(false)}
                    disabled={timeline.length < 2 || isProcessing}
                    className="flex flex-col items-center justify-center border border-white/5 hover:bg-white/[0.03] hover:border-white/20 transition-all disabled:opacity-5 group rounded-sm px-1"
                  >
                    <IconCompare />
                    <span className="text-[8px] mt-2 font-bold uppercase tracking-widest text-zinc-500 group-hover:text-white">Compare</span>
                  </button>
                </div>
                
                <button 
                  onClick={downloadFrame}
                  disabled={!currentFrame || isProcessing}
                  className="flex items-center justify-center gap-3 h-10 border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/30 transition-all text-white disabled:opacity-5 rounded-sm"
                >
                  <IconDownload />
                  <span className="text-[9px] font-bold uppercase tracking-[0.3em]">Export_Frame</span>
                </button>
              </div>

            </div>
          </div>
        </main>
      </div>

      {/* FOOTER */}
      <footer className="flex-shrink-0 h-8 border-t border-[#333] bg-[#0a0a0a] flex items-center justify-between px-6 text-[8px] text-zinc-700 tracking-[0.3em] uppercase z-20">
        <div className="flex gap-8">
          <span className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-800 rounded-full"></div> Bi-Directional_Flux: Active</span>
          <span className="flex items-center gap-2"><div className="w-1 h-1 bg-zinc-800 rounded-full"></div> Frame_Buffer: {timeline.length}</span>
        </div>
        <div>
          {timeline.length > 0 ? `Range: ${timeline[0].timeLabel} to ${timeline[timeline.length - 1].timeLabel}` : 'SYSTEM_IDLE'}
        </div>
      </footer>

      <style>{`
        @keyframes slide-infinite {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        .animate-slide-infinite {
          animation: slide-infinite 1.5s infinite linear;
        }
      `}</style>
    </div>
  );
};

export default App;
