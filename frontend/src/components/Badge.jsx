import React from 'react';

const Badge = ({ variant = 'default', children, className = '' }) => {
  let styles = 'bg-slate-800 text-slate-300 border-slate-700/80';

  switch (variant.toLowerCase()) {
    case 'approved':
    case 'success':
      styles = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      break;
    case 'draft':
    case 'pending':
      styles = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      break;
    case 'needs_revision':
    case 'error':
      styles = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      break;
    case 'warning':
      styles = 'bg-amber-500/10 text-amber-300 border-amber-500/20';
      break;
    case 'royal':
    case 'indigo':
    case 'neon':
      styles = 'bg-brand-500/10 text-brand-300 border-brand-500/20 font-medium';
      break;
    case 'bloom':
      styles = 'bg-sky-500/10 text-sky-300 border-sky-500/20';
      break;
    default:
      styles = 'bg-slate-800/80 text-slate-300 border-slate-700/60';
  }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${styles} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
