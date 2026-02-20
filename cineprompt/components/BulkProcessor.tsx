
import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { hubGeminiGenerate, isEmbedMode } from '../services/geminiProxy';

export interface BulkItem {
  id: string;
  original: string;
  result?: string;
  status: 'idle' | 'analyzing' | 'processing' | 'done' | 'error';
  name: string;
  prompt: string;
}

interface BulkProcessorProps {
  items: BulkItem[];
  setItems: React.Dispatch<React.SetStateAction<BulkItem[]>>;
  onProcess: (imageSource: string, customPrompt: string) => Promise<string>;
}

export const BulkProcessor: React.FC<BulkProcessorProps> = ({ items, setItems, onProcess }) => {
  const [isProcessingAll, setIsProcessingAll] = useState(false);

  const analyzeImage = async (base64: string): Promise<string> => {
    try {
      if (isEmbedMode()) {
        const result = await hubGeminiGenerate({
          prompt: "Concise description (max 15 words) of the main subject/action.",
          imageBase64: base64,
          model: "gemini-2.0-flash-exp",
        });
        return result.text?.trim() || "Cinematic scene";
      }
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: {
          parts: [
            { inlineData: { data: base64.split(',')[1], mimeType: 'image/png' } },
            { text: "Concise description (max 15 words) of the main subject/action." }
          ]
        }
      });
      return response.text?.trim() || "Cinematic scene";
    } catch (e) {
      return "Cinematic scene";
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (!files.length) return;

    const newItems: BulkItem[] = files.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      original: '', 
      status: 'analyzing',
      name: file.name,
      prompt: ''
    }));

    setItems((prev) => [...prev, ...newItems]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        const description = await analyzeImage(base64);
        
        setItems(prev => prev.map(item => 
          item.id === newItems[i].id 
            ? { ...item, original: base64, status: 'idle', prompt: description } 
            : item
        ));
      };
      reader.readAsDataURL(file);
    }
  };

  const processSingle = async (item: BulkItem) => {
    if (item.status === 'processing' || item.status === 'analyzing') return;
    setItems((prev) => prev.map(i => i.id === item.id ? { ...i, status: 'processing' } : i));

    try {
      const result = await onProcess(item.original, item.prompt);
      setItems((prev) => prev.map(i => i.id === item.id ? { ...i, status: 'done', result } : i));
    } catch (error) {
      setItems((prev) => prev.map(i => i.id === item.id ? { ...i, status: 'error' } : i));
    }
  };

  const resetSingleItem = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, status: 'idle', result: undefined } : item));
  };

  const processAll = async () => {
    if (isProcessingAll) return;
    setIsProcessingAll(true);
    const idleItems = items.filter(i => i.status === 'idle' || i.status === 'error');
    for (const item of idleItems) {
      await processSingle(item);
    }
    setIsProcessingAll(false);
  };

  const clearAll = () => { if (confirm('CLEAR_QUEUE?')) setItems([]); };

  const downloadResult = (item: BulkItem) => {
    if (!item.result) return;
    const link = document.createElement('a');
    link.href = item.result;
    link.download = `bulk-${item.name}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <section className="space-y-12 pb-20">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h2 className="text-[12px] font-bold text-zinc-100 uppercase tracking-[0.4em]">Bulk_Production_Queue</h2>
          <p className="text-[9px] text-zinc-700 mt-2 uppercase tracking-widest font-bold">Syncing settings to batch process</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-px border border-zinc-900 bg-zinc-900">
          <label className="px-5 py-3 bg-black hover:bg-zinc-950 text-[10px] font-bold tracking-widest text-zinc-500 cursor-pointer uppercase transition-all">
            Add_Assets
            <input type="file" multiple className="hidden" accept="image/*" onChange={handleFileChange} />
          </label>
          <button onClick={clearAll} className="px-5 py-3 bg-black hover:bg-zinc-950 text-[10px] font-bold tracking-widest text-zinc-500 uppercase transition-all">
            Clear_All
          </button>
          <button
            onClick={processAll}
            disabled={isProcessingAll || items.length === 0}
            className={`px-8 py-3 text-[10px] font-bold tracking-[0.2em] transition-all uppercase ${
              isProcessingAll ? 'bg-zinc-900 text-zinc-700' : 'bg-zinc-100 text-black hover:bg-white'
            }`}
          >
            {isProcessingAll ? 'Batch_Running...' : 'Run_Production'}
          </button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="h-48 border border-zinc-900 flex items-center justify-center relative bg-zinc-950/20 group hover:border-zinc-700 transition-colors">
           <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={handleFileChange} />
           <p className="text-[9px] font-bold tracking-[0.3em] uppercase text-zinc-800 group-hover:text-zinc-600 transition-all">Click_to_Queue_Assets</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-8">
          {items.map((item) => (
            <div key={item.id} className={`bg-black border transition-all duration-300 ${item.status === 'processing' ? 'border-zinc-100' : 'border-zinc-900'}`}>
              <div className="flex h-40 border-b border-zinc-900">
                <div className="w-1/2 bg-black flex items-center justify-center overflow-hidden border-r border-zinc-900">
                  {item.original ? <img src={item.original} className="w-full h-full object-cover opacity-40" /> : <div className="text-[8px] animate-pulse">LODING...</div>}
                </div>
                <div className="w-1/2 bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {item.result ? <img src={item.result} className="w-full h-full object-cover" /> : 
                    <div className="text-[7px] font-bold text-zinc-800 uppercase tracking-widest">
                      {item.status === 'processing' ? 'Rendering' : item.status === 'analyzing' ? 'Analyzing' : 'Ready'}
                    </div>
                  }
                </div>
              </div>
              
              <div className="p-6 space-y-4">
                <textarea 
                  value={item.prompt}
                  onChange={(e) => setItems(prev => prev.map(i => i.id === item.id ? { ...i, prompt: e.target.value } : i))}
                  disabled={item.status === 'processing'}
                  className="w-full bg-black border border-zinc-900 p-4 text-[9px] text-zinc-500 font-bold h-20 resize-none outline-none focus:border-zinc-500 uppercase"
                />
                
                <div className="grid grid-cols-4 gap-px bg-zinc-900 border border-zinc-900">
                  <button onClick={() => processSingle(item)} className="p-3 bg-black hover:bg-zinc-950 text-zinc-500 hover:text-zinc-100 flex items-center justify-center transition-all">
                    RUN
                  </button>
                  <button onClick={() => resetSingleItem(item.id)} className="p-3 bg-black hover:bg-zinc-950 text-zinc-500 hover:text-zinc-100 flex items-center justify-center transition-all">
                    RST
                  </button>
                  <button onClick={() => downloadResult(item)} disabled={!item.result} className="p-3 bg-black hover:bg-zinc-950 text-zinc-500 hover:text-zinc-100 flex items-center justify-center transition-all disabled:opacity-20">
                    DL
                  </button>
                  <button onClick={() => setItems(prev => prev.filter(i => i.id !== item.id))} className="p-3 bg-black hover:bg-zinc-950 text-zinc-500 hover:text-zinc-100 flex items-center justify-center transition-all">
                    DEL
                  </button>
                </div>
                
                <div className="flex items-center justify-between pt-2">
                  <span className="text-[8px] font-bold text-zinc-700 truncate uppercase max-w-[120px]">{item.name}</span>
                  <div className="text-[8px] font-bold text-zinc-500 uppercase">{item.status}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
