
import React from 'react';

interface ApiKeyOverlayProps {
  onSuccess: () => void;
}

const ApiKeyOverlay: React.FC<ApiKeyOverlayProps> = ({ onSuccess }) => {
  const handleSelectKey = async () => {
    try {
      await window.aistudio.openSelectKey();
      onSuccess();
    } catch (err) {
      console.error("Failed to open key selector", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-95 font-mono">
      <div className="max-w-md w-full p-8 border border-gray-800 bg-black">
        <h2 className="text-xl font-bold mb-4 tracking-tighter text-white">SYSTEM_INIT</h2>
        <p className="text-sm text-gray-400 mb-6 leading-relaxed">
          Accessing Gemini 3 Pro Vision for 4K rendering requires an authenticated API key from a paid GCP project.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleSelectKey}
            className="w-full py-3 px-4 bg-gray-200 text-black hover:bg-white transition-colors text-sm font-bold uppercase tracking-widest"
          >
            Select API Key
          </button>
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-xs text-gray-600 hover:text-gray-400 underline uppercase"
          >
            Billing Documentation
          </a>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyOverlay;
