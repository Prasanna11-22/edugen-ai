import React from 'react';

const GlassCard = ({ 
  children, 
  title, 
  subtitle, 
  icon: Icon, 
  action, 
  accent = false, 
  className = '',
  hoverEffect = false 
}) => {
  return (
    <div className={`rounded-xl p-5 transition-all duration-200 ${accent ? 'glass-panel-accent' : 'glass-panel'} ${hoverEffect ? 'glass-panel-hover' : ''} ${className}`}>
      {(title || Icon || action) && (
        <div className="flex items-start justify-between gap-3 mb-4 pb-3.5 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0">
                <Icon className="w-4 h-4" />
              </div>
            )}
            <div>
              {title && <h3 className="text-sm font-semibold text-slate-100 tracking-tight">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default GlassCard;
