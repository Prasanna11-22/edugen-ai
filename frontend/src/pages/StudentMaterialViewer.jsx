import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BookOpen, 
  Download, 
  ArrowLeft, 
  ShieldCheck, 
  FileText, 
  CheckCircle2, 
  Layers,
  Sparkles,
  FileCheck,
  HelpCircle,
  Library,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const StudentMaterialViewer = ({ material, onBack }) => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState('all'); // all, explanation, examples, revision, practice, glossary
  const [revealedAnswers, setRevealedAnswers] = useState({});

  const content = material?.content || {};
  const explanation = content.explanation || '';
  const summaryPoints = content.short_summary_points || content.key_points || [];
  const steps = content.steps || [];
  const keyTakeaways = content.key_takeaways || [];
  const memoryTriggers = content.rapid_memory_triggers || content.quick_recall_bullets || [];
  const questions = content.questions || [];
  const glossary = content.glossary || content.glossary_terms || [];
  const citations = content.chunk_citations || [];

  const handleDownloadPDF = () => {
    if (material.unit_id) {
      window.open(`/api/student/units/${material.unit_id}/download-pdf`, '_blank');
    } else {
      window.open(`/api/student/assets/${material.version_id}/download-pdf`, '_blank');
    }
  };

  const toggleAnswer = (idx) => {
    setRevealedAnswers(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  const tabs = [
    { id: 'all', label: 'All-in-One Pack', icon: Layers },
    ...(explanation ? [{ id: 'explanation', label: 'Concept Explanation', icon: FileText }] : []),
    ...(steps.length > 0 ? [{ id: 'examples', label: 'Worked Steps', icon: Sparkles }] : []),
    ...(keyTakeaways.length > 0 || memoryTriggers.length > 0 ? [{ id: 'revision', label: 'Revision & Rules', icon: FileCheck }] : []),
    ...(questions.length > 0 ? [{ id: 'practice', label: `Practice Qs (${questions.length})`, icon: HelpCircle }] : []),
    ...(glossary.length > 0 ? [{ id: 'glossary', label: `Glossary (${glossary.length})`, icon: Library }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24 animate-in fade-in">
      
      {/* Navigation Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <button
          onClick={onBack}
          className="px-3.5 py-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-2 transition-all border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <div className="flex items-center gap-3">
          <Badge variant="approved">VERIFIED FULL PACK</Badge>
          <button
            onClick={handleDownloadPDF}
            className="btn-royal text-xs flex items-center gap-1.5 py-2 px-4 shadow-neon"
          >
            <Download className="w-3.5 h-3.5" /> Download Full Pack PDF
          </button>
        </div>
      </div>

      {/* Main Pack Header Card */}
      <div className="rounded-3xl glass-panel-accent p-6 sm:p-8 border border-neon-orange/40 shadow-neon space-y-4 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-orange via-neon-amber to-neon-gold" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-neon-amber block mb-1">
              {material.unit_title} · Complete Study Material
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">
              {content.title || `Complete Study Pack: ${material.unit_title}`}
            </h2>
            <p className="text-xs text-slate-300 mt-1">
              Authoritative multi-asset curriculum pack approved for classroom study and examination prep.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-dark-950 border border-slate-800 text-xs font-mono text-neon-orange font-bold">
              Version {material.version_no || 1}
            </span>
          </div>
        </div>

        {/* Section Navigation Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-t border-slate-800/80 pt-4 max-w-full">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                  isActive
                    ? 'bg-neon-orange text-white shadow-neon-sm font-bold'
                    : 'bg-dark-950 hover:bg-dark-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: CONCEPT EXPLANATION */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'explanation') && explanation && (
        <GlassCard
          icon={FileText}
          title="Core Concept Explanation"
          subtitle="In-depth conceptual walkthrough grounded strictly in source syllabus"
          accent={true}
        >
          <div className="space-y-5">
            <div className="space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              {explanation.split('\n\n').map((paragraph, i) => (
                <p key={i} className="p-4 rounded-xl bg-dark-950/80 border border-slate-800/90 leading-relaxed">
                  {paragraph}
                </p>
              ))}
            </div>

            {summaryPoints.length > 0 && (
              <div className="space-y-2.5 pt-2">
                <span className="text-xs font-bold text-neon-orange uppercase font-mono tracking-wider block">
                  Key Takeaway Points
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {summaryPoints.map((pt, idx) => (
                    <div key={idx} className="p-3.5 rounded-xl bg-dark-950 border border-slate-800/90 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-neon-orange/20 text-neon-glow flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                          {idx + 1}
                        </span>
                        <span className="font-bold text-xs text-white">
                          {pt.topic || `Key Point #${idx + 1}`}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 pl-7 leading-relaxed font-sans">
                        {pt.summary || pt}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: WORKED STEP-BY-STEP EXAMPLES */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'examples') && steps.length > 0 && (
        <GlassCard
          icon={Sparkles}
          title="Worked Step-by-Step Execution"
          subtitle="Concrete technical walkthrough with methodology and validation criteria"
          accent={true}
        >
          <div className="space-y-4">
            {content.problem_statement && (
              <div className="p-4 rounded-xl bg-dark-950 border border-neon-orange/30 text-xs space-y-1.5">
                <span className="font-bold text-neon-orange uppercase font-mono text-[10px]">Problem Context:</span>
                <p className="text-slate-200 font-sans leading-relaxed">{content.problem_statement}</p>
              </div>
            )}

            <div className="space-y-3">
              {steps.map((st, i) => (
                <div key={i} className="p-4 sm:p-5 rounded-xl bg-dark-950 border border-slate-800 space-y-2 hover:border-slate-700 transition-all">
                  <div className="flex items-center gap-2.5 font-bold text-white text-xs sm:text-sm">
                    <span className="w-6 h-6 rounded-lg bg-neon-orange/20 text-neon-glow border border-neon-orange/40 flex items-center justify-center text-xs font-mono shrink-0">
                      {st.step_number || i + 1}
                    </span>
                    <span>{st.title}</span>
                  </div>
                  <p className="text-xs text-slate-300 pl-8 leading-relaxed font-sans">
                    {st.description}
                  </p>
                  {st.validation_check && (
                    <div className="ml-8 p-2.5 rounded-lg bg-dark-900 border border-slate-800 text-[11px] text-emerald-400 font-mono flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span>Validation: {st.validation_check}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {content.method_explanation && (
              <div className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs space-y-1">
                <span className="font-bold text-slate-300 uppercase font-mono text-[10px]">Methodology Takeaway:</span>
                <p className="text-slate-400">{content.method_explanation}</p>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: REVISION SHEET & INVARIANTS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'revision') && (keyTakeaways.length > 0 || memoryTriggers.length > 0) && (
        <GlassCard
          icon={FileCheck}
          title="High-Yield Revision & Core Rules"
          subtitle="Exam recall triggers, invariant formulas, and critical pitfalls to avoid"
          accent={true}
        >
          <div className="space-y-5">
            {keyTakeaways.length > 0 && (
              <div className="space-y-3">
                <span className="text-xs font-bold text-neon-amber uppercase font-mono tracking-wider block">
                  Core Architectural Rules & Formulas
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {keyTakeaways.map((item, i) => (
                    <div key={i} className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs space-y-2">
                      <span className="font-bold text-white block text-neon-glow font-mono text-xs">
                        {item.concept || item.objective || `Rule #${i + 1}`}
                      </span>
                      <p className="text-slate-300 leading-relaxed font-sans">{item.core_formula_rule}</p>
                      {item.pitfall_to_avoid && (
                        <div className="p-2.5 rounded-lg bg-rose-950/20 border border-rose-500/20 text-[11px] text-rose-300 flex items-start gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-rose-400">Pitfall: </span>
                            <span>{item.pitfall_to_avoid}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {memoryTriggers.length > 0 && (
              <div className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs space-y-2.5">
                <span className="font-bold text-neon-glow uppercase font-mono text-[10px] flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Rapid Exam Recall Points:
                </span>
                <ul className="space-y-2 text-slate-300 pl-1">
                  {memoryTriggers.map((trig, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-neon-orange font-bold font-mono">▸</span>
                      <span>{trig}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </GlassCard>
      )}

      {/* ========================================================================= */}
      {/* SECTION 4: PRACTICE & FORMATIVE QUESTIONS */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'practice') && questions.length > 0 && (
        <GlassCard
          icon={HelpCircle}
          title={`Practice Questions (${questions.length} Questions)`}
          subtitle="Formative assessment set with distractor rationales and step solutions"
          accent={true}
        >
          <div className="space-y-4">
            {questions.map((q, qIdx) => {
              const isRevealed = revealedAnswers[qIdx];
              return (
                <div key={qIdx} className="p-4 sm:p-5 rounded-2xl bg-dark-950 border border-slate-800 space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      <span className="w-6 h-6 rounded-lg bg-dark-900 border border-slate-700 flex items-center justify-center font-mono font-bold text-xs text-neon-orange shrink-0">
                        {qIdx + 1}
                      </span>
                      <h4 className="font-semibold text-xs sm:text-sm text-white leading-relaxed">
                        {q.question}
                      </h4>
                    </div>
                    {q.cognitive_tier && (
                      <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-dark-900 border border-slate-700 text-slate-300 shrink-0">
                        {q.cognitive_tier}
                      </span>
                    )}
                  </div>

                  {/* Options List */}
                  {q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8">
                      {Object.entries(q.options).map(([optKey, optVal]) => {
                        const isCorrect = isRevealed && (q.correct_answer === optKey || q.correct_option === optKey);
                        return (
                          <div
                            key={optKey}
                            className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                              isCorrect
                                ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-semibold'
                                : 'bg-dark-900 border-slate-800 text-slate-300'
                            }`}
                          >
                            <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                              isCorrect ? 'bg-emerald-500 text-black' : 'bg-dark-800 text-slate-400'
                            }`}>
                              {optKey}
                            </span>
                            <span>{optVal}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reveal Solution Toggle */}
                  <div className="pl-8 pt-2">
                    <button
                      type="button"
                      onClick={() => toggleAnswer(qIdx)}
                      className="px-3 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 text-slate-400 hover:text-white border border-slate-800 text-[11px] font-medium flex items-center gap-1.5 transition"
                    >
                      {isRevealed ? <EyeOff className="w-3.5 h-3.5 text-neon-orange" /> : <Eye className="w-3.5 h-3.5 text-neon-orange" />}
                      <span>{isRevealed ? 'Hide Solution' : 'View Correct Answer & Rationale'}</span>
                    </button>

                    {isRevealed && (
                      <div className="mt-3 p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-500/30 text-xs text-slate-300 space-y-1.5 animate-in fade-in">
                        <div className="flex items-center gap-2 font-bold text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Correct Answer: Option [{q.correct_answer || q.correct_option}]</span>
                        </div>
                        {q.explanation && (
                          <p className="text-slate-300 text-[11px] leading-relaxed pl-5 font-sans">
                            {q.explanation}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {/* ========================================================================= */}
      {/* SECTION 5: DOMAIN GLOSSARY */}
      {/* ========================================================================= */}
      {(activeTab === 'all' || activeTab === 'glossary') && glossary.length > 0 && (
        <GlassCard
          icon={Library}
          title={`Canonical Domain Glossary (${glossary.length} Terms)`}
          subtitle="Authoritative terminology extracted directly from the verified source"
          accent={true}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {glossary.map((item, gIdx) => (
              <div key={gIdx} className="p-4 rounded-xl bg-dark-950 border border-slate-800 space-y-1.5 hover:border-slate-700 transition-all">
                <span className="font-bold text-white text-xs text-neon-orange font-mono block">
                  {item.term}
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.canonical_wording}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Citations Footer */}
      {citations.length > 0 && (
        <div className="p-4 rounded-2xl bg-dark-900/60 border border-slate-800/80 text-xs text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <span>Grounding Provenance: <strong className="text-slate-300 font-mono">{citations.length} Verified Source Chunks</strong></span>
          <span className="font-mono text-[11px] text-neon-amber">Immutable Ground-Truth Learning Material</span>
        </div>
      )}

    </div>
  );
};

export default StudentMaterialViewer;
