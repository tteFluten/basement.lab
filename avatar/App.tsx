import React, { useState, useRef } from 'react';
import {
  Plus,
  Image as ImageIcon,
  Trash2,
  Settings2,
  Download,
  CheckCircle,
  AlertCircle,
  Loader2,
  Zap,
  Layers,
  Layout,
  RotateCcw,
  Fingerprint,
  Lock,
  XCircle,
  ShieldCheck,
  Terminal
} from 'lucide-react';
import { ImageFile, StylingOptions, ProcessingState, AspectRatio, QualityLevel } from './types';
import { transformImage, analyzeReferenceStyle } from './services/geminiService';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';

function dataUrlToFile(dataUrl: string, name = 'reference.png'): File {
  const [header, base64] = dataUrl.split(',');
  const mime = (header.match(/data:(.*);base64/) || [])[1] || 'image/png';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], name, { type: mime });
}

function urlToDataUrl(url: string): Promise<string> {
  if (url.startsWith('data:')) return Promise.resolve(url);
  return fetch(url).then(r => r.blob()).then(blob => new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(blob);
  }));
}

const App: React.FC = () => {
  const [sourceImages, setSourceImages] = useState<ImageFile[]>([]);
  const [referenceImage, setReferenceImage] = useState<ImageFile | null>(null);
  const [styleManifest, setStyleManifest] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('CONSERVAR IDENTIDAD FACIAL // APLICAR ESTÉTICA MASTER');
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('1:1');
  const [quality, setQuality] = useState<QualityLevel>('high');
  
  const [options, setOptions] = useState<StylingOptions>({
    matchClothingStyle: true,
    matchPose: true,
    matchLighting: true,
    matchColorPalette: true,
    matchBackground: true,
    matchGraphicDetails: true,
  });

  const [processing, setProcessing] = useState<ProcessingState>({
    isProcessing: false,
    currentIndex: 0,
    total: 0,
  });

  const sourceInputRef = useRef<HTMLInputElement>(null);
  const referenceInputRef = useRef<HTMLInputElement>(null);

  const handleSourceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files) as File[];
    const newImages: ImageFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
    }));
    setSourceImages(prev => [...prev, ...newImages]);
    e.target.value = '';
  };

  const applyReference = (file: File, preview: string) => {
    setReferenceImage({
      id: 'ref',
      file,
      preview,
      status: 'completed',
    });
    setStyleManifest(null);
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0]) return;
    const file = e.target.files[0];
    applyReference(file, URL.createObjectURL(file));
    e.target.value = '';
  };

  const handleReferenceClick = () => {
    if (isHubEnv()) {
      openReferencePicker()
        .then(dataUrl => applyReference(dataUrlToFile(dataUrl), dataUrl))
        .catch(() => {});
    } else {
      referenceInputRef.current?.click();
    }
  };

  const startProcessing = async () => {
    if (!referenceImage || sourceImages.length === 0) return;
    const pendingImages = sourceImages.filter(img => img.status === 'pending' || img.status === 'error');
    if (pendingImages.length === 0) return;

    setProcessing({ isProcessing: true, currentIndex: 0, total: pendingImages.length });

    try {
      let currentManifest = styleManifest;
      if (!currentManifest) {
        currentManifest = await analyzeReferenceStyle(referenceImage.file);
        setStyleManifest(currentManifest);
      }

      for (let i = 0; i < pendingImages.length; i++) {
        const current = pendingImages[i];
        setProcessing(prev => ({ ...prev, currentIndex: i }));
        setSourceImages(prev => prev.map(img => 
          img.id === current.id ? { ...img, status: 'processing', error: undefined } : img
        ));

        try {
          const result = await transformImage(
            current.file, 
            referenceImage.file, 
            currentManifest,
            prompt, 
            options,
            aspectRatio,
            quality
          );
          setSourceImages(prev => prev.map(img => 
            img.id === current.id ? { ...img, status: 'completed', resultUrl: result } : img
          ));
        } catch (err: any) {
          setSourceImages(prev => prev.map(img => 
            img.id === current.id ? { ...img, status: 'error', error: err.message || 'ENGINE_FAIL' } : img
          ));
        }
      }
    } catch (err: any) {
      alert("FATAL_ERROR: " + err.message);
    } finally {
      setProcessing(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const downloadAll = async () => {
    const withResult = sourceImages.filter((img): img is ImageFile & { resultUrl: string } => !!img.resultUrl);
    if (isHubEnv()) {
      for (let idx = 0; idx < withResult.length; idx++) {
        const img = withResult[idx];
        try {
          const dataUrl = await urlToDataUrl(img.resultUrl);
          await openDownloadAction(dataUrl, 'avatar');
        } catch {
          const link = document.createElement('a');
          link.href = img.resultUrl;
          link.download = `AVATAR_${idx + 1}.PNG`;
          link.click();
        }
      }
    } else {
      withResult.forEach((img, idx) => {
        const link = document.createElement('a');
        link.href = img.resultUrl;
        link.download = `AVATAR_${idx + 1}.PNG`;
        link.click();
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-400 flex flex-col tracking-tighter text-xs">
      {/* HEADER */}
      <header className="border-b border-[#333] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Terminal size={18} className="text-white" />
          <h1 className="text-lg font-bold text-white tracking-widest">AVATARFLOW // B_02</h1>
        </div>

        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2 border border-[#333] px-3 py-1">
            <ShieldCheck size={12} className={processing.isProcessing ? "text-amber-500" : "text-zinc-500"} />
            <span className="font-bold">{processing.isProcessing ? 'LOCKED' : 'READY'}</span>
          </div>

          <button 
            onClick={startProcessing}
            disabled={processing.isProcessing || !referenceImage || sourceImages.length === 0}
            className={`px-6 py-2 font-bold transition-all ${
              processing.isProcessing || !referenceImage || sourceImages.length === 0
                ? 'bg-[#333] text-zinc-700 cursor-not-allowed'
                : 'bg-zinc-100 text-black hover:bg-[#111] hover:text-white hover:border-[#333] active:scale-95 border border-[#333]'
            }`}
          >
            {processing.isProcessing ? 'EXECUTING...' : 'RUN_BULK'}
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1800px] mx-auto w-full">
        {/* SIDEBAR */}
        <div className={`lg:col-span-3 space-y-6 transition-opacity ${processing.isProcessing ? 'opacity-20 pointer-events-none' : ''}`}>
          <section className="border border-[#333] p-4 space-y-4">
            <div className="flex items-center justify-between border-b border-[#333] pb-2">
              <span className="font-bold text-zinc-100">MASTER_REF</span>
              <Layout size={14} />
            </div>
            <div 
              onClick={() => !processing.isProcessing && handleReferenceClick()}
              className={`relative border border-[#333] aspect-square flex flex-col items-center justify-center cursor-pointer hover:bg-[#1a1a1a] transition-colors ${
                referenceImage ? 'border-zinc-500' : ''
              }`}
            >
              {referenceImage ? (
                <img src={referenceImage.preview} className="w-full h-full object-cover grayscale opacity-80" alt="Master" />
              ) : (
                <Plus size={24} className="text-zinc-600" />
              )}
              <input type="file" ref={referenceInputRef} onChange={handleReferenceUpload} className="hidden" accept="image/*" />
            </div>
            {styleManifest && (
              <div className="bg-[#181818] p-2 border border-[#333]">
                <p className="text-[9px] text-zinc-500 leading-none">DNA_MANIFEST:</p>
                <p className="text-[9px] mt-1 italic">{styleManifest}</p>
              </div>
            )}
          </section>

          <section className="border border-[#333] p-4 space-y-6">
            <div className="flex items-center justify-between border-b border-[#333] pb-2">
              <span className="font-bold text-zinc-100">CONFIGURATION</span>
              <Settings2 size={14} />
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-zinc-600 block mb-1">ASPECT_RATIO</label>
                <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)} className="w-full bg-[#111] border border-[#333] p-2 outline-none focus:border-zinc-500">
                  <option value="1:1">1:1 SQ</option>
                  <option value="4:3">4:3 PT</option>
                  <option value="16:9">16:9 LS</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-600 block mb-1">ENGINE_RES</label>
                <select value={quality} onChange={(e) => setQuality(e.target.value as QualityLevel)} className="w-full bg-[#111] border border-[#333] p-2 outline-none focus:border-zinc-500">
                  <option value="high">PRO_4K</option>
                  <option value="standard">STD_HD</option>
                </select>
              </div>
              <div>
                <label className="text-[9px] font-bold text-zinc-600 block mb-1">GLOBAL_PROMPT</label>
                <textarea 
                  value={prompt} onChange={(e) => setPrompt(e.target.value)}
                  className="w-full h-20 bg-[#111] border border-[#333] p-2 outline-none focus:border-zinc-500 resize-none"
                />
              </div>

              <div className="space-y-2 pt-2">
                <label className="text-[9px] font-bold text-zinc-600 block mb-2">ANCHOR_SYSTEM</label>
                {[
                  { key: 'matchClothingStyle', label: 'CLOTHING_STYLE' },
                  { key: 'matchPose', label: 'MASTER_POSE' },
                  { key: 'matchLighting', label: 'MASTER_LIGHT' },
                  { key: 'matchColorPalette', label: 'COLOR_PALETTE' },
                  { key: 'matchBackground', label: 'MASTER_BG' },
                  { key: 'matchGraphicDetails', label: 'GRAPHIC_DEETS' },
                ].map((item) => (
                  <label key={item.key} className="flex items-center justify-between group cursor-pointer">
                    <span className="text-[10px] group-hover:text-white transition-colors">{item.label}</span>
                    <input 
                      type="checkbox" 
                      className="appearance-none w-3 h-3 border border-zinc-700 checked:bg-white transition-all cursor-pointer" 
                      checked={(options as any)[item.key]} 
                      onChange={(e) => setOptions(prev => ({ ...prev, [item.key]: e.target.checked }))} 
                    />
                  </label>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* WORKSPACE */}
        <div className="lg:col-span-9 flex flex-col relative">
          <div className="border border-[#333] flex-1 flex flex-col bg-[#111] overflow-hidden relative">
            
            {/* BUSY OVERLAY */}
            {processing.isProcessing && (
              <div className="absolute inset-0 z-50 bg-[#111]/95 flex flex-col items-center justify-center p-10 border border-[#333]">
                <div className="max-w-md w-full border border-[#333] p-8 flex flex-col items-center">
                  <Loader2 className="animate-spin text-white mb-6" size={32} />
                  <p className="text-white font-bold tracking-[0.4em] mb-4">SYSTEM_BUSY</p>
                  <p className="text-[10px] text-zinc-500 mb-8">PROCESSING_LANE: {processing.currentIndex + 1} // {processing.total}</p>
                  <div className="w-full bg-[#333] h-1 overflow-hidden">
                    <div 
                      className="h-full bg-white transition-all duration-300" 
                      style={{ width: `${((processing.currentIndex + 1) / processing.total) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="px-6 py-4 border-b border-[#333] flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Layers size={16} />
                <span className="font-bold text-zinc-100">PRODUCTION_QUEUE</span>
                <span className="text-[9px] bg-[#333] text-zinc-400 px-2 border border-[#333]">[{sourceImages.length}]</span>
              </div>
              
              <div className={`flex items-center space-x-3 transition-opacity ${processing.isProcessing ? 'opacity-0' : ''}`}>
                <button onClick={() => setSourceImages([])} className="hover:text-white p-1" title="PURGE">
                  <Trash2 size={16} />
                </button>
                <button onClick={downloadAll} className="hover:text-white p-1" title="EXPORT_ALL">
                  <Download size={16} />
                </button>
                <button 
                  onClick={() => sourceInputRef.current?.click()} 
                  className="border border-[#333] px-4 py-1 hover:bg-[#333] text-white font-bold"
                >
                  IMPORT_BULK
                </button>
                <input type="file" multiple ref={sourceInputRef} onChange={handleSourceUpload} className="hidden" accept="image/*" />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
              {sourceImages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20 grayscale">
                  <ImageIcon size={40} className="mb-4" />
                  <p className="text-[10px] font-bold tracking-widest">AWAITING_INPUT_STREAM</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4">
                  {sourceImages.map((img, idx) => (
                    <div key={img.id} className={`group relative border border-[#333] aspect-[3/4] transition-all duration-300 ${
                      img.status === 'processing' ? 'border-white opacity-50' : 
                      img.status === 'error' ? 'border-red-900' : 'hover:border-zinc-500'
                    }`}>
                      <img 
                        src={img.resultUrl || img.preview} 
                        className={`w-full h-full object-cover grayscale transition-all group-hover:grayscale-0`} 
                        alt="Avatar" 
                      />
                      
                      <div className="absolute bottom-0 left-0 right-0 p-2 bg-[#111]/90 border-t border-[#333]">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-bold text-zinc-500">I_{idx + 1}</span>
                          {img.status === 'completed' && <span className="text-[8px] text-white">DONE</span>}
                        </div>
                      </div>

                      {img.status === 'processing' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-[#111]/60">
                          <Loader2 className="animate-spin text-white" size={20} />
                        </div>
                      )}

                      {img.status === 'error' && (
                        <div className="absolute inset-0 bg-red-950/90 flex flex-col items-center justify-center p-4 text-center">
                          <XCircle size={16} className="text-white mb-2" />
                          <p className="text-[8px] font-bold text-white uppercase">{img.error || 'FAIL'}</p>
                        </div>
                      )}

                      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center bg-[#111]/80 transition-opacity">
                        <button onClick={() => setSourceImages(prev => prev.filter(i => i.id !== img.id))} className="p-2 bg-[#333] hover:bg-red-900 text-white">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {processing.isProcessing && (
              <div className="bg-[#333] h-0.5 w-full relative">
                <div 
                  className="absolute inset-y-0 left-0 bg-white transition-all duration-500" 
                  style={{ width: `${((processing.currentIndex + 1) / processing.total) * 100}%` }} 
                />
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#333] px-6 py-2 flex justify-between items-center text-[9px] text-zinc-600 font-bold">
        <span>DEVICE: GEMINI_AI_SESSION // 001</span>
        <span>STATUS: SYSTEM_OPTIMIZED</span>
      </footer>
    </div>
  );
};

export default App;
