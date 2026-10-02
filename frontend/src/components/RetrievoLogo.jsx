import React from 'react';

export const RetrievoIcon = ({ className = "w-5 h-5" }) => (
  <svg 
    viewBox="0 0 32 32" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="retrievo-grad-core" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#6366F1" />
        <stop offset="100%" stopColor="#4338CA" />
      </linearGradient>
    </defs>
    
    {/* Clean Geometric Rounded Emblem */}
    <rect 
      x="2" 
      y="2" 
      width="28" 
      height="28" 
      rx="7" 
      fill="url(#retrievo-grad-core)" 
      stroke="rgba(255,255,255,0.15)"
      strokeWidth="1"
    />
    
    {/* Architectural Monogram 'R' */}
    <path 
      d="M10 8.5H16.8C19.2 8.5 21 10.1 21 12.5C21 14.9 19.2 16.5 16.8 16.5H10V8.5Z" 
      fill="#FFFFFF" 
    />
    <path 
      d="M12.5 11H16.5C17.5 11 18.3 11.6 18.3 12.5C18.3 13.4 17.5 14 16.5 14H12.5V11Z" 
      fill="url(#retrievo-grad-core)" 
    />
    <rect x="10" y="8.5" width="2.6" height="15" rx="1.3" fill="#FFFFFF" />
    <path 
      d="M15 15L21.5 23.5H18L12.5 16H15Z" 
      fill="#FFFFFF" 
    />
    
    {/* Subtle Precision Dot */}
    <circle cx="21" cy="9.5" r="1.5" fill="#38BDF8" />
  </svg>
);

export const RetrievoLogo = ({ size = "default", showTagline = true, onClick = null, className = "" }) => {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-2.5 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      <div className="w-8 h-8 rounded-lg bg-brand-600/10 border border-brand-500/20 flex items-center justify-center p-0.5 transition-all duration-200 group-hover:border-brand-500/40">
        <RetrievoIcon className="w-full h-full" />
      </div>

      <div>
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold tracking-tight text-white font-sans">
            Retrievo
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20">
            PRO
          </span>
        </div>
        {showTagline && (
          <p className="text-[10px] text-slate-400 font-normal tracking-tight">
            Curriculum Intelligence Studio
          </p>
        )}
      </div>
    </div>
  );
};

export default RetrievoLogo;
