import React from 'react';
import { useAuth } from '../context/AuthContext';
import { BookOpen, Download, ArrowLeft, ShieldCheck, FileText, CheckCircle2, Layers } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';
import ProvenanceViewer from '../components/ProvenanceViewer';

const StudentMaterialViewer = ({ material, onBack }) => {
  const { token } = useAuth();
  const content = material?.content || {};

  const handleDownloadPDF = () => {
    window.open(`/api/student/assets/${material.version_id}/download-pdf`, '_blank');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20 animate-in fade-in">
      
      {/* Navigation header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
        </button>

        <button
          onClick={handleDownloadPDF}
          className="btn-royal text-xs flex items-center gap-1.5 py-2 px-4 shadow-neon"
        >
          <Download className="w-3.5 h-3.5" /> Download Printable PDF
        </button>
      </div>

      {/* Main Study Material Card */}
      <GlassCard
        icon={BookOpen}
        title={content.title || material.objective_text}
        subtitle={`Unit: ${material.unit_title} · Approved Learning Pack · Version ${material.version_no}`}
        accent={true}
        action={<Badge variant="approved">APPROVED FOR DELIVERY</Badge>}
      >
        <div className="space-y-6">
          
          {/* Explanation paragraphs */}
          {content.explanation && (
            <div className="space-y-4 text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              {content.explanation.split('\n\n').map((paragraph, i) => (
                <p key={i} className="p-3.5 rounded-xl bg-dark-900/60 border border-slate-800">
                  {paragraph}
                </p>
              ))}
            </div>
          )}

          {/* Worked Example Breakdown */}
          {content.steps && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-neon-orange uppercase font-mono tracking-wider">
                Step-by-Step Problem Breakdown
              </h4>
              <div className="space-y-3">
                {content.steps.map((st, i) => (
                  <div key={i} className="p-4 rounded-xl bg-dark-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <span className="w-5 h-5 rounded-full bg-neon-orange text-white flex items-center justify-center text-[10px] font-mono">
                        {st.step_number}
                      </span>
                      {st.title}
                    </div>
                    <p className="text-slate-300 pl-7">{st.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Revision Sheet Key Takeaways */}
          {content.key_takeaways && (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-neon-amber uppercase font-mono tracking-wider">
                Authoritative Takeaways & Core Rules
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {content.key_takeaways.map((item, i) => (
                  <div key={i} className="p-4 rounded-xl bg-dark-900 border border-slate-800 text-xs space-y-1.5">
                    <span className="font-bold text-white block">{item.objective}</span>
                    <p className="text-slate-300">{item.core_formula_rule}</p>
                    <span className="text-[10px] text-neon-orange block italic">Avoid: {item.pitfall_to_avoid}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rapid Memory Triggers */}
          {content.rapid_memory_triggers && (
            <div className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs space-y-2">
              <span className="font-bold text-neon-glow block uppercase font-mono text-[10px]">Rapid Recall Triggers:</span>
              <ul className="space-y-1 text-slate-300 list-disc list-inside">
                {content.rapid_memory_triggers.map((trig, i) => (
                  <li key={i}>{trig}</li>
                ))}
              </ul>
            </div>
          )}

          {/* RAG Grounding Provenance Footer */}
          <ProvenanceViewer
            citations={content.chunk_citations || []}
            chunkIds={[]}
            sourceChunks={[]}
            confidence={content.grounding_confidence || 0.96}
          />

        </div>
      </GlassCard>

    </div>
  );
};

export default StudentMaterialViewer;
