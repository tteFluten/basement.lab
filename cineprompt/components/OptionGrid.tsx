
import React, { useState, useRef, useEffect } from 'react';
import { OptionItem } from '../types';

interface OptionGridProps {
  title: string;
  options: OptionItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  showImages?: boolean;
  variant?: 'grid' | 'horizontal';
}

export const OptionGrid: React.FC<OptionGridProps> = ({ 
  title, 
  options, 
  selectedId, 
  onSelect, 
  showImages = true,
  variant = 'grid'
}) => {
  const isCamera = title.toLowerCase().includes('camera');
  const isHorizontal = variant === 'horizontal';
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollLeft = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: -300, behavior: 'smooth' });
    }
  };

  const scrollRight = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: 300, behavior: 'smooth' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-grow">
          <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.3em]">
            {title}
          </h3>
          <div className="h-px flex-grow bg-zinc-900" />
        </div>
        
        {isHorizontal && (
          <div className="flex gap-2">
            <button 
              onClick={scrollLeft}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-all text-[10px]"
            >
              {"<"}
            </button>
            <button 
              onClick={scrollRight}
              className="px-3 py-1 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-100 transition-all text-[10px]"
            >
              {">"}
            </button>
          </div>
        )}
      </div>
      
      <div className="relative">
        <div 
          ref={scrollRef}
          className={
            isHorizontal 
              ? "flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scroll-smooth relative no-scrollbar" 
              : `grid ${isCamera ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'} gap-4`
          }
        >
          {options.map((option) => (
            <div 
              key={option.id} 
              className={isHorizontal ? "flex-shrink-0 w-[240px] snap-start" : "h-full"}
            >
              <OptionCard
                option={option}
                isSelected={selectedId === option.id}
                onSelect={() => onSelect(option.id)}
                showImage={showImages}
                isCamera={isCamera}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

interface OptionCardProps {
  option: OptionItem;
  isSelected: boolean;
  onSelect: () => void;
  showImage: boolean;
  isCamera: boolean;
}

const OptionCard: React.FC<OptionCardProps> = ({ option, isSelected, onSelect, showImage, isCamera }) => {
  return (
    <button
      onClick={onSelect}
      className={`group relative flex flex-col border transition-all duration-300 overflow-hidden text-left w-full h-full ${
        isSelected
          ? 'bg-zinc-900 border-zinc-100 z-10'
          : 'bg-black hover:bg-zinc-950 border-zinc-900'
      }`}
    >
      {showImage && option.imageUrl ? (
        <div className={`relative ${isCamera ? 'aspect-[1/1] bg-black' : 'aspect-video bg-black'} overflow-hidden`}>
          <img
            src={option.imageUrl}
            alt={option.name}
            className={`w-full h-full transition-all duration-700 ${
              isCamera ? 'object-contain p-4' : 'object-cover'
            } ${
              isSelected ? 'opacity-100' : 'opacity-40 group-hover:opacity-80'
            }`}
          />
          <div className={`absolute top-2 right-2 w-4 h-4 border transition-all ${
            isSelected ? 'bg-zinc-100 border-zinc-100' : 'bg-transparent border-zinc-800'
          }`} />
        </div>
      ) : (
        <div className="flex flex-col gap-2 p-4 h-full">
          <h4 className={`text-[10px] font-bold uppercase tracking-[0.1em] leading-tight ${
            isSelected ? 'text-zinc-100' : 'text-zinc-500'
          }`}>
            {option.name}
          </h4>
          <p className="text-[9px] text-zinc-700 font-medium leading-tight line-clamp-2 uppercase">
            {option.description}
          </p>
        </div>
      )}

      {showImage && isCamera && (
        <div className="p-4 mt-auto border-t border-zinc-900">
          <h4 className={`text-[10px] font-bold uppercase tracking-[0.1em] mb-1 transition-colors ${
            isSelected ? 'text-zinc-100' : 'text-zinc-400'
          }`}>
            {option.name}
          </h4>
          <p className="text-[9px] text-zinc-600 leading-relaxed font-bold uppercase line-clamp-2">
            {option.description}
          </p>
        </div>
      )}
    </button>
  );
};
