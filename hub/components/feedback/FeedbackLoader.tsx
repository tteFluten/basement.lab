"use client";

export function FeedbackLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <style>{`
        @keyframes fb-spin     { to { transform: rotate(360deg); } }
        @keyframes fb-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes fb-dash     { to { stroke-dashoffset: -20; } }
        @keyframes fb-pulse    { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes fb-dot-wave { 0%,60%,100% { transform: translateY(0); opacity: 0.3; } 30% { transform: translateY(-3px); opacity: 1; } }
      `}</style>
      <div className="flex flex-col items-center gap-6">
        <svg width="80" height="80" viewBox="0 0 120 120" className="text-fg overflow-visible">
          <g style={{ transformOrigin: "60px 60px", animation: "fb-spin 18s linear infinite" }}>
            <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="0.5"
              strokeOpacity="0.15" strokeDasharray="4 6"
              style={{ animation: "fb-dash 2s linear infinite" }} />
          </g>
          <g style={{ transformOrigin: "60px 60px", animation: "fb-spin-rev 10s linear infinite" }}>
            <circle cx="60" cy="60" r="38" fill="none" stroke="currentColor" strokeWidth="0.5" strokeOpacity="0.08" />
          </g>
          <g style={{ transformOrigin: "60px 60px", animation: "fb-spin 3s linear infinite" }}>
            <circle cx="60" cy="60" r="24" fill="none" stroke="currentColor" strokeWidth="1.5"
              strokeOpacity="0.5" strokeDasharray="20 60" strokeLinecap="round" />
          </g>
          <circle cx="60" cy="60" r="4" fill="currentColor"
            style={{ animation: "fb-pulse 2.5s ease-in-out infinite" }} />
        </svg>
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-[0.3em] text-fg-muted"
            style={{ animation: "fb-pulse 2s ease-in-out infinite" }}>
            Loading
          </span>
          <svg width="28" height="8" viewBox="0 0 28 8">
            {[0, 1, 2].map(i => (
              <circle key={i} cx={4 + i * 10} cy="4" r="1.5" fill="currentColor" className="text-fg-muted"
                style={{ animation: "fb-dot-wave 1.2s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />
            ))}
          </svg>
        </div>
      </div>
    </div>
  );
}
