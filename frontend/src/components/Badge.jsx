import React from 'react';

const Badge = ({ variant = 'default', children, className = '' }) => {
  let styles = 'bg-dark-800 text-slate-300 border-slate-700';

  switch (variant.toLowerCase()) {
    case 'approved':
    case 'success':
      styles = 'bg-emerald-950/60 text-emerald-400 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]';
      break;
    case 'draft':
    case 'pending':
      styles = 'bg-amber-950/60 text-amber-400 border-amber-500/40 shadow-[0_0_10px_rgba(245,158,11,0.2)]';
      break;
    case 'needs_revision':
    case 'error':
      styles = 'bg-rose-950/60 text-rose-400 border-rose-500/40 shadow-[0_0_10px_rgba(244,63,94,0.2)]';
      break;
    case 'warning':
      styles = 'bg-orange-950/60 text-neon-orange border-neon-orange/40 shadow-neon-sm';
      break;
    case 'neon':
    case 'royal':
      styles = 'bg-neon-orange/15 text-neon-glow border-neon-orange/50 shadow-neon-sm font-semibold';
      break;
    case 'bloom':
      styles = 'bg-indigo-950/60 text-indigo-300 border-indigo-500/40';
      break;
    default:
      styles = 'bg-dark-800/80 text-slate-300 border-slate-700/60';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border backdrop-blur-md ${styles} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
