
import React from 'react';

interface SidebarProps {
  prompt: string;
  setPrompt: (v: string) => void;
  onReferenceUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
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
  referenceUrl,
  onStartRender,
  onReset,
  onRandomPrompt,
  isRendering,
  jobCount
}) => {
  return (
    <div className="w-80 h-full border-r border-gray-800 flex flex-col bg-black p-6 font-mono overflow-y-auto">
      <div className="mb-12">
        <h1 className="text-2xl font-bold tracking-[0.2em] text-white">RENDER</h1>
        <div className="text-[10px] text-gray-600 mt-1 uppercase">v3.0.0-PRO-4K</div>
      </div>

      <div className="space-y-8 flex-1">
        <section>
          <div className="flex items-center justify-between mb-2">
            <label className="text-[10px] uppercase text-gray-500 block">Instruction Prompt</label>
            <button 
              onClick={onRandomPrompt}
              className="text-[9px] uppercase text-gray-600 hover:text-white transition-colors"
            >
              [RND]
            </button>
          </div>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Describe the materials, lighting, and mood..."
            className="w-full h-32 bg-black border border-gray-800 p-3 text-sm text-gray-300 focus:outline-none focus:border-gray-500 resize-none placeholder:text-gray-700"
          />
        </section>

        <section>
          <label className="text-[10px] uppercase text-gray-500 mb-2 block">Reference Image (Optional)</label>
          <div className="relative border border-dashed border-gray-800 hover:border-gray-600 transition-colors cursor-pointer group">
            <input
              type="file"
              accept="image/*"
              onChange={onReferenceUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            {referenceUrl ? (
              <img src={referenceUrl} alt="Ref" className="w-full aspect-video object-cover" />
            ) : (
              <div className="h-24 flex items-center justify-center text-[10px] text-gray-600 uppercase group-hover:text-gray-400">
                Upload reference
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="text-[10px] uppercase text-gray-500 mb-2">Parameters</div>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-400">
            <div className="p-2 border border-gray-800">RESOLUTION: 4K</div>
            <div className="p-2 border border-gray-800">MODEL: G3P</div>
            <div className="p-2 border border-gray-800">ASPECT: 16:9</div>
            <div className="p-2 border border-gray-800">SAMPLING: HIGH</div>
          </div>
        </section>
      </div>

      <div className="mt-8 space-y-3">
        <button
          onClick={onStartRender}
          disabled={isRendering || jobCount === 0}
          className={`w-full py-4 px-4 font-bold text-sm tracking-widest uppercase transition-all ${
            isRendering || jobCount === 0
              ? 'bg-gray-900 text-gray-600 cursor-not-allowed'
              : 'bg-gray-200 text-black hover:bg-white active:scale-[0.98]'
          }`}
        >
          {isRendering ? 'Processing...' : `Render Bulk (${jobCount})`}
        </button>
        
        <button
          onClick={onReset}
          className="w-full py-2 px-4 border border-gray-800 text-gray-600 hover:text-white hover:border-gray-500 transition-all text-[10px] uppercase tracking-widest"
        >
          Reset System
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
