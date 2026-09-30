import React from 'react';

export const RetrievoIcon = ({ className = "w-6 h-6" }) => (
  <svg 
    viewBox="0 0 36 36" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <defs>
      <linearGradient id="retrievo-grad-primary" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#FF3D00" />
        <stop offset="50%" stopColor="#FF7A00" />
        <stop offset="100%" stopColor="#FFB800" />
      </linearGradient>
      <filter id="retrievo-glow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#FF6200" floodOpacity="0.5"/>
      </filter>
    </defs>
    
    {/* Outer Rounded Emblem Core */}
    <rect 
      x="2" 
      y="2" 
      width="32" 
      height="32" 
      rx="9" 
      fill="url(#retrievo-grad-primary)" 
      filter="url(#retrievo-glow)"
    />
    
    {/* Modern Geometric 'R' Monogram & Retrieval Node */}
    <rect x="8.5" y="8" width="4.5" height="20" rx="2" fill="#FFFFFF" />
    
    {/* Upper Loop of R */}
    <path 
      d="M11 8H20.5C23.8 8 26 10.2 26 13.5C26 16.8 23.8 19 20.5 19H11V8Z" 
      fill="#FFFFFF" 
    />
    <path 
      d="M13 11H19.5C21 11 22.2 12.1 22.2 13.5C22.2 14.9 21 16 19.5 16H13V11Z" 
      fill="url(#retrievo-grad-primary)" 
    />
    
    {/* Forward Dynamic Leg */}
    <path 
      d="M18 17L26 28H20.5L13.5 18H18Z" 
      fill="#FFFFFF" 
    />
    
    {/* AI Retrieval Spark Node */}
    <circle cx="27" cy="8.5" r="2.5" fill="#FFE57F" />
  </svg>
);

export const RetrievoLogo = ({ size = "default", showTagline = true, onClick = null, className = "" }) => {
  return (
    <div 
      onClick={onClick}
      className={`flex items-center gap-3 select-none ${onClick ? 'cursor-pointer group' : ''} ${className}`}
    >
      <div className="relative">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-neon-bright to-neon-orange p-1 shadow-neon flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:shadow-[0_0_25px_rgba(255,98,0,0.7)]">
          <RetrievoIcon className="w-full h-full" />
        </div>
        <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full border-2 border-dark-950 animate-pulse" />
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight text-white font-sans">
            Retri<span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-orange via-neon-amber to-amber-300">evo</span>
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-neon-orange/20 text-neon-orange border border-neon-orange/40 uppercase tracking-widest">
            AI
          </span>
        </div>
        {showTagline && (
          <p className="text-[11px] text-slate-400 font-medium tracking-tight">
            Retrieve Smarter. Learn Better.
          </p>
        )}
      </div>
    </div>
  );
};

export default RetrievoLogo;
