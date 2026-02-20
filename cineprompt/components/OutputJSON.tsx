
import React, { useState } from 'react';

interface OutputJSONProps {
  data: any;
}

export const OutputJSON: React.FC<OutputJSONProps> = ({ data }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-black border border-zinc-900 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-950 border-b border-zinc-900">
        <div className="flex items-center gap-4">
          <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Metadata_File</div>
          <span className="text-[9px] font-mono text-zinc-700">generation_config.json</span>
        </div>
        <button
          onClick={handleCopy}
          className={`px-5 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors ${
            copied ? 'bg-zinc-100 text-black' : 'bg-zinc-900 text-zinc-400 hover:text-zinc-100 border border-zinc-800'
          }`}
        >
          {copied ? 'COMPLETED' : 'COPY_BUFFER'}
        </button>
      </div>
      <div className="p-8 overflow-x-auto bg-black">
        <pre className="text-xs font-mono text-zinc-500 leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      </div>
    </div>
  );
};
