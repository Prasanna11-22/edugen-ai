import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Layers, Cpu, ShieldCheck, CheckCircle2, 
  FileText, ArrowRight, Zap, RefreshCw, Database
} from 'lucide-react';

const GENERATION_STEPS = [
  {
    id: 'chunking',
    title: 'Document Ingestion & Semantic Chunking',
    description: 'Splitting knowledge source into 300–600 token windows with 15% semantic overlap',
    icon: FileText,
    badge: 'STAGE 1/5'
  },
  {
    id: 'embeddings',
    title: 'Neural Vector Coordinate Indexing',
    description: 'Generating semantic dense embeddings and cosine similarity retrieval space',
    icon: Database,
    badge: 'STAGE 2/5'
  },
  {
    id: 'rag',
    title: 'Gemini AI Grounded RAG Synthesis',
    description: 'Synthesizing Explanations, Worked Examples, 10-Q Quizzes, Answer Keys & Revision Sheets',
    icon: Cpu,
    badge: 'STAGE 3/5'
  },
  {
    id: 'guardrails',
    title: '6-Point Pedagogical Quality Guardrails',
    description: 'Verifying citation grounding, Bloom\'s taxonomy alignment & distractor plausibility',
    icon: ShieldCheck,
    badge: 'STAGE 4/5'
  },
  {
    id: 'deploy',
    title: 'Asset Versioning & Classroom Release',
    description: 'Locking immutable draft contracts and provisioning student assessment assignments',
    icon: Zap,
    badge: 'STAGE 5/5'
  }
];

const TELEMETRY_LOGS = [
  '[RAG_INIT] Initializing semantic vector retrieval engine...',
  '[CHUNKER] Extracting clean text tokens and resolving overlap boundaries...',
  '[EMBED] Computing multi-dimensional dense embeddings...',
  '[GEMINI_AI] Generating grounded pedagogical learning pack...',
  '[ASSESS_GEN] Constructing collective progressive 10-question quiz...',
  '[GUARDRAILS] Evaluating anti-hallucination compliance against source facts...',
  '[DEPLOY_MGR] Provisioning draft asset versions and audit trails...'
];

const GenerationLoadingModal = ({ isOpen, unitTitle = 'Curriculum Lesson', sourceTitle = '', objectivesCount = 2 }) => {
  const [activeStepIdx, setActiveStepIdx] = useState(0);
  const [progressPercent, setProgressPercent] = useState(15);
  const [logIndex, setLogIndex] = useState(0);

  useEffect(() => {
    if (!isOpen) {
      setActiveStepIdx(0);
      setProgressPercent(15);
      setLogIndex(0);
      return;
    }

    // Fast, dynamic step progression timer matching parallel execution speed
    const stepInterval = setInterval(() => {
      setActiveStepIdx((prev) => {
        if (prev < GENERATION_STEPS.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 650);

    // Smooth, fast progress bar advancement
    const progressInterval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 96) {
          return Math.min(96, prev + Math.floor(Math.random() * 12) + 6);
        }
        return prev;
      });
    }, 200);

    // Terminal telemetry rotation
    const logInterval = setInterval(() => {
      setLogIndex((prev) => (prev + 1) % TELEMETRY_LOGS.length);
    }, 450);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearInterval(logInterval);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-xl animate-in fade-in duration-300">
      
      {/* Ambient background glow orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/15 rounded-full blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-neon-amber/10 rounded-full blur-3xl pointer-events-none animate-pulse-glow" style={{ animationDelay: '1s' }} />

      <div className="relative w-full max-w-2xl rounded-3xl glass-panel-accent border border-brand-500/30 shadow-2xl p-6 sm:p-8 overflow-hidden bg-dark-950/95 space-y-6">
        
        {/* Animated Top Header & Multi-Ring Reactor */}
        <div className="flex flex-col sm:flex-row items-center gap-5 pb-4 border-b border-slate-800/90 text-center sm:text-left">
          
          {/* Futuristic Double-Ring Pulsating Reactor */}
          <div className="relative w-20 h-20 shrink-0 flex items-center justify-center">
            {/* Outer spinning dashed ring */}
            <div className="absolute inset-0 rounded-full border-2 border-dashed border-slate-800 animate-spin-slow" />
            {/* Middle counter-spinning ring */}
            <div className="absolute inset-1.5 rounded-full border border-neon-amber/50 animate-spin-reverse-slow" />
            {/* Inner glowing pulse aura */}
            <div className="absolute inset-3 rounded-2xl bg-brand-600/20 animate-pulse-glow blur-sm" />
            {/* Center icon */}
            <div className="relative z-10 w-12 h-12 rounded-2xl bg-dark-900 border border-brand-500/40 flex items-center justify-center text-brand-400 shadow-subtle animate-float">
              <Sparkles className="w-6 h-6 text-brand-200" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-brand-600/15 border border-slate-800 text-brand-200 mb-2">
              <span className="w-2 h-2 rounded-full bg-brand-600 animate-ping" />
              AI SYNTHESIS IN PROGRESS
            </div>
            <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
              Generating Lesson: <span className="text-brand-200">{unitTitle || 'Curriculum Pack'}</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-mono">
              {sourceTitle ? `Knowledge Source: "${sourceTitle}" • ` : ''}{objectivesCount} Objective{objectivesCount > 1 ? 's' : ''} Targeted
            </p>
          </div>
        </div>

        {/* Dynamic Glowing Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="text-slate-300 font-semibold flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 text-brand-400 animate-spin" />
              {GENERATION_STEPS[activeStepIdx]?.title}
            </span>
            <span className="text-brand-400 font-bold font-mono text-sm">{progressPercent}%</span>
          </div>

          <div className="w-full h-3 rounded-full bg-dark-900 border border-slate-800 p-0.5 overflow-hidden shadow-inner">
            <div 
              className="h-full rounded-full animate-shimmer transition-all duration-500 ease-out shadow-subtle"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Step-by-Step Interactive Workflow Checklist */}
        <div className="space-y-2.5">
          {GENERATION_STEPS.map((step, idx) => {
            const isCompleted = idx < activeStepIdx;
            const isCurrent = idx === activeStepIdx;
            const isPending = idx > activeStepIdx;
            const StepIcon = step.icon;

            return (
              <div
                key={step.id}
                className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                  isCurrent
                    ? 'bg-brand-600/10 border-brand-500/40 shadow-subtle translate-x-1'
                    : isCompleted
                    ? 'bg-dark-900/90 border-emerald-500/30 text-slate-300'
                    : 'bg-dark-950/60 border-slate-800/60 text-slate-500 opacity-60'
                }`}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                    isCurrent
                      ? 'bg-brand-600 text-white border-brand-500/50 shadow-sm animate-pulse'
                      : isCompleted
                      ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                      : 'bg-dark-900 text-slate-600 border-slate-800'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-white' : 'text-slate-500'}`} />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${isCurrent ? 'text-white' : isCompleted ? 'text-slate-200' : 'text-slate-500'}`}>
                        {step.title}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400 hidden sm:inline">
                        {step.badge}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">
                      {step.description}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 text-right font-mono text-[11px]">
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 text-brand-400 font-bold animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-600 animate-ping" /> Working...
                    </span>
                  )}
                  {isCompleted && (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      Ready ✓
                    </span>
                  )}
                  {isPending && (
                    <span className="text-slate-600">Queued</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Live Terminal Telemetry Output Box */}
        <div className="p-3 rounded-2xl bg-dark-950 border border-slate-800/90 flex items-center gap-2.5 font-mono text-[11px] text-slate-400 shadow-inner overflow-hidden">
          <div className="w-2 h-2 rounded-full bg-brand-600 shrink-0 animate-ping" />
          <span className="text-brand-300 shrink-0 font-bold">[ENGINE]</span>
          <span className="text-slate-300 truncate font-mono">
            {TELEMETRY_LOGS[logIndex]}
          </span>
        </div>

      </div>
    </div>
  );
};

export default GenerationLoadingModal;
