import React, { useState } from 'react';
import { AlertTriangle, AlertOctagon, CheckCircle, Edit3, ShieldAlert } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import Badge from './Badge';

const GuardrailAlerts = ({ flags = [], onOverride }) => {
  const { showToast } = useToast();
  const [overrideModalFlag, setOverrideModalFlag] = useState(null);
  const [teacherNote, setTeacherNote] = useState('');
  const [loading, setLoading] = useState(false);

  if (!flags || flags.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
        <CheckCircle className="w-4 h-4" />
        <span>All 6 Automated Quality Guardrails Passed: Zero anomalies detected.</span>
      </div>
    );
  }

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!teacherNote.trim()) return;
    setLoading(true);
    try {
      await onOverride(overrideModalFlag.id, teacherNote);
      setOverrideModalFlag(null);
      setTeacherNote('');
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
          <ShieldAlert className="w-4 h-4 text-neon-orange" />
          <span>Automated Quality Guardrails Inspector ({flags.length} Flag{flags.length > 1 ? 's' : ''})</span>
        </div>
        <span className="text-[11px] text-slate-400 italic">Blocks approval unless overridden</span>
      </div>

      <div className="space-y-2">
        {flags.map((flag) => {
          const isError = flag.severity === 'error';
          const isResolved = flag.resolved;

          return (
            <div 
              key={flag.id} 
              className={`p-3 rounded-xl border transition-all text-xs ${isResolved ? 'bg-dark-900/60 border-slate-700/50 opacity-70' : (isError ? 'bg-rose-950/40 border-rose-500/40 text-rose-200' : 'bg-orange-950/40 border-neon-orange/40 text-orange-200')}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {isError ? (
                    <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold uppercase tracking-wider font-mono text-[10px]">
                        {flag.flag_type.replace(/_/g, ' ')}
                      </span>
                      <Badge variant={isResolved ? 'success' : (isError ? 'error' : 'warning')}>
                        {isResolved ? 'OVERRIDDEN WITH NOTE' : flag.severity.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="leading-relaxed">{flag.message}</p>
                    {flag.teacher_note && (
                      <p className="mt-1.5 text-[11px] text-slate-400 italic bg-dark-950/60 p-1.5 rounded border border-slate-800">
                        Teacher Override Note: "{flag.teacher_note}"
                      </p>
                    )}
                  </div>
                </div>

                {!isResolved && (
                  <button
                    onClick={() => setOverrideModalFlag(flag)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 border border-slate-700 hover:border-neon-orange text-[11px] text-slate-300 hover:text-white transition-all flex items-center gap-1"
                  >
                    <Edit3 className="w-3 h-3 text-neon-orange" />
                    Override
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Override Dialog Modal */}
      {overrideModalFlag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon-lg">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-neon-orange" />
              Teacher Guardrail Override Note
            </h3>
            <p className="text-xs text-slate-300 mb-4 leading-relaxed">
              Flags cannot be silently dismissed. Please enter an authoritative pedagogical note justifying why this item is approved for classroom delivery.
            </p>

            <div className="p-3 rounded-lg bg-dark-950/80 border border-slate-800 text-xs text-slate-300 mb-4">
              <span className="font-semibold text-neon-amber block mb-1">Target Flag:</span>
              {overrideModalFlag.message}
            </div>

            <form onSubmit={handleOverrideSubmit}>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Authoritative Teacher Note / Rationale:
              </label>
              <textarea
                value={teacherNote}
                onChange={(e) => setTeacherNote(e.target.value)}
                placeholder="e.g., Reviewed question phrasing: verified that the conceptual framing matches the syllabus requirements..."
                required
                rows={4}
                className="w-full rounded-xl glass-input p-3 text-xs mb-4 resize-none"
              />

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOverrideModalFlag(null)}
                  className="px-4 py-2 rounded-xl text-xs bg-dark-800 hover:bg-dark-700 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="btn-royal text-xs"
                >
                  {loading ? 'Saving Override...' : 'Confirm Pedagogical Override'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GuardrailAlerts;
