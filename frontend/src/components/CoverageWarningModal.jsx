import React from 'react';
import { AlertTriangle, Edit3, Sparkles, X, ShieldAlert, Check } from 'lucide-react';

const CoverageWarningModal = ({
  isOpen,
  onClose,
  objectiveText = '',
  bestMatchScore = 0,
  threshold = 55,
  coverageNote = '',
  onEditObjective,
  onGenerateAnyway,
  onCancelObjective
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/50 rounded-2xl shadow-2xl shadow-amber-950/50 max-w-xl w-full overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/20 via-slate-900 to-slate-900 border-b border-amber-500/30 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide leading-snug">
                This objective may not be covered by your source material
              </h3>
              <p className="text-xs text-amber-300/80 mt-0.5 font-medium">
                Potential Knowledge Gap Detected
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Close warning"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4">
          {/* Target Objective Pill */}
          <div>
            <div className="flex items-center justify-between text-[11px] text-slate-400 uppercase font-mono mb-1.5">
              <span>Submitted Learning Objective</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                bestMatchScore < 40 
                  ? 'bg-rose-950/60 text-rose-300 border border-rose-500/30'
                  : 'bg-amber-950/60 text-amber-300 border border-amber-500/30'
              }`}>
                Best Match: {bestMatchScore}% (Threshold: {threshold}%)
              </span>
            </div>
            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-sm font-medium text-slate-200 leading-relaxed font-mono">
              "{objectiveText}"
            </div>
          </div>

          {/* Observation Note on what the source DOES cover instead */}
          {coverageNote && (
            <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/30 space-y-1.5">
              <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider font-mono flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> Source Coverage Analysis
              </span>
              <p className="text-xs text-amber-100/90 leading-relaxed font-sans">
                {coverageNote}
              </p>
            </div>
          )}

          <p className="text-xs text-slate-400 leading-relaxed">
            Generating assets on weakly covered topics may lead to inferred explanations or speculative claims. You can refine this objective, discard it, or proceed anyway.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onCancelObjective}
            className="px-3.5 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-950/20 hover:bg-rose-950/40 rounded-xl transition border border-rose-500/30"
          >
            Cancel Objective
          </button>

          <div className="flex items-center gap-2.5 ml-auto">
            <button
              type="button"
              onClick={onEditObjective}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition border border-slate-700"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Objective
            </button>

            <button
              type="button"
              onClick={onGenerateAnyway}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-amber-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-lg shadow-amber-500/20 transition active:scale-95"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-950" />
              Generate Anyway
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoverageWarningModal;
