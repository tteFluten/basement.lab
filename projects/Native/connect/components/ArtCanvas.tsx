
import React, { useMemo, useRef, useEffect, useState } from 'react';
import { ArtConfig, Point } from '../types';
import { THEMES } from '../constants';

interface ArtCanvasProps {
  onUpdate: (updates: Partial<ArtConfig>) => void;
  config: ArtConfig;
  seed: number;
}

export const ArtCanvas: React.FC<ArtCanvasProps> = ({ config, onUpdate, seed }) => {
  const theme = THEMES[config.theme];
  const width = 2000;
  const height = 2000;
  
  const svgRef = useRef<SVGSVGElement>(null);
  const dragInfo = useRef<{ index: number; startPos: Point } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [time, setTime] = useState(0);

  // Animation loop
  useEffect(() => {
    let animFrame: number;
    const loop = (t: number) => {
      if (config.isAnimated) {
        setTime(t / 1000);
      }
      animFrame = requestAnimationFrame(loop);
    };
    animFrame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animFrame);
  }, [config.isAnimated]);

  const masterSeed = useMemo(() => {
    let s = seed;
    for (let i = 0; i < config.manualSeed.length; i++) {
      s += config.manualSeed.charCodeAt(i) * (i + 1);
    }
    return s;
  }, [seed, config.manualSeed]);

  const random = (s: number) => {
    const x = Math.sin(s + masterSeed) * 10000;
    return x - Math.floor(x);
  };

  const getBezierPoint = (p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point => {
    const cX = 3 * (p1.x - p0.x);
    const bX = 3 * (p2.x - p1.x) - cX;
    const aX = p3.x - p0.x - cX - bX;
    const cY = 3 * (p1.y - p0.y);
    const bY = 3 * (p2.y - p1.y) - cY;
    const aY = p3.y - p0.y - cY - bY;
    return {
      x: (aX * Math.pow(t, 3)) + (bX * Math.pow(t, 2)) + (cX * t) + p0.x,
      y: (aY * Math.pow(t, 3)) + (bY * Math.pow(t, 2)) + (cY * t) + p0.y
    };
  };

  const elements = useMemo(() => {
    const paths: any[] = [];
    const dots: any[] = [];
    
    // Parametric Morphing: perturbations based on mouse position
    const pIntensity = config.parallaxIntensity;
    const activeSpread = config.spread + (mousePos.x * 30 * pIntensity);
    const activeCurvature = config.curvature + (mousePos.y * 1.5 * pIntensity);
    const activeAsymmetry = config.asymmetry + (mousePos.x * 200 * pIntensity);
    const activeNoise = config.noise + (Math.abs(mousePos.y) * 100 * pIntensity);

    const placeDots = (count: number, seedBase: number, getPos: (t: number, localSeed: number) => Point, prefix: string) => {
      const numDots = Math.floor(count);
      const extraChance = count % 1;
      for (let dIdx = 0; dIdx < numDots + (random(seedBase * 0.77) < extraChance ? 1 : 0); dIdx++) {
        const localSeed = seedBase + dIdx * 133.7;
        const timeOffset = config.isAnimated ? (time * config.animationSpeed * 0.2) : 0;
        const baseT = random(localSeed * 1.9);
        const t = (baseT + timeOffset) % 1;
        dots.push({ pos: getPos(t, localSeed), id: `${prefix}-d-${seedBase}-${dIdx}` });
      }
    };

    config.hubPositions.forEach((hub, hIdx) => {
      const count = Math.floor(config.lineCount * config.extraDensity);

      if (config.layout === 'grid') {
        if (config.gridLayout === 'concentric') {
          for (let i = 0; i < count; i++) {
            const localSeed = hIdx * 1000 + i;
            const radius = (i + 1) * (config.length / count);
            const noiseVal = (random(localSeed * 3.3) - 0.5) * activeNoise;
            const finalR = Math.max(0, radius + noiseVal);
            
            const d = `M ${hub.x + finalR} ${hub.y} 
                       A ${finalR} ${finalR} 0 1 1 ${hub.x - finalR} ${hub.y}
                       A ${finalR} ${finalR} 0 1 1 ${hub.x + finalR} ${hub.y}`;
            paths.push({ d, id: `grid-c-${hIdx}-${i}` });

            if (i % (Math.max(1, Math.floor(12 / config.extraDensity))) === 0) {
              const angle = (random(localSeed * 9.1) * Math.PI * 2);
              const x2 = hub.x + Math.cos(angle) * config.length;
              const y2 = hub.y + Math.sin(angle) * config.length;
              paths.push({ d: `M ${hub.x} ${hub.y} L ${x2} ${y2}`, id: `grid-l-${hIdx}-${i}` });
            }

            placeDots(config.dotProbability, localSeed, (t) => {
              const dotAngle = t * Math.PI * 2;
              return { x: hub.x + Math.cos(dotAngle) * finalR, y: hub.y + Math.sin(dotAngle) * finalR };
            }, `grid-c-${hIdx}-${i}`);
          }
        } else if (config.gridLayout === 'rectangular') {
          const step = config.length / (Math.max(2, count / 2));
          for (let i = 0; i < count / 2; i++) {
            const offset = (i - count/4) * step;
            const noiseVal = (random(hIdx * 11 + i) - 0.5) * activeNoise;
            
            const xH1 = hub.x - config.length, yH1 = hub.y + offset + noiseVal;
            const xH2 = hub.x + config.length, yH2 = hub.y + offset + noiseVal;
            paths.push({ d: `M ${xH1} ${yH1} L ${xH2} ${yH2}`, id: `rect-h-${hIdx}-${i}` });
            
            const xV1 = hub.x + offset + noiseVal, yV1 = hub.y - config.length;
            const xV2 = hub.x + offset + noiseVal, yV2 = hub.y + config.length;
            paths.push({ d: `M ${xV1} ${yV1} L ${xV2} ${yV2}`, id: `rect-v-${hIdx}-${i}` });

            // Animate dots along these specific lines
            const localSeedH = hIdx * 77 + i;
            placeDots(config.dotProbability / 2, localSeedH, (t) => ({
              x: xH1 + (xH2 - xH1) * t,
              y: yH1 + (yH2 - yH1) * t
            }), `rect-h-${hIdx}-${i}`);

            const localSeedV = hIdx * 88 + i;
            placeDots(config.dotProbability / 2, localSeedV, (t) => ({
              x: xV1 + (xV2 - xV1) * t,
              y: yV1 + (yV2 - yV1) * t
            }), `rect-v-${hIdx}-${i}`);
          }
        } else if (config.gridLayout === 'triangular') {
           const step = config.length / (Math.max(2, count / 3));
           for (let angleDeg of [0, 60, 120]) {
             const angle = (angleDeg * Math.PI) / 180;
             for (let i = 0; i < count / 3; i++) {
                const offset = (i - count/6) * step;
                const noiseVal = (random(hIdx * 22 + i + angleDeg) - 0.5) * activeNoise;
                const cosA = Math.cos(angle);
                const sinA = Math.sin(angle);
                const cosP = Math.cos(angle + Math.PI/2);
                const sinP = Math.sin(angle + Math.PI/2);
                
                const x1 = hub.x + offset * cosP - config.length * cosA;
                const y1 = hub.y + offset * sinP - config.length * sinA;
                const x2 = hub.x + offset * cosP + config.length * cosA;
                const y2 = hub.y + offset * sinP + config.length * sinA;
                paths.push({ d: `M ${x1} ${y1} L ${x2} ${y2}`, id: `tri-${angleDeg}-${hIdx}-${i}` });
                
                placeDots(config.dotProbability, hIdx * 33 + i + angleDeg, (t) => ({
                  x: x1 + (x2 - x1) * t,
                  y: y1 + (y2 - y1) * t
                }), `tri-${angleDeg}-${hIdx}-${i}`);
             }
           }
        } else if (config.gridLayout === 'spiral') {
          const turns = 5 * activeCurvature;
          const pointsCount = Math.floor(config.length * 0.5); // Resolution proportional to length
          let d = `M ${hub.x} ${hub.y}`;
          const spiralPoints: Point[] = [];
          for (let i = 0; i < pointsCount; i++) {
            const t = i / (pointsCount - 1);
            const spiralAngle = t * turns * Math.PI * 2;
            const r = t * config.length;
            const noiseVal = (random(i * 0.1) - 0.5) * activeNoise;
            const x = hub.x + Math.cos(spiralAngle) * (r + noiseVal);
            const y = hub.y + Math.sin(spiralAngle) * (r + noiseVal);
            if (i === 0) d = `M ${x} ${y}`; else d += ` L ${x} ${y}`;
            spiralPoints.push({ x, y });
          }
          paths.push({ d, id: `spiral-${hIdx}` });
          
          placeDots(config.dotProbability * count, hIdx * 99, (t) => {
            const floatIdx = t * (spiralPoints.length - 1);
            const idx1 = Math.floor(floatIdx);
            const idx2 = Math.min(idx1 + 1, spiralPoints.length - 1);
            const lerpFactor = floatIdx - idx1;
            const p1 = spiralPoints[idx1];
            const p2 = spiralPoints[idx2];
            return {
              x: p1.x + (p2.x - p1.x) * lerpFactor,
              y: p1.y + (p2.y - p1.y) * lerpFactor
            };
          }, `spiral-${hIdx}`);
        } else if (config.gridLayout === 'honeycomb') {
          const hexCount = Math.floor(Math.sqrt(count));
          const step = config.length / (Math.max(1, hexCount));
          for (let r = -hexCount; r < hexCount; r++) {
            for (let c = -hexCount; c < hexCount; c++) {
              const x = hub.x + c * step * 1.5;
              const y = hub.y + r * step * Math.sqrt(3) + (c % 2 ? step * Math.sqrt(3) / 2 : 0);
              const sides = 6;
              const hexPoints: Point[] = [];
              const hexD = Array.from({ length: sides + 1 }).map((_, i) => {
                const hexAngle = (i * Math.PI * 2) / sides;
                const nx = x + Math.cos(hexAngle) * step * 0.9;
                const ny = y + Math.sin(hexAngle) * step * 0.9;
                hexPoints.push({ x: nx, y: ny });
                return `${i === 0 ? 'M' : 'L'} ${nx} ${ny}`;
              }).join(' ');
              paths.push({ d: hexD, id: `hex-${hIdx}-${r}-${c}` });
              
              placeDots(config.dotProbability, hIdx * 50 + r * 10 + c, (t) => {
                const floatIdx = t * sides;
                const idx1 = Math.floor(floatIdx) % sides;
                const idx2 = (idx1 + 1) % sides;
                const lerpFactor = floatIdx - Math.floor(floatIdx);
                const p1 = hexPoints[idx1];
                const p2 = hexPoints[idx2];
                return {
                  x: p1.x + (p2.x - p1.x) * lerpFactor,
                  y: p1.y + (p2.y - p1.y) * lerpFactor
                };
              }, `hex-${hIdx}-${r}-${c}`);
            }
          }
        }
      } else if (config.layout === 'radial') {
        for (let i = 0; i < count; i++) {
          const tLine = i / (count > 1 ? count - 1 : 1);
          const radialAngle = tLine * Math.PI * 2;
          const r = config.length;
          const bend = activeSpread / 180;
          const cp1Radius = r * 0.3 * activeCurvature;
          const cp1Angle = radialAngle + bend;
          const cp2Radius = r * 0.7 * activeCurvature;
          const cp2Angle = radialAngle - bend;
          const p0 = hub;
          const p1 = { x: hub.x + Math.cos(cp1Angle) * cp1Radius, y: hub.y + Math.sin(cp1Angle) * cp1Radius };
          const p2 = { x: hub.x + Math.cos(cp2Angle) * cp2Radius, y: hub.y + Math.sin(cp2Angle) * cp2Radius };
          const p3 = { x: hub.x + Math.cos(radialAngle) * r, y: hub.y + Math.sin(radialAngle) * r };
          paths.push({ d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`, id: `radial-p-${hIdx}-${i}` });
          placeDots(config.dotProbability, hIdx * 88 + i, (t) => getBezierPoint(p0, p1, p2, p3, t), `radial-${hIdx}-${i}`);
        }
      } else {
        for (let i = 0; i < count; i++) {
          const tLine = i / (count > 1 ? count - 1 : 1);
          const localSeed = hIdx * 1000 + i;
          const sideAngle = (tLine - 0.5) * (activeSpread / 180) * Math.PI;
          const sides = config.layout === 'horizon' ? [-1, 1] : [1];
          sides.forEach(side => {
            const hLen = config.length * side;
            const noiseX = (random(localSeed * 12.1) - 0.5) * activeNoise * config.noiseScale;
            const noiseY = (random(localSeed * 15.3) - 0.5) * activeNoise * config.noiseScale;
            const p0 = hub;
            const p1 = { x: hub.x + hLen * 0.3 + noiseX, y: hub.y + noiseY + (activeAsymmetry * (i % 2 === 0 ? 1 : -1)) };
            const p2 = { x: hub.x + hLen * 0.7, y: hub.y + Math.sin(sideAngle) * activeSpread * activeCurvature };
            const p3 = { x: hub.x + hLen, y: hub.y + Math.sin(sideAngle) * activeSpread };
            paths.push({ d: `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`, id: `net-p-${hIdx}-${side}-${i}` });
            placeDots(config.dotProbability, localSeed * side, (t) => getBezierPoint(p0, p1, p2, p3, t), `net-${hIdx}-${side}-${i}`);
          });
        }
      }
    });

    return { paths, dots };
  }, [config, masterSeed, time, mousePos]);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    dragInfo.current = { index, startPos: { x: e.clientX, y: e.clientY } };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const px = (e.clientX / window.innerWidth - 0.5) * 2;
      const py = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x: px, y: py });

      if (!dragInfo.current || !svgRef.current) return;
      const svg = svgRef.current;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const cursorPoint = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      const newPositions = [...config.hubPositions];
      newPositions[dragInfo.current.index] = { x: cursorPoint.x, y: cursorPoint.y };
      onUpdate({ hubPositions: newPositions });
    };
    const handleMouseUp = () => { dragInfo.current = null; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [config.hubPositions, onUpdate]);

  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    onUpdate({ zoom: Math.min(Math.max(config.zoom + delta * (config.zoom < 1 ? 0.5 : config.zoom/4), 0.05), 15) });
  };

  const renderDot = (dot: any) => {
    const { x, y } = dot.pos;
    const s = config.dotSize;
    if (config.dotShape === 'circle') return <circle key={dot.id} cx={x} cy={y} r={s} fill={theme.dot} fillOpacity="1" />;
    if (config.dotShape === 'square') return <rect key={dot.id} x={x - s} y={y - s} width={s * 2} height={s * 2} fill={theme.dot} fillOpacity="1" />;
    if (config.dotShape === 'cross') return <path key={dot.id} d={`M ${x-s} ${y-s} L ${x+s} ${y+s} M ${x+s} ${y-s} L ${x-s} ${y+s}`} stroke={theme.dot} strokeWidth={config.thickness} strokeOpacity="1" />;
    if (config.dotShape === 'plus') return <path key={dot.id} d={`M ${x-s} ${y} L ${x+s} ${y} M ${x} ${y-s} L ${x} ${y+s}`} stroke={theme.dot} strokeWidth={config.thickness} strokeOpacity="1" />;
    return null;
  };

  const renderHub = (h: Point, idx: number) => {
    const s = config.hubSize;
    const props = {
      fill: theme.hub,
      fillOpacity: "1",
      className: "cursor-move hover:stroke-current hover:stroke-2",
      onMouseDown: (e: any) => handleMouseDown(idx, e)
    };
    if (config.hubShape === 'square') return <rect key={`hub-${idx}`} x={h.x - s / 2} y={h.y - s / 2} width={s} height={s} {...props} />;
    if (config.hubShape === 'circle') return <circle key={`hub-${idx}`} cx={h.x} cy={h.y} r={s / 2} {...props} />;
    if (config.hubShape === 'diamond') return <rect key={`hub-${idx}`} x={h.x - s / 2} y={h.y - s / 2} width={s} height={s} transform={`rotate(45 ${h.x} ${h.y})`} {...props} />;
    if (config.hubShape === 'pill') return <rect key={`hub-${idx}`} x={h.x - s} y={h.y - s / 2} width={s * 2} height={s} rx={s / 2} {...props} />;
    return null;
  };

  const shadowDX = Math.cos((config.shadowAngle * Math.PI) / 180) * config.shadowDistance;
  const shadowDY = Math.sin((config.shadowAngle * Math.PI) / 180) * config.shadowDistance;

  return (
    <div className="w-full h-full flex items-center justify-center cursor-crosshair overflow-hidden" onWheel={handleWheel}>
      <svg ref={svgRef} id="art-svg" viewBox={`0 0 ${width} ${height}`} className="w-full h-full max-w-[95vh] max-h-[95vh] transition-transform duration-100 ease-out select-none" xmlns="http://www.w3.org/2000/svg" style={{ transform: `scale(${config.zoom})` }}>
        <defs>
          <filter id="shadow-filter" x="-200%" y="-200%" width="500%" height="500%">
            <feGaussianBlur in="SourceAlpha" stdDeviation={config.shadowBlur / 2} />
            <feOffset dx={shadowDX} dy={shadowDY} result="offsetblur" />
            <feComponentTransfer><feFuncA type="linear" slope={config.shadowIntensity} /></feComponentTransfer>
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <rect width={width} height={height} fill={theme.bg} />
        
        {/* All elements combined in one group to ensure perfect alignment during morphing */}
        <g filter="url(#shadow-filter)">
          <g>
            {elements.paths.map((p) => (
              <path 
                key={p.id} 
                d={p.d} 
                fill="none" 
                stroke={theme.line} 
                strokeWidth={config.thickness} 
                strokeLinecap="round" 
                strokeOpacity={config.lineOpacity} 
              />
            ))}
          </g>
          <g>
            {elements.dots.map(renderDot)}
            {config.showHub && config.hubPositions.map(renderHub)}
          </g>
        </g>
      </svg>
    </div>
  );
};
