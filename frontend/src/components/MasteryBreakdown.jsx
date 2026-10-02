import React from 'react';
import { Target, Award, CheckCircle2, TrendingUp } from 'lucide-react';
import Badge from './Badge';

const MasteryBreakdown = ({ breakdown = {}, overallScore = 0, masterySignal = '' }) => {
  const objectives = Object.entries(breakdown);

  return (
    <div className="rounded-2xl glass-panel p-5 border border-brand-500/50/25">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-800">
        <div>
          <span className="text-[11px] font-mono uppercase tracking-widest text-brand-400 font-semibold flex items-center gap-1.5">
            <Target className="w-3.5 h-3.5" /> Formative Assessment Signal
          </span>
          <h4 className="text-lg font-bold text-white mt-1">Objective-Aligned Mastery Signal</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Framed as continuous diagnostic feedback, not institutional final grades.
          </p>
        </div>

        <div className="flex items-center gap-3 bg-dark-900/90 p-3 rounded-xl border border-slate-800">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block uppercase font-mono">Mastery Index</span>
            <span className="text-2xl font-black text-brand-200 font-mono">{overallScore}%</span>
          </div>
          <Award className="w-8 h-8 text-brand-400" />
        </div>
      </div>

      {/* Mastery Signal Badge */}
      {masterySignal && (
        <div className="mb-4 p-3 rounded-xl bg-brand-600/10 border border-slate-800 flex items-center justify-between">
          <span className="text-xs text-slate-200 font-medium">Diagnostic Signal:</span>
          <Badge variant="royal">{masterySignal}</Badge>
        </div>
      )}

      {/* Breakdown per objective */}
      <div className="space-y-3">
        {objectives.map(([objName, score], idx) => {
          const numScore = Number(score);
          const isHigh = numScore >= 75;
          const isMid = numScore >= 50 && numScore < 75;

          return (
            <div key={idx} className="p-3 rounded-xl bg-dark-850/80 border border-slate-800">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-slate-200 line-clamp-1">{objName}</span>
                <span className="text-xs font-mono font-bold text-brand-300">{numScore}%</span>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-2 rounded-full bg-dark-950 overflow-hidden border border-slate-800">
                <div 
                  className={`h-full transition-all duration-700 rounded-full ${isHigh ? 'bg-gradient-to-r from-emerald-500 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : (isMid ? 'bg-gradient-to-r from-brand-600 to-brand-500 shadow-subtle' : 'bg-gradient-to-r from-rose-500 to-rose-400')}`}
                  style={{ width: `${Math.min(numScore, 100)}%` }}
                />
              </div>

              <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
                <span>Objective #{idx + 1}</span>
                <span className="capitalize font-medium">
                  {isHigh ? 'Competency Verified' : (isMid ? 'Developing Concept' : 'Requires Review')}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MasteryBreakdown;
