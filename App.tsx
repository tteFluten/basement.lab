
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import { RenderJob } from './types';
import { generateRender } from './services/geminiService';
import ApiKeyOverlay from './components/ApiKeyOverlay';

const RANDOM_PROMPTS = [
  "Brutalist concrete villa, overgrown jungle vines, harsh noon shadows, 4k",
  "Cyberpunk laboratory, glowing teal tubes, dark obsidian surfaces, moody smoke",
  "Zen interior, tatami mats, paper screens, soft morning light, 8k realism",
  "Industrial loft, exposed brick, copper pipes, leather furniture, cinematic lighting",
  "Futuristic sneakers on a floating pedestal, iridescent fabric, studio lighting",
  "Scandinavian cabin, snow-covered roof, warm fireplace glow, blue hour",
  "Luxury watch, macro photography, brushed titanium, sapphire glass reflections",
  "Minimalist desert home, sandstone walls, infinity pool, sunset horizon"
];

const App: React.FC = () => {
  const [jobs, setJobs] = useState<RenderJob[]>([]);
  const [prompt, setPrompt] = useState<string>('Cinematic lighting, architectural detail, minimalist aesthetic, warm oak textures');
  const [referenceBase64, setReferenceBase64] = useState<string>();
  const [referenceUrl, setReferenceUrl] = useState<string>();
  const [isRendering, setIsRendering] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const exists = await window.aistudio.hasSelectedApiKey();
      setHasKey(exists);
    };
    checkKey();
  }, []);

  const handlePreviewUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const id = Math.random().toString(36).substr(2, 9);
        setJobs(prev => [...prev, {
          id,
          previewUrl: URL.createObjectURL(file),
          previewBase64: base64,
          status: 'pending'
        }]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setReferenceBase64(reader.result as string);
      setReferenceUrl(URL.createObjectURL(file));
    };
    reader.readAsDataURL(file);
  };

  const removeJob = (id: string) => {
    setJobs(prev => prev.filter(j => j.id !== id));
  };

  const rerenderJob = (id: string) => {
    setJobs(prev => prev.map(j => j.id === id ? { ...j, status: 'pending', resultUrl: undefined, error: undefined } : j));
  };

  const resetSystem = () => {
    setJobs([]);
    setPrompt('Cinematic lighting, architectural detail, minimalist aesthetic, warm oak textures');
    setReferenceBase64(undefined);
    setReferenceUrl(undefined);
  };

  const setRandomPrompt = () => {
    const p = RANDOM_PROMPTS[Math.floor(Math.random() * RANDOM_PROMPTS.length)];
    setPrompt(p);
  };

  const startRendering = async () => {
    if (isRendering || jobs.length === 0) return;
    setIsRendering(true);

    const pendingJobs = jobs.filter(j => j.status === 'pending');
    
    for (const job of pendingJobs) {
      setJobs(prev => prev.map(j => j.id === job.id ? { ...j, status: 'rendering' } : j));
      
      try {
        const result = await generateRender(job.previewBase64, prompt, referenceBase64);
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          status: 'completed', 
          resultUrl: result 
        } : j));
      } catch (err: any) {
        console.error("Render failed", err);
        if (err.message === "API_KEY_ERROR") {
          setHasKey(false);
          setIsRendering(false);
          return;
        }
        setJobs(prev => prev.map(j => j.id === job.id ? { 
          ...j, 
          status: 'failed', 
          error: err.message || "Engine error" 
        } : j));
      }
    }

    setIsRendering(false);
  };

  const clearQueue = () => {
    setJobs([]);
  };

  const downloadImage = (url: string, id: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = `render_${id}_4k.png`;
    link.click();
  };

  if (hasKey === false) {
    return <ApiKeyOverlay onSuccess={() => setHasKey(true)} />;
  }

  return (
    <div className="flex h-screen bg-black overflow-hidden select-none">
      <Sidebar
        prompt={prompt}
        setPrompt={setPrompt}
        onReferenceUpload={handleReferenceUpload}
        referenceUrl={referenceUrl}
        onStartRender={startRendering}
        onReset={resetSystem}
        onRandomPrompt={setRandomPrompt}
        isRendering={isRendering}
        jobCount={jobs.filter(j => j.status === 'pending').length}
      />

      <main className="flex-1 flex flex-col h-full bg-[#050505]">
        <div className="h-14 border-bottom border-gray-900 flex items-center justify-between px-6 border-b border-gray-800">
          <div className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">
            Queue: {jobs.length} items / Rendering: {jobs.filter(j => j.status === 'rendering').length}
          </div>
          <button 
            onClick={clearQueue}
            className="text-[10px] text-gray-500 hover:text-white uppercase transition-colors font-mono"
          >
            Clear All
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-20">
          <div className="relative aspect-video border border-dashed border-gray-800 flex items-center justify-center hover:border-gray-600 transition-colors group cursor-pointer overflow-hidden">
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={handlePreviewUpload}
              className="absolute inset-0 opacity-0 cursor-pointer z-10"
            />
            <div className="text-center font-mono">
              <div className="text-2xl text-gray-700 group-hover:text-gray-400 mb-2">+</div>
              <div className="text-[10px] text-gray-600 uppercase tracking-widest group-hover:text-gray-400">Import Viewport Previews</div>
            </div>
          </div>

          {jobs.map((job) => (
            <div key={job.id} className="group relative aspect-video border border-gray-800 bg-black overflow-hidden flex flex-col">
              <div className="flex-1 relative bg-gray-950">
                <img 
                  src={job.status === 'completed' ? job.resultUrl : job.previewUrl} 
                  alt="Job" 
                  className={`w-full h-full object-cover transition-opacity duration-700 ${job.status === 'rendering' ? 'opacity-30 grayscale animate-pulse' : 'opacity-100'}`}
                />
                
                {job.status === 'rendering' && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest animate-pulse font-mono">
                      Computing 4K...
                    </div>
                  </div>
                )}

                {job.status === 'failed' && (
                  <div className="absolute inset-0 bg-red-950/20 flex items-center justify-center p-4">
                    <div className="text-[10px] text-red-400 uppercase text-center font-mono leading-relaxed">
                      Engine failure<br/>{job.error}
                    </div>
                  </div>
                )}

                {job.status === 'completed' && job.resultUrl && (
                   <button 
                    onClick={() => downloadImage(job.resultUrl!, job.id)}
                    className="absolute bottom-4 right-4 bg-white text-black text-[10px] px-3 py-2 font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Download 4K
                  </button>
                )}
              </div>
              
              <div className="h-10 border-t border-gray-800 flex items-center justify-between px-3 text-[9px] uppercase tracking-tighter font-mono">
                <div className="flex items-center space-x-3">
                  <span className="text-gray-600">ID_{job.id}</span>
                  <span className={
                    job.status === 'completed' ? 'text-green-500' : 
                    job.status === 'rendering' ? 'text-blue-500' : 
                    job.status === 'failed' ? 'text-red-500' : 'text-gray-700'
                  }>
                    {job.status}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  {(job.status === 'completed' || job.status === 'failed') && (
                    <button 
                      onClick={() => rerenderJob(job.id)}
                      className="text-gray-500 hover:text-white transition-colors"
                      title="Re-run Render"
                    >
                      [RE_RUN]
                    </button>
                  )}
                  <button 
                    onClick={() => removeJob(job.id)}
                    className="text-gray-500 hover:text-red-500 transition-colors"
                    title="Delete Image"
                  >
                    [DEL]
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default App;
