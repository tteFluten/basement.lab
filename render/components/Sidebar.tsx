
import React from 'react';

interface SidebarProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onReferenceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onReferenceClick?: () => void;
  referenceUrl?: string;
  onStartRender: () => void;
  onReset: () => void;
  onRandomPrompt: () => void;
  isRendering: boolean;
  jobCount: number;
}

const Sidebar: React.FC<SidebarProps> = ({
  prompt,
  setPrompt,
  onReferenceUpload,
  onReferenceClick,
  referenceUrl,
  onStartRender,
  onReset,
  onRandomPrompt,
  isRendering,
  jobCount
}) => {
  const handleRefAreaClick = () => {
    if (onReferenceClick) onReferenceClick();
  };
  return (
    <div className="w-80 h-full border-r border-[#333] flex flex-col bg-[#0a0a0a] p-6 font-mono overflow-y-auto">
      <div className="mb-12">
        <h1 className="text-2xl font-bold tracking-[0.2em] text-white">RENDER</h1>
        <div className="text-[10px] text-zinc-600 mt-1 uppercase">v3.0.0-PRO-4K</div>
      </div>

      <div className="space-y-8 flex-1">
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase text-zinc-500 block">Instruction Prompt</label>
            <button 
              onClick={onRandomPrompt}
              className="text-[9px] uppercase text-zinc-600 hover:text-white transition-colors"
            >
              [RND]
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the materials, lighting, and mood..."
            className="w-full h-32 bg-[#111] border border-[#333] p-3 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500 resize-none placeholder:text-zinc-600"
          />
        </section>

        <section>
          <label className="text-[10px] uppercase text-zinc-500 mb-2 block">Reference Image (Optional)</label>
          <div 
            className="relative border border-dashed border-[#333] hover:border-zinc-500 transition-colors cursor-pointer group"
            onClick={onReferenceClick ? (e) => { e.preventDefault(); handleRefAreaClick(); } : undefined}
          >
            <input
              type="file"
              accept="image/*"
              onChange={onReferenceUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {referenceUrl ? (
              <img src={referenceUrl} alt="Ref" className="w-full aspect-video object-cover" />
            ) : (
              <div className="h-24 flex items-center justify-center text-[10px] text-zinc-600 uppercase group-hover:text-zinc-400">
                {onReferenceClick ? 'Upload or from history' : 'Upload reference'}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="text-[10px] uppercase text-zinc-500 mb-2">Parameters</div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-400">
            <div className="p-2 border border-[#333]">RESOLUTION: 4K</div>
            <div className="p-2 border border-[#333]">MODEL: G3P</div>
            <div className="p-2 border border-[#333]">ASPECT: 16:9</div>
            <div className="p-2 border border-[#333]">SAMPLING: HIGH</div>
          </div>
        </section>
      </div>

      <div className="mt-8 space-y-3">
        <button
          onClick={onStartRender}
          disabled={isRendering || jobCount === 0}
          className={`w-full py-4 px-4 font-bold text-sm tracking-widest uppercase transition-all ${
            isRendering || jobCount === 0
              ? 'bg-[#333] text-zinc-600 cursor-not-allowed'
              : 'bg-zinc-100 text-black hover:bg-white active:scale-[0.98]'
          }`}
        >
          {isRendering ? 'Processing...' : `Render Bulk (${jobCount})`}
        </button>
        
        <button
          onClick={onReset}
          className="w-full py-2 px-4 border border-[#333] text-zinc-600 hover:text-white hover:border-zinc-500 transition-all text-[10px] uppercase tracking-widest"
        >
          Reset System
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
