import React from 'react';

const GlassCard = ({ 
  children, 
  title, 
  subtitle, 
  icon: Icon, 
  action, 
  accent = false, 
  className = '',
  hoverEffect = true 
}) => {
  return (
    <div className={`rounded-2xl p-6 transition-all duration-300 ${accent ? 'glass-panel-accent' : 'glass-panel'} ${hoverEffect ? 'glass-panel-hover' : ''} ${className}`}>
      {(title || Icon || action) && (
        <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            {Icon && (
              <div className="w-10 h-10 rounded-xl bg-neon-orange/10 border border-neon-orange/30 flex items-center justify-center text-neon-orange shadow-neon-sm">
                <Icon className="w-5 h-5" />
              </div>
            )}
            <div>
              {title && <h3 className="text-lg font-semibold text-white tracking-wide">{title}</h3>}
              {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
            </div>
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

export default GlassCard;
