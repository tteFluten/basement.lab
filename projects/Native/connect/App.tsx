
import React, { useState, useCallback, useRef } from 'react';
import { ArtCanvas } from './components/ArtCanvas';
import { Sidebar } from './components/Sidebar';
import { DEFAULT_CONFIG } from './constants';
import { ArtConfig, Point } from './types';
import { Download, RefreshCw, Moon, Sun, Maximize, Plus, Minus, Shuffle, Save, Upload } from 'lucide-react';

const App: React.FC = () => {
  const [config, setConfig] = useState<ArtConfig>(DEFAULT_CONFIG);
  const [seed, setSeed] = useState(Math.random());
  const [isExporting, setIsExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdate = (updates: Partial<ArtConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const regenerateSeed = () => setSeed(Math.random());

  const randomizeAll = () => {
    const layouts: ArtConfig['layout'][] = ['horizon', 'radial', 'network', 'grid'];
    const gridLayouts: ArtConfig['gridLayout'][] = ['concentric', 'rectangular', 'triangular', 'spiral', 'honeycomb'];
    
    const currentHubCount = config.hubPositions.length;
    const newHubs: Point[] = Array.from({ length: currentHubCount }, () => ({
      x: 1000,
      y: 1000
    }));

    const newConfig: ArtConfig = {
      ...config,
      layout: layouts[Math.floor(Math.random() * layouts.length)],
      gridLayout: gridLayouts[Math.floor(Math.random() * gridLayouts.length)],
      lineCount: Math.floor(Math.random() * 80) + 10,
      lineOpacity: 0.8, 
      length: Math.floor(Math.random() * 1200) + 300,
      spread: Math.floor(Math.random() * 360),
      curvature: Number((Math.random() * 4.0).toFixed(1)),
      asymmetry: Math.floor(Math.random() * 400) - 200,
      noise: Math.floor(Math.random() * 100),
      noiseScale: Number((Math.random() * 2.0 + 0.1).toFixed(1)),
      dotProbability: Number((Math.random() * 15 + 1).toFixed(1)),
      shadowIntensity: 0.15,
      shadowBlur: 4,
      shadowAngle: 45,
      shadowDistance: 4,
      hubPositions: newHubs,
      manualSeed: Math.floor(Math.random() * 999999).toString(),
    };
    
    setConfig(newConfig);
    regenerateSeed();
  };

  const addHub = () => {
    const last = config.hubPositions[config.hubPositions.length - 1] || { x: 1000, y: 1000 };
    const newHubs = [...config.hubPositions, { x: last.x + 150, y: last.y + 150 }];
    handleUpdate({ hubPositions: newHubs });
  };

  const removeHub = () => {
    if (config.hubPositions.length <= 1) return;
    handleUpdate({ hubPositions: config.hubPositions.slice(0, -1) });
  };

  const toggleTheme = () => {
    handleUpdate({ theme: config.theme === 'dark' ? 'light' : 'dark' });
  };

  const saveConfigJSON = useCallback(() => {
    const dataStr = JSON.stringify(config, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `${config.label || 'CONFIG'}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [config]);

  const loadConfigJSON = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        // Basic validation: ensure it has key properties
        if (json.layout && json.hubPositions) {
          setConfig({ ...DEFAULT_CONFIG, ...json });
        }
      } catch (err) {
        console.error("Error parsing config JSON", err);
      }
    };
    reader.readAsText(file);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, []);

  const downloadSVG = useCallback(() => {
    const svg = document.getElementById('art-svg');
    if (!svg) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svg);
    const url = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(source);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${config.label || 'PARAM_ART'}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [config.label]);

  const export4K = useCallback(async () => {
    const svg = document.getElementById('art-svg') as unknown as SVGSVGElement;
    if (!svg) return;
    setIsExporting(true);

    try {
      const size = 4096;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = config.theme === 'dark' ? '#000000' : '#FFFFFF';
      ctx.fillRect(0, 0, size, size);

      const svgData = new XMLSerializer().serializeToString(svg);
      const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);
      
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, size, size);
        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = `${config.label || 'RENDER'}_4K.png`;
        link.click();
        URL.revokeObjectURL(url);
        setIsExporting(false);
      };
      img.src = url;
    } catch (e) {
      console.error(e);
      setIsExporting(false);
    }
  }, [config.label, config.theme]);

  const bgColor = config.theme === 'dark' ? 'bg-black' : 'bg-white';
  const textColor = config.theme === 'dark' ? 'text-white' : 'text-black';
  const borderColor = config.theme === 'dark' ? 'border-[#222]' : 'border-black/10';

  return (
    <div className={`flex flex-col md:flex-row h-screen ${bgColor} ${textColor} transition-colors duration-300 overflow-hidden font-mono select-none`}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={loadConfigJSON} 
        accept=".json" 
        className="hidden" 
      />
      
      {/* Sidebar - Solid background */}
      <div className={`w-full md:w-80 h-auto md:h-full border-b md:border-b-0 md:border-r ${borderColor} p-6 overflow-y-auto z-10 custom-scrollbar ${bgColor}`}>
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h1 className="text-[13px] font-bold tracking-[0.5em] uppercase">CONNECT</h1>
            <span className="text-[8px] opacity-40 uppercase tracking-widest mt-1">v8.0_BW_JSON</span>
          </div>
          <div className="flex gap-1">
            <button onClick={randomizeAll} className={`p-2 hover:bg-current hover:bg-opacity-10 transition-all ${borderColor} border bg-transparent rounded-none`} title="Shuffle"><Shuffle size={12} /></button>
            <button onClick={toggleTheme} className={`p-2 hover:bg-current hover:bg-opacity-10 transition-all ${borderColor} border rounded-none`}>{config.theme === 'dark' ? <Sun size={12} /> : <Moon size={12} />}</button>
            <button onClick={regenerateSeed} className={`p-2 hover:bg-current hover:bg-opacity-10 transition-all ${borderColor} border rounded-none`}><RefreshCw size={12} /></button>
          </div>
        </div>
        
        <div className="flex gap-1 mb-6">
          <button onClick={addHub} className={`flex-1 py-3 border ${borderColor} flex items-center justify-center gap-2 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[9px] tracking-[0.2em] font-bold rounded-none`}><Plus size={12} /> HUB+</button>
          <button onClick={removeHub} className={`flex-1 py-3 border ${borderColor} flex items-center justify-center gap-2 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[9px] tracking-[0.2em] font-bold rounded-none`}><Minus size={12} /> HUB-</button>
        </div>

        <Sidebar config={config} onUpdate={handleUpdate} onSave={saveConfigJSON} onLoad={() => fileInputRef.current?.click()} />

        <div className="mt-8 space-y-1 pb-10">
          <button onClick={downloadSVG} className={`w-full py-4 border ${borderColor} flex items-center justify-center gap-3 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[10px] tracking-[0.3em] font-bold rounded-none`}><Download size={14} /> EXPORT_SVG</button>
          <button onClick={export4K} disabled={isExporting} className={`w-full py-4 border ${borderColor} flex items-center justify-center gap-3 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[10px] tracking-[0.3em] font-bold rounded-none ${isExporting ? 'opacity-30' : ''}`}><Maximize size={14} /> {isExporting ? 'CAPTURING...' : 'RENDER_4K'}</button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <ArtCanvas config={config} onUpdate={handleUpdate} seed={seed} />
        <div className="absolute top-6 left-1/2 -translate-x-1/2 text-[9px] uppercase tracking-[0.4em] opacity-30 pointer-events-none text-center">DRAG HUBS / WHEEL ZOOM / SHUFFLE</div>
      </div>

      <div className="fixed bottom-6 right-8 text-[8px] uppercase tracking-[0.4em] opacity-30 pointer-events-none hidden lg:block text-right">
        NODES: {config.hubPositions.length}<br/>VECTORS: {Math.floor(config.lineCount * config.extraDensity * (config.layout === 'horizon' ? 2 : 1) * config.hubPositions.length)}<br/>ZOOM: {config.zoom.toFixed(2)}x
      </div>
    </div>
  );
};

export default App;
