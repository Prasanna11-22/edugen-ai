import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((message, type = 'success', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast Notification Container */}
      <div className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => {
          let borderStyle = 'border-neon-orange/40 bg-dark-950/95 text-white shadow-neon';
          let icon = <Info className="w-5 h-5 text-neon-orange shrink-0" />;

          if (toast.type === 'success') {
            borderStyle = 'border-emerald-500/50 bg-dark-950/95 text-white shadow-[0_0_20px_rgba(16,185,129,0.25)]';
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
          } else if (toast.type === 'error') {
            borderStyle = 'border-rose-500/50 bg-dark-950/95 text-white shadow-[0_0_20px_rgba(244,63,94,0.25)]';
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start justify-between gap-3 p-4 rounded-2xl border backdrop-blur-xl transition-all animate-in slide-in-from-top-3 duration-300 ${borderStyle}`}
            >
              <div className="flex items-start gap-3">
                {icon}
                <div className="text-xs font-medium leading-relaxed">{toast.message}</div>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white transition-colors shrink-0 p-0.5"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    return { showToast: (msg) => console.log(msg) };
  }
  return context;
};
