
import React, { useRef } from 'react';

interface CropOverlayProps {
  imageUrl: string;
  gridSize: number;
  onConfirm: (croppedImageData: string) => void;
  onCancel: () => void;
}

const CropOverlay: React.FC<CropOverlayProps> = ({ imageUrl, gridSize, onConfirm, onCancel }) => {
  const imgRef = useRef<HTMLImageElement>(null);

  const handleCellClick = (row: number, col: number) => {
    if (!imgRef.current) return;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const naturalWidth = imgRef.current.naturalWidth;
    const naturalHeight = imgRef.current.naturalHeight;

    const cellWidth = naturalWidth / gridSize;
    const cellHeight = naturalHeight / gridSize;

    const x = col * cellWidth;
    const y = row * cellHeight;

    canvas.width = cellWidth;
    canvas.height = cellHeight;
    
    ctx.drawImage(
      imgRef.current,
      x, y, cellWidth, cellHeight, // Source
      0, 0, cellWidth, cellHeight  // Destination
    );

    const croppedData = canvas.toDataURL('image/png');
    onConfirm(croppedData);
  };

  const gridCells = [];
  for (let r = 0; r < gridSize; r++) {
    for (let c = 0; c < gridSize; c++) {
      gridCells.push({ row: r, col: c });
    }
  }

  return (
    <div className="fixed inset-0 bg-black/98 z-50 flex flex-col items-center justify-center p-8 font-mono">
      <div className="mb-12 text-center">
        <h2 className="text-[10px] font-bold tracking-[0.6em] uppercase mb-3 text-zinc-100">VARIATION_ISOLATION</h2>
        <p className="text-zinc-700 text-[9px] uppercase tracking-[0.3em]">SELECT ONE TARGET CELL FOR 4K UPSCALING</p>
      </div>
      
      <div className="relative inline-block border border-zinc-900 bg-zinc-950 group">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Source Grid"
          className="max-h-[70vh] block opacity-40 group-hover:opacity-30 transition-all duration-700 grayscale"
          draggable={false}
        />
        
        {/* Interactive Grid Overlay */}
        <div 
          className="absolute inset-0 grid" 
          style={{ 
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
            gridTemplateRows: `repeat(${gridSize}, 1fr)`
          }}
        >
          {gridCells.map((cell, i) => (
            <button
              key={i}
              onClick={() => handleCellClick(cell.row, cell.col)}
              className="border border-zinc-800/20 hover:border-zinc-100 hover:bg-white/10 transition-all flex items-center justify-center text-[9px] text-transparent hover:text-white uppercase tracking-[0.3em] font-bold"
            >
              C_{cell.row}.{cell.col}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-16">
        <button
          onClick={onCancel}
          className="px-16 py-4 text-[10px] border border-zinc-900 text-zinc-700 hover:text-zinc-100 hover:bg-zinc-900 transition-all uppercase tracking-[0.5em]"
        >
          ABORT_SELECTION
        </button>
      </div>
    </div>
  );
};

export default CropOverlay;
