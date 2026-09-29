import React from 'react';
import { AlertCircle, Check, ArrowRight, X, Sparkles, Edit3, ShieldAlert } from 'lucide-react';

const ValidationSuggestionModal = ({
  isOpen,
  onClose,
  title = "Input Validation Advisory",
  targetType = "Input",
  issues = [],
  onApplySuggestion,
  onKeepOriginal,
  onEditFurther
}) => {
  if (!isOpen || !issues || issues.length === 0) return null;

  const currentIssue = issues[0]; // Active issue or primary issue

  const getTargetLabel = () => {
    switch (targetType) {
      case 'objective':
        return 'Learning Objective';
      case 'ocr_correction':
        return 'OCR Page Review';
      case 'glossary_term':
        return 'Glossary Term';
      case 'asset_edit':
        return 'Asset Content';
      default:
        return 'Entry';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl shadow-amber-950/40 max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-500/10 via-slate-900 to-slate-900 border-b border-amber-500/20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                {title}
                <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300">
                  Advisory Suggestion
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Reviewing {getTargetLabel()} • You always have final authority
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            title="Dismiss advisory"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Reason Alert Banner */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
            <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-amber-300 block mb-0.5">Observation:</span>
              <p className="text-xs leading-relaxed text-slate-200">
                {currentIssue.reason || "The system identified a potential clarity, formatting, or consistency improvement."}
              </p>
            </div>
          </div>

          {/* Comparison Cards: Original vs Suggested */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Teacher's Original */}
            <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-slate-400">Your Input</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400">Original</span>
                </div>
                <div className="text-sm text-slate-300 bg-slate-900/90 p-3 rounded-lg border border-slate-800/80 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {currentIssue.original || "(Empty)"}
                </div>
              </div>
            </div>

            {/* Suggested Correction */}
            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-500/30 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Suggested Correction
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300">
                    Recommended
                  </span>
                </div>
                <div className="text-sm text-emerald-100 bg-slate-900/90 p-3 rounded-lg border border-emerald-500/20 font-mono whitespace-pre-wrap break-words max-h-48 overflow-y-auto">
                  {currentIssue.suggested || currentIssue.original}
                </div>
              </div>
            </div>
          </div>

          {issues.length > 1 && (
            <p className="text-xs text-slate-400 italic text-center">
              + {issues.length - 1} additional validation notice(s) detected.
            </p>
          )}

          <div className="text-[11px] text-slate-500 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60 text-center">
            Note: This check is completely non-blocking. Selecting <strong>Keep My Version</strong> will save your original input without changes.
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onEditFurther && onEditFurther(currentIssue.original, currentIssue)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700"
          >
            <Edit3 className="w-3.5 h-3.5" />
            Edit Further
          </button>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => onKeepOriginal && onKeepOriginal(currentIssue.original, currentIssue)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-all border border-slate-700/80"
            >
              Keep My Version
            </button>

            <button
              type="button"
              onClick={() => onApplySuggestion && onApplySuggestion(currentIssue.suggested || currentIssue.original, currentIssue)}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-950 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-lg shadow-emerald-500/20 transition-all"
            >
              <Check className="w-4 h-4" />
              Use Suggested
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationSuggestionModal;
