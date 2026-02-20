
import React from 'react';
import { ArtConfig } from '../types';
import { Save, Upload } from 'lucide-react';

interface SidebarProps {
  config: ArtConfig;
  onUpdate: (updates: Partial<ArtConfig>) => void;
  onSave: () => void;
  onLoad: () => void;
}

const Section: React.FC<{ title: string; children: React.ReactNode; hidden?: boolean }> = ({ title, children, hidden }) => {
  if (hidden) return null;
  return (
    <div className="mb-6 border-t border-current border-opacity-10 pt-4">
      <label className="text-[9px] uppercase tracking-[0.3em] block mb-4 opacity-50 font-bold">{title}</label>
      {children}
    </div>
  );
};

const Range: React.FC<{ 
  label: string; 
  value: number; 
  min: number; 
  max: number; 
  step?: number;
  onChange: (val: number) => void;
  hidden?: boolean;
}> = ({ label, value, min, max, step = 1, onChange, hidden }) => {
  if (hidden) return null;
  return (
    <div className="mb-4">
      <div className="flex justify-between items-center mb-1">
        <span className="text-[10px] uppercase tracking-wider opacity-60">{label}</span>
        <span className="text-[9px] opacity-30 font-mono">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input 
        type="range" 
        min={min} 
        max={max} 
        step={step} 
        value={value} 
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-[2px] bg-current bg-opacity-10 appearance-none cursor-pointer accent-current"
      />
    </div>
  );
};

const ButtonGroup: React.FC<{ label: string; active: boolean; onClick: () => void; theme: 'dark' | 'light' }> = ({ label, active, onClick, theme }) => {
  const isDark = theme === 'dark';
  
  let dynamicClasses = "";
  if (isDark) {
    dynamicClasses = active 
      ? "bg-white text-black border-white" 
      : "bg-black text-white border-white/20 hover:bg-white/10";
  } else {
    dynamicClasses = active 
      ? "bg-black text-white border-black" 
      : "bg-white text-black border-black/20 hover:bg-black/10";
  }

  return (
    <button 
      onClick={onClick}
      className={`flex-1 py-2 text-[8px] sm:text-[9px] uppercase tracking-widest border transition-all duration-200 rounded-none font-bold ${dynamicClasses}`}
    >
      {label}
    </button>
  );
};

export const Sidebar: React.FC<SidebarProps> = ({ config, onUpdate, onSave, onLoad }) => {
  const isGrid = config.layout === 'grid';
  const isSpiral = isGrid && config.gridLayout === 'spiral';
  const isHex = isGrid && config.gridLayout === 'honeycomb';
  const isTri = isGrid && config.gridLayout === 'triangular';
  
  const showCurve = config.layout !== 'grid' || isSpiral;
  const showSpread = config.layout !== 'grid';
  const showAsymmetry = config.layout === 'horizon' || config.layout === 'network';
  const showNoise = !isHex; 
  const showMagnitude = !isHex;

  return (
    <div className="space-y-1">
      <Section title="VIEWPORT">
        <Range label="ZOOM" min={0.05} max={15} step={0.01} value={config.zoom} onChange={(zoom) => onUpdate({ zoom })} />
        <div className="grid grid-cols-2 gap-1 mt-2">
          <ButtonGroup label="HORIZON" active={config.layout === 'horizon'} onClick={() => onUpdate({ layout: 'horizon' })} theme={config.theme} />
          <ButtonGroup label="RADIAL" active={config.layout === 'radial'} onClick={() => onUpdate({ layout: 'radial' })} theme={config.theme} />
          <ButtonGroup label="NETWORK" active={config.layout === 'network'} onClick={() => onUpdate({ layout: 'network' })} theme={config.theme} />
          <ButtonGroup label="GRID" active={config.layout === 'grid'} onClick={() => onUpdate({ layout: 'grid' })} theme={config.theme} />
        </div>
        {isGrid && (
          <div className="grid grid-cols-3 gap-1 mt-2">
            <ButtonGroup label="CON" active={config.gridLayout === 'concentric'} onClick={() => onUpdate({ gridLayout: 'concentric' })} theme={config.theme} />
            <ButtonGroup label="RECT" active={config.gridLayout === 'rectangular'} onClick={() => onUpdate({ gridLayout: 'rectangular' })} theme={config.theme} />
            <ButtonGroup label="TRI" active={config.gridLayout === 'triangular'} onClick={() => onUpdate({ gridLayout: 'triangular' })} theme={config.theme} />
            <ButtonGroup label="SPRL" active={config.gridLayout === 'spiral'} onClick={() => onUpdate({ gridLayout: 'spiral' })} theme={config.theme} />
            <ButtonGroup label="HEX" active={config.gridLayout === 'honeycomb'} onClick={() => onUpdate({ gridLayout: 'honeycomb' })} theme={config.theme} />
          </div>
        )}
      </Section>

      <Section title="DYNAMICS">
         <div className="grid grid-cols-2 gap-1 mb-4">
          <ButtonGroup label="STATIC" active={!config.isAnimated} onClick={() => onUpdate({ isAnimated: false })} theme={config.theme} />
          <ButtonGroup label="ANIMATED" active={config.isAnimated} onClick={() => onUpdate({ isAnimated: true })} theme={config.theme} />
        </div>
        <Range label="SPEED" min={0.1} max={5} step={0.1} value={config.animationSpeed} onChange={(animationSpeed) => onUpdate({ animationSpeed })} hidden={!config.isAnimated} />
        <Range label="PARALLAX" min={0} max={2} step={0.01} value={config.parallaxIntensity} onChange={(parallaxIntensity) => onUpdate({ parallaxIntensity })} />
      </Section>

      <Section title="TOPOLOGY">
        <Range label="DENSITY" min={1} max={100} value={config.lineCount} onChange={(lineCount) => onUpdate({ lineCount })} />
        <Range label="EXTRA DENSITY" min={1} max={50} value={config.extraDensity} onChange={(extraDensity) => onUpdate({ extraDensity })} />
        <Range label="MAGNITUDE" min={10} max={10000} value={config.length} onChange={(length) => onUpdate({ length })} hidden={!showMagnitude} />
        <Range label="SPREAD" min={0} max={360} value={config.spread} onChange={(spread) => onUpdate({ spread })} hidden={!showSpread} />
        <Range label="CURVE" min={0} max={12} step={0.1} value={config.curvature} onChange={(curvature) => onUpdate({ curvature })} hidden={!showCurve} />
        <Range label="ASYMMETRY" min={-1000} max={1000} value={config.asymmetry} onChange={(asymmetry) => onUpdate({ asymmetry })} hidden={!showAsymmetry} />
        <Range label="NOISE" min={0} max={2000} value={config.noise} onChange={(noise) => onUpdate({ noise })} hidden={!showNoise} />
      </Section>

      <Section title="ELEMENTS">
        <div className="grid grid-cols-2 gap-1 mb-2">
          <ButtonGroup label="HUB: SQ" active={config.hubShape === 'square'} onClick={() => onUpdate({ hubShape: 'square' })} theme={config.theme} />
          <ButtonGroup label="HUB: CIR" active={config.hubShape === 'circle'} onClick={() => onUpdate({ hubShape: 'circle' })} theme={config.theme} />
          <ButtonGroup label="HUB: DIA" active={config.hubShape === 'diamond'} onClick={() => onUpdate({ hubShape: 'diamond' })} theme={config.theme} />
          <ButtonGroup label="HUB: PILL" active={config.hubShape === 'pill'} onClick={() => onUpdate({ hubShape: 'pill' })} theme={config.theme} />
        </div>
        <div className="grid grid-cols-2 gap-1 mb-4">
          <ButtonGroup label="DOT: CIR" active={config.dotShape === 'circle'} onClick={() => onUpdate({ dotShape: 'circle' })} theme={config.theme} />
          <ButtonGroup label="DOT: SQ" active={config.dotShape === 'square'} onClick={() => onUpdate({ dotShape: 'square' })} theme={config.theme} />
          <ButtonGroup label="DOT: CROSS" active={config.dotShape === 'cross'} onClick={() => onUpdate({ dotShape: 'cross' })} theme={config.theme} />
          <ButtonGroup label="DOT: PLUS" active={config.dotShape === 'plus'} onClick={() => onUpdate({ dotShape: 'plus' })} theme={config.theme} />
        </div>
        <Range label="WEIGHT" min={0.1} max={4} step={0.1} value={config.thickness} onChange={(thickness) => onUpdate({ thickness })} />
        <Range label="OPACITY" min={0} max={1} step={0.01} value={config.lineOpacity} onChange={(lineOpacity) => onUpdate({ lineOpacity })} />
        <Range label="DOT SIZE" min={0} max={8} step={0.1} value={config.dotSize} onChange={(dotSize) => onUpdate({ dotSize })} />
        <Range label="DOT FREQ" min={0} max={100} step={0.1} value={config.dotProbability} onChange={(dotProbability) => onUpdate({ dotProbability })} />
        <Range label="HUB SCALE" min={0} max={120} value={config.hubSize} onChange={(hubSize) => onUpdate({ hubSize, showHub: hubSize > 0 })} />
      </Section>

      <Section title="SHADOWS">
        <Range label="DARKNESS" min={0} max={1} step={0.01} value={config.shadowIntensity} onChange={(shadowIntensity) => onUpdate({ shadowIntensity })} />
        <Range label="DISTANCE" min={0} max={1000} value={config.shadowDistance} onChange={(shadowDistance) => onUpdate({ shadowDistance })} />
        <Range label="ANGLE" min={0} max={360} value={config.shadowAngle} onChange={(shadowAngle) => onUpdate({ shadowAngle })} />
        <Range label="BLUR" min={0} max={500} value={config.shadowBlur} onChange={(shadowBlur) => onUpdate({ shadowBlur })} />
      </Section>

      <Section title="STORAGE">
        <div className="grid grid-cols-2 gap-1 mb-4">
          <button 
            onClick={onSave}
            className={`py-3 border flex items-center justify-center gap-2 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[9px] tracking-[0.2em] font-bold rounded-none ${config.theme === 'dark' ? 'border-white/20' : 'border-black/20'}`}
          >
            <Save size={12} /> SAVE_JSON
          </button>
          <button 
            onClick={onLoad}
            className={`py-3 border flex items-center justify-center gap-2 hover:bg-current hover:bg-opacity-10 transition-all uppercase text-[9px] tracking-[0.2em] font-bold rounded-none ${config.theme === 'dark' ? 'border-white/20' : 'border-black/20'}`}
          >
            <Upload size={12} /> LOAD_JSON
          </button>
        </div>
      </Section>

      <Section title="IDENTITY">
        <input type="text" placeholder="LABEL..." value={config.label} onChange={(e) => onUpdate({ label: e.target.value.toUpperCase() })} className="w-full bg-transparent border-b border-current border-opacity-10 outline-none text-[10px] py-2 focus:border-opacity-40 transition-colors uppercase tracking-[0.3em] rounded-none" />
        <div className="mt-4">
          <label className="text-[8px] uppercase tracking-widest opacity-30 block mb-1">STOCHASTIC SEED</label>
          <input type="text" value={config.manualSeed} onChange={(e) => onUpdate({ manualSeed: e.target.value })} className="w-full bg-transparent border border-current border-opacity-10 outline-none text-[10px] p-2 focus:border-opacity-40 transition-colors rounded-none" />
        </div>
      </Section>
    </div>
  );
};
