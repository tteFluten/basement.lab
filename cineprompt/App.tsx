
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";
import { PromptConfig, Engine } from './types';
import { CAMERA_TYPES, LENSES, MOVEMENTS, LIGHTING, ENGINES, STILL_STYLES } from './constants';
import { OptionGrid } from './components/OptionGrid';
import { OutputJSON } from './components/OutputJSON';
import { BulkProcessor, BulkItem } from './components/BulkProcessor';
import { isHubEnv, openReferencePicker, openDownloadAction } from './lib/hubBridge';

const App: React.FC = () => {
  const [config, setConfig] = useState<PromptConfig>({
    actionDescription: '',
    mode: 'text_only',
    engine: 'veo',
    cameraType: CAMERA_TYPES[0].id,
    movement: MOVEMENTS[0].id,
    lens: LENSES[0].id,
    lighting: LIGHTING[0].id,
    style: 'photorealistic cinematic film',
    stillStyle: STILL_STYLES[0].id,
    styleWeight: 75,
    aspectRatio: '16:9',
    resolution: '1080p'
  });

  const [generatedStill, setGeneratedStill] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState(false);
  const [isGeneratingStill, setIsGeneratingStill] = useState(false);
  const [bulkItems, setBulkItems] = useState<BulkItem[]>([]);
  
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (generatedStill && previewRef.current) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [generatedStill]);

  const getWeightDescription = (weight: number) => {
    if (weight < 30) return "LOW EMPHASIS";
    if (weight < 65) return "BALANCED";
    if (weight < 90) return "AGGRESSIVE";
    return "TOTAL FOCUS";
  };

  const ensureApiKey = async () => {
    const aiStudio = (window as any).aistudio;
    if (aiStudio) {
      try {
        if (typeof aiStudio.hasSelectedApiKey === 'function') {
          const hasKey = await aiStudio.hasSelectedApiKey();
          if (!hasKey && typeof aiStudio.openSelectKey === 'function') {
            await aiStudio.openSelectKey();
          }
        }
      } catch (e) {
        console.warn("AI Studio key check failed", e);
      }
    }
  };

  const handleDownloadPreview = async () => {
    if (!generatedStill) return;
    if (isHubEnv()) {
      try {
        await openDownloadAction(generatedStill, 'cineprompt');
      } catch {
        const link = document.createElement('a');
        link.href = generatedStill;
        link.download = `cinepreview-${Date.now()}.png`;
        link.click();
      }
    } else {
      const link = document.createElement('a');
      link.href = generatedStill;
      link.download = `cinepreview-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleStartAssetClick = () => {
    if (isHubEnv()) {
      openReferencePicker()
        .then((dataUrl) => setConfig((prev) => ({ ...prev, startImage: dataUrl })))
        .catch(() => {});
    } else {
      document.getElementById('start-asset-input')?.click();
    }
  };

  const handleImprovePrompt = async () => {
    if (!config.actionDescription.trim() && !config.startImage) return;
    if (isImproving) return;

    setIsImproving(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const artStyle = STILL_STYLES.find(s => s.id === config.stillStyle);
      const movement = MOVEMENTS.find(m => m.id === config.movement);
      const lens = LENSES.find(l => l.id === config.lens);
      const lighting = LIGHTING.find(l => l.id === config.lighting);

      const systemPrompt = `Act as an elite Visual Stylist. Rewrite this scene. Style: ${artStyle?.technicalTerm}. Intensity: ${config.styleWeight}%. Tech: ${movement?.technicalTerm}, ${lens?.technicalTerm}, ${lighting?.technicalTerm}. Max 70 words. Narrative paragraph.`;

      const contents = config.startImage 
        ? { parts: [{ inlineData: { data: config.startImage.split(',')[1], mimeType: 'image/png' } }, { text: `${systemPrompt} Context: ${config.actionDescription || 'Cinematic scene'}` }] }
        : { parts: [{ text: `${systemPrompt} Input: ${config.actionDescription}` }] };

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
      });

      if (response.text) {
        setConfig(prev => ({ ...prev, actionDescription: response.text.trim() }));
      }
    } catch (error) {
      console.error("AI Stylist failed:", error);
    } finally {
      setIsImproving(false);
    }
  };

  const transformImage = useCallback(async (imageSource: string, customPrompt?: string) => {
    await ensureApiKey();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const artStyle = STILL_STYLES.find(s => s.id === config.stillStyle);
    
    // Map resolution to API imageSize
    const imageSize = config.resolution === '4K' ? "4K" : "1K";

    const parts: any[] = [
      { inlineData: { data: imageSource.split(',')[1], mimeType: 'image/png' } },
      { text: `Apply style: ${artStyle?.technicalTerm} at ${config.styleWeight}% intensity. Subject: ${customPrompt || config.actionDescription}` }
    ];
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: { imageConfig: { aspectRatio: (config.aspectRatio as any), imageSize } }
    });
    
    const imagePart = response.candidates?.[0]?.content?.parts.find(p => !!p.inlineData);
    if (imagePart?.inlineData) return `data:image/png;base64,${imagePart.inlineData.data}`;
    throw new Error("No image generated");
  }, [config]);

  const handleGenerateStill = async () => {
    if (!config.actionDescription.trim() && !config.startImage) return;
    if (isGeneratingStill) return;
    
    setIsGeneratingStill(true);
    setGeneratedStill(null);
    
    try {
      await ensureApiKey();
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const artStyle = STILL_STYLES.find(s => s.id === config.stillStyle);
      const lens = LENSES.find(l => l.id === config.lens);
      const lighting = LIGHTING.find(l => l.id === config.lighting);
      
      // Map resolution to API imageSize
      const imageSize = config.resolution === '4K' ? "4K" : "1K";

      let response;
      if (config.startImage) {
        const parts = [
          { inlineData: { data: config.startImage.split(',')[1], mimeType: 'image/png' } },
          { text: `Apply ${artStyle?.technicalTerm} style at ${config.styleWeight}% intensity. Lens: ${lens?.technicalTerm}. Lighting: ${lighting?.technicalTerm}. Context: ${config.actionDescription}` }
        ];
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts },
          config: { imageConfig: { aspectRatio: (config.aspectRatio as any), imageSize } }
        });
      } else {
        const prompt = `STYLE: ${artStyle?.technicalTerm}. LENS: ${lens?.technicalTerm}. LIGHTING: ${lighting?.technicalTerm}. INTENSITY: ${config.styleWeight}%. SUBJECT: ${config.actionDescription}. Ultra-high fidelity visual.`;
        response = await ai.models.generateContent({
          model: 'gemini-3-pro-image-preview',
          contents: { parts: [{ text: prompt }] },
          config: { imageConfig: { aspectRatio: (config.aspectRatio as any), imageSize } }
        });
      }
      
      const imagePart = response.candidates?.[0]?.content?.parts.find(p => !!p.inlineData);
      if (imagePart?.inlineData) {
        setGeneratedStill(`data:image/png;base64,${imagePart.inlineData.data}`);
      }
    } catch (error: any) {
      console.error("Preview generation failed:", error);
      if (error?.message?.includes("Requested entity was not found")) {
        const aiStudio = (window as any).aistudio;
        if (aiStudio && typeof aiStudio.openSelectKey === 'function') await aiStudio.openSelectKey();
      }
    } finally {
      setIsGeneratingStill(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'start' | 'end') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setConfig(prev => ({ ...prev, [type === 'start' ? 'startImage' : 'endImage']: base64 }));
      };
      reader.readAsDataURL(file);
    }
  };

  const generatedJSON = useMemo(() => {
    const artStyle = STILL_STYLES.find(s => s.id === config.stillStyle);
    const camera = CAMERA_TYPES.find(c => c.id === config.cameraType);
    const movement = MOVEMENTS.find(m => m.id === config.movement);
    const lens = LENSES.find(l => l.id === config.lens);
    const lighting = LIGHTING.find(l => l.id === config.lighting);

    return {
      target_engine: config.engine,
      payload: {
        prompt: config.actionDescription,
        style_config: {
          style: artStyle?.technicalTerm,
          intensity: config.styleWeight / 100
        },
        camera: {
          body: camera?.technicalTerm,
          lens: lens?.technicalTerm,
          movement: movement?.technicalTerm,
          light: lighting?.technicalTerm
        },
        aspect_ratio: config.aspectRatio
      }
    };
  }, [config]);

  return (
    <div className="min-h-screen bg-[#111] text-zinc-400 font-mono">
      <header className="sticky top-0 z-50 bg-[#111] border-b border-[#333] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-bold text-zinc-100 tracking-[0.2em] uppercase">CinePrompt_Terminal</h1>
          </div>
          <div className="flex items-center gap-px bg-zinc-900 border border-zinc-800">
            {ENGINES.map((eng) => (
              <button
                key={eng.id}
                onClick={() => setConfig({ ...config, engine: eng.id as Engine })}
                className={`px-4 py-2 text-[10px] uppercase font-bold transition-all ${
                  config.engine === eng.id ? 'bg-zinc-100 text-black' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {eng.id}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-12 grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-16">
          <section className="space-y-6">
            <div className="flex items-center justify-between border-b border-[#333] pb-2">
              <h2 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">01_Narrative</h2>
              <div className="flex gap-2">
                <button
                  onClick={handleImprovePrompt}
                  className="px-4 py-2 text-[9px] font-bold bg-zinc-900 border border-zinc-800 text-zinc-400 hover:border-zinc-100 hover:text-zinc-100 transition-all"
                >
                  {isImproving ? '> ANALYZING...' : '> AI_REWRITE'}
                </button>
                <button
                  onClick={handleGenerateStill}
                  disabled={isGeneratingStill}
                  className={`px-4 py-2 text-[9px] font-bold transition-all border ${
                    isGeneratingStill ? 'bg-zinc-900 border-zinc-800 text-zinc-600' : 'bg-zinc-100 border-zinc-100 text-black hover:bg-white'
                  }`}
                >
                  {isGeneratingStill ? '> RENDERING...' : '> GENERATE_PREVIEW'}
                </button>
              </div>
            </div>
            <textarea
              value={config.actionDescription}
              onChange={(e) => setConfig({ ...config, actionDescription: e.target.value })}
              placeholder="Input scene description..."
              className="w-full h-32 bg-[#111] border border-[#333] p-6 text-zinc-100 focus:outline-none focus:border-zinc-100 transition-all resize-none"
            />
          </section>

          <section className="space-y-12">
            <OptionGrid 
              title="02_Aesthetic_Medium" 
              options={STILL_STYLES} 
              selectedId={config.stillStyle} 
              onSelect={(id) => setConfig({ ...config, stillStyle: id })} 
              showImages={false}
              variant="horizontal"
            />
            
            <div className="border border-[#333] p-8 space-y-6 bg-[#181818]">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Style_Weight</h3>
                <div className="text-sm font-bold text-zinc-100">{config.styleWeight}%</div>
              </div>
              <input 
                type="range" 
                min="0" 
                max="100" 
                value={config.styleWeight}
                onChange={(e) => setConfig(prev => ({ ...prev, styleWeight: parseInt(e.target.value) }))}
                className="w-full h-1 bg-zinc-900 appearance-none cursor-pointer accent-zinc-100"
              />
              <p className="text-[9px] text-zinc-600 uppercase font-bold tracking-widest">{getWeightDescription(config.styleWeight)}</p>
            </div>
          </section>

          {generatedStill && (
            <div ref={previewRef} className="relative group border border-[#333] aspect-video bg-[#111]">
              <img src={generatedStill} alt="Preview" className="w-full h-full object-cover opacity-80" />
              <div className="absolute inset-0 bg-[#111]/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                 <button 
                  onClick={handleDownloadPreview}
                  className="px-8 py-3 bg-zinc-100 text-black font-bold text-[10px] uppercase tracking-widest"
                 >
                   Download_Image
                 </button>
              </div>
              <div className="absolute top-4 left-4 bg-[#111]/60 border border-zinc-800 px-3 py-1 text-[8px] font-bold text-zinc-400 uppercase">Preview_Output</div>
            </div>
          )}

          <section className="space-y-16">
            <OptionGrid 
              title="03_Movement" 
              options={MOVEMENTS} 
              selectedId={config.movement} 
              onSelect={(id) => setConfig({ ...config, movement: id })} 
              showImages={false}
              variant="horizontal"
            />
            <OptionGrid 
              title="04_Optics" 
              options={LENSES} 
              selectedId={config.lens} 
              onSelect={(id) => setConfig({ ...config, lens: id })} 
              showImages={false}
              variant="horizontal"
            />
            <OptionGrid 
              title="05_Lighting" 
              options={LIGHTING} 
              selectedId={config.lighting} 
              onSelect={(id) => setConfig({ ...config, lighting: id })} 
              showImages={false}
              variant="horizontal"
            />
          </section>

          <OptionGrid 
            title="06_Camera_Body" 
            options={CAMERA_TYPES} 
            selectedId={config.cameraType} 
            onSelect={(id) => setConfig({ ...config, cameraType: id })} 
            showImages={false}
            variant="grid"
          />
        </div>

        <div className="lg:col-span-4 lg:sticky lg:top-28 self-start space-y-12">
          <section className="bg-[#181818] border border-[#333] p-8 space-y-10">
            <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">Config_Output</h3>
            
            <div className="space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-3">
                  <label className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest block">Aspect_Ratio</label>
                  <select 
                    value={config.aspectRatio}
                    onChange={(e) => setConfig({ ...config, aspectRatio: e.target.value })}
                    className="w-full bg-[#111] border border-[#333] p-4 text-[11px] font-bold text-zinc-100 outline-none focus:border-zinc-100"
                  >
                    <option value="16:9">16:9_WIDE</option>
                    <option value="9:16">9:16_PORTRAIT</option>
                    <option value="1:1">1:1_SQUARE</option>
                    <option value="4:3">4:3_STNDRD</option>
                    <option value="3:4">3:4_TALL</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest block">Resolution</label>
                  <select 
                    value={config.resolution}
                    onChange={(e) => setConfig({ ...config, resolution: e.target.value })}
                    className="w-full bg-[#111] border border-[#333] p-4 text-[11px] font-bold text-zinc-100 outline-none focus:border-zinc-100"
                  >
                    <option value="1080p">1080P_HD (1K)</option>
                    <option value="4K">4K_UHD (4K)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[9px] text-zinc-600 font-bold uppercase tracking-widest block">Start_Asset_I2V</label>
                <div className="relative group p-4 border border-[#333] border-dashed hover:border-zinc-100 cursor-pointer transition-colors bg-[#111]" onClick={handleStartAssetClick}>
                  <input id="start-asset-input" type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*" onChange={(e) => handleFileChange(e, 'start')} />
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#111] border border-[#333] overflow-hidden flex items-center justify-center">
                      {config.startImage ? <img src={config.startImage} className="w-full h-full object-cover" alt="" /> : <div className="text-zinc-600 text-xs">+</div>}
                    </div>
                    <div className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                      {config.startImage ? 'Change_Img' : (isHubEnv() ? 'Upload_Or_From_History' : 'Load_Asset')}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-[#333]">
              <button 
                onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })}
                className="w-full py-5 bg-zinc-100 text-black font-bold text-[10px] tracking-[0.2em] uppercase hover:bg-white transition-all"
              >
                COMPILE_JSON_OUTPUT
              </button>
              
              {generatedStill && (
                <button 
                  onClick={handleDownloadPreview}
                  className="w-full py-4 border border-zinc-800 text-zinc-400 font-bold text-[9px] tracking-[0.2em] uppercase hover:border-zinc-100 hover:text-zinc-100 transition-all flex items-center justify-center gap-3"
                >
                  Download_Preview
                </button>
              )}
            </div>
          </section>
        </div>
      </main>

      <div className="max-w-7xl mx-auto px-6 mt-32 space-y-40 pb-40">
        <div className="relative">
          <div className="mb-6">
             <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.4em]">Structured_Metadata_Out</span>
          </div>
          <OutputJSON data={generatedJSON} />
        </div>
        
        <div className="border-t border-[#333] pt-32">
          <BulkProcessor items={bulkItems} setItems={setBulkItems} onProcess={transformImage} />
        </div>
      </div>

      <footer className="fixed bottom-0 left-0 right-0 bg-[#111]/95 border-t border-[#333] px-8 py-3 z-50 flex items-center justify-between text-[9px] font-bold tracking-widest text-zinc-600 uppercase">
        <div className="flex gap-8">
           <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-500" />Status:Ready</div>
           <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-500" />Int: {config.styleWeight}%</div>
           <div className="flex items-center gap-2 uppercase"><div className="w-1.5 h-1.5 bg-zinc-500" />Res: {config.resolution}</div>
        </div>
        <div className="opacity-40">System_Workflow:Cine_Terminal</div>
      </footer>
    </div>
  );
};

export default App;
