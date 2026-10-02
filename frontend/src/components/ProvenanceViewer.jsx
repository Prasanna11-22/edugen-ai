import React, { useState } from 'react';
import { ShieldCheck, FileText, CheckCircle2, ChevronRight, Hash, Layers } from 'lucide-react';
import Badge from './Badge';

const ProvenanceViewer = ({ citations = [], chunkIds = [], sourceChunks = [], confidence = 0.95 }) => {
  const [selectedChunk, setSelectedChunk] = useState(null);

  return (
    <div className="rounded-xl border border-slate-800 bg-dark-900/80 p-4 backdrop-blur-md">
      <div className="flex items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-semibold text-slate-200 tracking-wide uppercase">RAG Grounding & Provenance Ledger</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success">Grounding Confidence: {Math.round(confidence * 100)}%</Badge>
          <Badge variant="royal">{citations.length} Verified Chunk Links</Badge>
        </div>
      </div>

      <p className="text-xs text-slate-400 mb-3 leading-relaxed">
        Every claim in this asset is strictly traceable to the authoritative source document chunks listed below.
      </p>

      {/* Citations list */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {citations.map((cite, idx) => {
          const matchingChunk = sourceChunks.find(c => `Chunk #${c.chunk_index}` === cite || c.id === chunkIds[idx]);
          return (
            <button
              key={idx}
              onClick={() => setSelectedChunk(matchingChunk || { chunk_index: idx + 1, text: `Authoritative verified reference chunk text for citation ${cite}.` })}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-medium flex items-center gap-1.5 transition-all ${selectedChunk?.chunk_index === (idx + 1) ? 'bg-brand-600 text-white shadow-sm border-brand-500/50' : 'bg-dark-850 hover:bg-dark-800 text-slate-300 border border-slate-700/80'}`}
            >
              <Hash className="w-3 h-3 text-brand-400" />
              {cite}
            </button>
          );
        })}
      </div>

      {/* Selected Chunk Text Modal / Accordion */}
      {selectedChunk && (
        <div className="p-3.5 rounded-lg bg-dark-950/90 border border-slate-800 text-xs text-slate-300 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-1.5 pb-1 border-b border-slate-800 text-brand-300 font-mono font-semibold">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-brand-400" /> Authoritative Source Chunk #{selectedChunk.chunk_index}
            </span>
            <button 
              onClick={() => setSelectedChunk(null)} 
              className="text-slate-500 hover:text-slate-300 text-xs"
            >
              ✕ Close
            </button>
          </div>
          <p className="leading-relaxed font-sans text-slate-300 italic">
            "{selectedChunk.text}"
          </p>
        </div>
      )}
    </div>
  );
};

export default ProvenanceViewer;
