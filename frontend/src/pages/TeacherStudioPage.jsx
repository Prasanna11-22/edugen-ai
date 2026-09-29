import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Sparkles, Upload, FileText, CheckCircle2, AlertTriangle, Layers, 
  BookOpen, Edit3, RefreshCw, Send, Check, ShieldCheck, Hash, Target, 
  ArrowRight, ShieldAlert, FileCode, CheckSquare, Plus, Trash2, Calendar, Clock,
  Eye, BarChart3, Users, ChevronRight, FileCheck, Search, HelpCircle, Library, Database, Lock, X, Key, Lightbulb
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';
import ProvenanceViewer from '../components/ProvenanceViewer';
import GuardrailAlerts from '../components/GuardrailAlerts';

const TeacherStudioPage = ({ selectedUnitId, onBack, onNavigateClassrooms }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  
  // Studio Sub-Tabs: 'ingest', 'units', 'review', 'guardrails', 'classrooms', 'heatmap'
  const [activeStudioTab, setActiveStudioTab] = useState(selectedUnitId ? 'review' : 'ingest');
  
  const [currentUnitId, setCurrentUnitId] = useState(selectedUnitId);
  const [selectedReviewObjectiveId, setSelectedReviewObjectiveId] = useState(null);
  const [unitDetails, setUnitDetails] = useState(null);
  const [allTeacherUnits, setAllTeacherUnits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // Step 1 State & Chunker Inspector
  const [unitTitle, setUnitTitle] = useState('');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceFile, setSourceFile] = useState(null);
  const [sourceRawText, setSourceRawText] = useState('');
  const [previewChunksData, setPreviewChunksData] = useState(null);
  const [parsingChunks, setParsingChunks] = useState(false);

  // Step 2 State
  const [objectives, setObjectives] = useState([
    { text: '', bloom_level: 'Understand', target_level: 'High School', quiz_count: 3, difficulty: 'Medium' },
    { text: '', bloom_level: 'Apply', target_level: 'High School', quiz_count: 3, difficulty: 'Medium' }
  ]);

  // Step 3 State
  const [assignClassrooms, setAssignClassrooms] = useState([]);
  const [selectedClassroomIds, setSelectedClassroomIds] = useState([]);
  const [dueDate, setDueDate] = useState('');
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [autoApproveOnAssign, setAutoApproveOnAssign] = useState(true);
  const [assigning, setAssigning] = useState(false);

  // Review Studio Tab
  const [activeAssetTab, setActiveAssetTab] = useState('explanation'); // explanation, example, quiz, revision_sheet, source_chunks, glossary
  const [quizCountToGenerate, setQuizCountToGenerate] = useState(3);
  const [quizDifficultyToGenerate, setQuizDifficultyToGenerate] = useState('Medium');
  const [editingContent, setEditingContent] = useState(false);
  const [editText, setEditText] = useState('');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState(null);
  const [deletingUnit, setDeletingUnit] = useState(false);

  useEffect(() => {
    fetchClassrooms();
    fetchAllUnits();
  }, []);

  useEffect(() => {
    if (currentUnitId) {
      fetchUnitDetails(currentUnitId);
    }
  }, [currentUnitId]);

  const fetchAllUnits = async () => {
    try {
      const res = await fetch('/api/teacher/units', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAllTeacherUnits(await res.json());
      }
    } catch (err) {
      console.error("Error fetching units", err);
    }
  };

  const fetchUnitDetails = async (unitId) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/teacher/units/${unitId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUnitDetails(data);
        if (data.objectives && data.objectives.length > 0) {
          setSelectedReviewObjectiveId(prev => prev || data.objectives[0].id);
        }
        if (data.assigned_classrooms) {
          setSelectedClassroomIds(data.assigned_classrooms.map(c => c.id));
        }
      }
    } catch (err) {
      console.error("Fetch unit details error", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassrooms = async () => {
    try {
      const res = await fetch('/api/teacher/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAssignClassrooms(data);
      }
    } catch (err) {
      console.error("Fetch classrooms error", err);
    }
  };

  const safeApiResponse = async (res, defaultErrMsg = "Request failed") => {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      if (!res.ok) {
        throw new Error(text && text.length < 200 ? text : `Server Error (${res.status}): Please ensure backend is running.`);
      }
      return text;
    }
  };

  // Instant Chunk Parser Handler
  const handleParseAndChunkSource = async () => {
    if (!sourceFile && !sourceRawText.trim()) {
      showToast("Please choose a PDF file or paste text to parse.", "error");
      return;
    }

    setParsingChunks(true);
    try {
      const formData = new FormData();
      if (sourceFile) formData.append('file', sourceFile);
      if (sourceRawText) formData.append('raw_text', sourceRawText);

      const res = await fetch('/api/teacher/preview-chunks', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await safeApiResponse(res, 'Parsing failed');
      if (!res.ok) throw new Error(data.detail || data.message || 'Parsing failed');

      setPreviewChunksData(data);
      showToast(`Extracted ${data.total_chunks} semantic chunks (${data.total_tokens_estimated} tokens)!`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setParsingChunks(false);
    }
  };

  const handleCreateUnitAndUpload = async (e) => {
    e.preventDefault();
    if (!unitTitle.trim() || !sourceTitle.trim()) {
      showToast("Please specify unit and source titles.", "error");
      return;
    }
    if (!sourceFile && !sourceRawText.trim()) {
      showToast("Please upload a PDF source document or paste authoritative text.", "error");
      return;
    }

    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append('title', unitTitle);
      formData.append('source_title', sourceTitle);
      const formattedObjectives = objectives.map(o => ({
        text: o.text,
        bloom_level: o.bloom_level,
        target_level: o.target_level,
        constraints: {
          answer_reveal: o.answer_reveal || 'post_submission',
          quiz_count: Number(o.quiz_count) || 3,
          difficulty: o.difficulty || 'Medium'
        }
      }));
      formData.append('objectives_json', JSON.stringify(formattedObjectives));
      if (sourceFile) formData.append('file', sourceFile);
      if (sourceRawText) formData.append('raw_text', sourceRawText);

      const res = await fetch('/api/teacher/units/upload-and-create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      const data = await safeApiResponse(res, 'Upload failed');
      if (!res.ok) throw new Error(data.detail || data.message || 'Upload failed');

      const newUnitId = data.unit_id;
      setCurrentUnitId(newUnitId);
      
      // Immediately generate full pack in Draft mode for teacher review
      await handleGenerateFullPackWithUnit(newUnitId);
      await fetchAllUnits();
      setActiveStudioTab('review');
    } catch (err) {
      showToast(err.message, "error");
      setGenerating(false);
    }
  };

  const handleGenerateFullPackWithUnit = async (unitId) => {
    setGenerating(true);
    try {
      const res = await fetch('/api/teacher/generate-learning-pack', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ unit_id: unitId })
      });
      const data = await safeApiResponse(res, 'Generation failed');
      if (!res.ok) throw new Error(data.detail || data.message || 'Generation failed');

      showToast("Full learning pack generated in Draft mode! Please review before approving.", "success");
      await fetchUnitDetails(unitId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleAssignUnitToClassrooms = async () => {
    if (!currentUnitId) return;
    if (selectedClassroomIds.length === 0) {
      showToast("Please select at least one classroom to assign.", "error");
      return;
    }
    setAssigning(true);
    try {
      const res = await fetch('/api/teacher/units/assign-to-classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          unit_id: currentUnitId,
          classroom_ids: selectedClassroomIds.map(Number),
          auto_approve: autoApproveOnAssign,
          due_date: dueDate || null,
          max_attempts: maxAttempts,
          time_limit_minutes: Number(timeLimitMinutes) || 15
        })
      });
      const data = await safeApiResponse(res, 'Assignment failed');
      if (!res.ok) throw new Error(data.detail || data.message || 'Assignment failed');
      showToast(data.message || "Assigned successfully", "success");
      setShowAssignModal(false);
      await fetchUnitDetails(currentUnitId);
      await fetchAllUnits();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setAssigning(false);
    }
  };

  const handleSingleItemRegenerate = async (assetType, objectiveId, customQuizCount = null, customDifficulty = null) => {
    setGenerating(true);
    try {
      const payload = {
        unit_id: currentUnitId,
        regenerate_type: assetType,
        target_objective_id: objectiveId
      };
      if (customQuizCount) {
        payload.quiz_count = Number(customQuizCount);
      }
      if (customDifficulty) {
        payload.difficulty = customDifficulty;
      } else if (assetType === 'quiz') {
        payload.difficulty = quizDifficultyToGenerate;
      }
      const res = await fetch('/api/teacher/regenerate-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await safeApiResponse(res, 'Regeneration failed');
      if (!res.ok) throw new Error(data.detail || data.message || 'Regeneration failed');
      showToast(`Regenerated ${assetType} as immutable Version ${data.version_no}`, "success");
      await fetchUnitDetails(currentUnitId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };

  const handleApproveAsset = async (versionId) => {
    try {
      const res = await fetch(`/api/teacher/asset-versions/${versionId}/approve`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ status: 'approved' })
      });
      if (res.ok) {
        showToast("Asset approved! Ready for classroom release.", "success");
        await fetchUnitDetails(currentUnitId);
      } else {
        const data = await safeApiResponse(res, 'Approval failed');
        showToast(data.detail || data.message || "Approval failed", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleApproveAllAssets = async () => {
    if (!currentUnitId) return;
    try {
      const res = await fetch(`/api/teacher/units/${currentUnitId}/approve-all`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        }
      });
      if (res.ok) {
        const data = await safeApiResponse(res);
        showToast(data.message || "All assets in pack approved!", "success");
        await fetchUnitDetails(currentUnitId);
      } else {
        const data = await safeApiResponse(res, 'Approval failed');
        showToast(data.detail || data.message || "Approval failed", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleDeleteUnitClick = (e, unitId, unitTitle) => {
    if (e) e.stopPropagation();
    const titleClean = unitTitle || 'Curriculum Lesson';
    setUnitToDelete({ id: unitId, title: titleClean });
  };

  const confirmDeleteUnit = async () => {
    if (!unitToDelete) return;
    setDeletingUnit(true);
    try {
      const res = await fetch(`/api/teacher/units/${unitToDelete.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await safeApiResponse(res);
        showToast(data.message || `Lesson "${unitToDelete.title}" removed successfully.`, "success");
        if (currentUnitId === unitToDelete.id) {
          setCurrentUnitId(null);
          setUnitDetails(null);
          setActiveStudioTab('units');
        }
        setUnitToDelete(null);
        await fetchAllUnits();
      } else {
        const data = await safeApiResponse(res);
        showToast(data.detail || data.message || "Failed to delete lesson", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setDeletingUnit(false);
    }
  };

  const handleSaveEdit = async (versionId) => {
    try {
      const parsed = JSON.parse(editText);
      const res = await fetch(`/api/teacher/asset-versions/${versionId}/edit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content: parsed })
      });
      if (res.ok) {
        const data = await safeApiResponse(res);
        showToast(`Saved as immutable Version ${data.version_no}`, "success");
        setEditingContent(false);
        await fetchUnitDetails(currentUnitId);
      }
    } catch (err) {
      showToast("Invalid JSON syntax or save error.", "error");
    }
  };

  const addObjective = () => {
    setObjectives([...objectives, { text: '', bloom_level: 'Apply', target_level: 'High School', quiz_count: 3, difficulty: 'Medium' }]);
  };

  const removeObjective = (index) => {
    if (objectives.length <= 2) {
      showToast("Minimum 2 objectives required", "info");
      return;
    }
    setObjectives(objectives.filter((_, i) => i !== index));
  };

  const updateObjective = (index, field, value) => {
    const updated = [...objectives];
    updated[index][field] = value;
    setObjectives(updated);
  };

  // Find active asset in unit details matching current tab and objective
  const getActiveAsset = () => {
    if (!unitDetails?.assets) return null;
    if (selectedReviewObjectiveId) {
      const match = unitDetails.assets.find(a => a.type === activeAssetTab && a.objective_id === selectedReviewObjectiveId);
      if (match) return match;
    }
    return unitDetails.assets.find(a => a.type === activeAssetTab);
  };

  const currentActiveAsset = getActiveAsset();

  return (
    <div className="space-y-8 pb-20 animate-in fade-in">
      
      {/* Top Banner with Authority Access Header */}
      <div className="rounded-3xl glass-panel-accent p-8 border border-neon-orange/40 shadow-neon space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-neon-amber font-bold">
                TEACHER CONTROLLED RAG STUDIO
              </span>
              <span className="text-slate-600">·</span>
              <Badge variant="approved">1 Trusted Source Boundary</Badge>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white">
              Curriculum Pack & Objective Mastery Studio
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl">
              Turn verified source documents into objective-aligned learning packs gated behind teacher review.
            </p>
          </div>

          {currentUnitId && unitDetails && (
            <div className="shrink-0 flex items-center gap-2">
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn-royal text-xs flex items-center gap-1.5 py-2.5 px-4 shadow-neon"
              >
                <Send className="w-3.5 h-3.5" /> Assign to Classroom
              </button>
            </div>
          )}
        </div>

        {/* 6 Unified Studio Navigation Sub-Tabs matching reference mockup */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/80">
          <button
            onClick={() => setActiveStudioTab('units')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'units'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <Layers className="w-3.5 h-3.5" /> Curriculum Units ({allTeacherUnits.length})
          </button>

          <button
            onClick={() => {
              setCurrentUnitId(null);
              setUnitDetails(null);
              setActiveStudioTab('ingest');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'ingest'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" /> Ingest & Build Contract
          </button>

          <button
            onClick={() => {
              if (allTeacherUnits.length > 0 && !currentUnitId) {
                setCurrentUnitId(allTeacherUnits[0].id);
              }
              setActiveStudioTab('review');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'review'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" /> Review Studio
          </button>

          <button
            onClick={() => {
              if (allTeacherUnits.length > 0 && !currentUnitId) {
                setCurrentUnitId(allTeacherUnits[0].id);
              }
              setActiveStudioTab('guardrails');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'guardrails'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" /> 6 Quality Guardrails
          </button>

          <button
            onClick={() => {
              if (onNavigateClassrooms) onNavigateClassrooms();
              else setActiveStudioTab('classrooms');
            }}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'classrooms'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" /> Classrooms & Roster
          </button>

          <button
            onClick={() => setActiveStudioTab('heatmap')}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
              activeStudioTab === 'heatmap'
                ? 'bg-neon-orange text-white shadow-neon-sm'
                : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" /> Objective Mastery Heatmap
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUB-TAB 1: INGEST & BUILD CONTRACT (Creation Wizard with Chunker Inspector) */}
      {/* ========================================================================= */}
      {activeStudioTab === 'ingest' && (
        <form onSubmit={handleCreateUnitAndUpload} className="space-y-8 animate-in fade-in">
          
          {/* STEP 1: Two-Column Upload & Semantic Chunker Inspector */}
          <div className="rounded-2xl glass-panel p-6 sm:p-7 border border-neon-orange/30 shadow-neon space-y-4">
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <Upload className="w-5 h-5 text-neon-orange" />
                  <h3 className="text-lg font-bold text-white">
                    Step 1: Upload Source Document (Trusted Boundary)
                  </h3>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  The uploaded PDF/text is parsed layout-aware into 300-600 token semantic chunks. Every generated sentence is strictly grounded in these chunks.
                </p>
              </div>
              <Badge variant="bloom">Authoritative Ingest</Badge>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
              
              {/* LEFT COLUMN: Inputs & Ingest Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Source Document Title
                  </label>
                  <input
                    type="text"
                    value={sourceTitle}
                    onChange={(e) => {
                      setSourceTitle(e.target.value);
                      if (!unitTitle) setUnitTitle(e.target.value);
                    }}
                    placeholder="e.g. Chapter 4: Thermodynamics & Heat Engines"
                    required
                    className="w-full rounded-xl glass-input p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Knowledge Unit Title
                  </label>
                  <input
                    type="text"
                    value={unitTitle}
                    onChange={(e) => setUnitTitle(e.target.value)}
                    placeholder="e.g. Unit 4: Heat Engines & Entropy Cycles"
                    required
                    className="w-full rounded-xl glass-input p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Upload PDF File
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="px-4 py-2 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-semibold cursor-pointer shadow-neon-sm transition-all shrink-0">
                      Choose File
                      <input
                        type="file"
                        accept=".pdf,.txt"
                        onChange={(e) => setSourceFile(e.target.files[0])}
                        className="hidden"
                      />
                    </label>
                    <span className="text-xs font-mono text-slate-300 truncate">
                      {sourceFile ? sourceFile.name : 'No file chosen'}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Or Paste Raw Curriculum Text
                  </label>
                  <textarea
                    value={sourceRawText}
                    onChange={(e) => setSourceRawText(e.target.value)}
                    placeholder="Paste exact syllabus or textbook content..."
                    rows={5}
                    className="w-full rounded-xl glass-input p-3 text-xs font-mono resize-none leading-relaxed"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleParseAndChunkSource}
                  disabled={parsingChunks || (!sourceFile && !sourceRawText.trim())}
                  className="btn-royal-outline text-xs flex items-center gap-2 py-2.5 px-4 w-full justify-center disabled:opacity-50"
                >
                  {parsingChunks ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" />
                      Parsing, Chunking & Computing Embeddings...
                    </>
                  ) : (
                    <>
                      <Upload className="w-4 h-4 text-neon-orange" />
                      Parse, Chunk & Embed Source
                    </>
                  )}
                </button>
              </div>

              {/* RIGHT COLUMN: Semantic Chunker Inspector Box */}
              <div className="rounded-xl bg-dark-950/90 border border-slate-800 p-4 flex flex-col justify-between min-h-[320px]">
                <div className="space-y-3 flex-1">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="flex items-center gap-2">
                      <FileCode className="w-4 h-4 text-neon-orange" />
                      <span className="text-xs font-mono uppercase tracking-wider text-slate-200 font-bold">
                        Semantic Chunker Inspector
                      </span>
                    </div>
                    {previewChunksData && (
                      <span className="text-[10px] font-mono text-neon-amber px-2 py-0.5 rounded bg-dark-900 border border-slate-800">
                        {previewChunksData.total_chunks} Chunks (~{previewChunksData.total_tokens_estimated} Tokens)
                      </span>
                    )}
                  </div>

                  {!previewChunksData ? (
                    <div className="py-16 text-center text-xs text-slate-500 max-w-xs mx-auto space-y-2">
                      <FileCode className="w-8 h-8 text-slate-700 mx-auto" />
                      <p>
                        Upload or paste source content to preview semantic chunk boundaries and layout extraction.
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[320px] overflow-y-auto space-y-2.5 pr-1">
                      {previewChunksData.chunks.map((c) => (
                        <div
                          key={c.chunk_index}
                          className="p-3 rounded-xl bg-dark-900/90 border border-slate-800/80 space-y-1.5 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="text-neon-orange font-bold">Chunk #{c.chunk_index}</span>
                            <span>{c.token_count} tokens · {c.char_count} chars</span>
                          </div>
                          <p className="text-slate-300 text-[11px] line-clamp-3 leading-relaxed">
                            {c.preview}
                          </p>
                          <div className="pt-1 flex items-center justify-between text-[9px] text-slate-500 border-t border-slate-800/60">
                            <span>Normalized 512-dim TF-IDF Vector</span>
                            <span className="text-emerald-400">✓ Grounded</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                  <span>Layout-Aware 300-600 Token Bounds</span>
                  <span>15% Sliding Overlap</span>
                </div>
              </div>

            </div>
          </div>

          {/* STEP 2: Objective Contract */}
          <GlassCard
            icon={Target}
            title="Step 2: Set Objective Contract (Minimum 2 Objectives)"
            subtitle="Define target learning goals, Bloom cognitive taxonomy levels, and target audience"
          >
            <div className="space-y-4">
              {objectives.map((obj, idx) => (
                <div key={idx} className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-neon-orange">
                      Objective #{idx + 1}
                    </span>
                    {objectives.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeObjective(idx)}
                        className="text-slate-500 hover:text-rose-400 text-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <input
                      type="text"
                      value={obj.text}
                      onChange={(e) => updateObjective(idx, 'text', e.target.value)}
                      placeholder="e.g. Explain how ATP synthase uses proton gradients to generate ATP..."
                      required
                      className="w-full rounded-xl glass-input p-2.5 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Bloom Taxonomy Level</label>
                      <select
                        value={obj.bloom_level}
                        onChange={(e) => updateObjective(idx, 'bloom_level', e.target.value)}
                        className="w-full rounded-xl glass-input p-2 text-xs"
                      >
                        <option value="Remember">Remember (Recall & Definitions)</option>
                        <option value="Understand">Understand (Explanation & Overview)</option>
                        <option value="Apply">Apply (Worked Scenarios)</option>
                        <option value="Analyze">Analyze (Metabolic Flux & Comparisons)</option>
                        <option value="Evaluate">Evaluate (Trade-offs & Constraints)</option>
                        <option value="Create">Create (Synthesis & Design)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-mono text-neon-orange">Difficulty Scope</label>
                      <select
                        value={obj.difficulty || 'Medium'}
                        onChange={(e) => updateObjective(idx, 'difficulty', e.target.value)}
                        className="w-full rounded-xl glass-input p-2 text-xs font-mono font-bold text-neon-amber"
                      >
                        <option value="Easy">Easy (Recall & Fundamentals)</option>
                        <option value="Medium">Medium (Easy + Medium)</option>
                        <option value="Hard">Hard (Easy + Medium + Hard)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Answer-Reveal Policy</label>
                      <select
                        value={obj.answer_reveal || 'post_submission'}
                        onChange={(e) => updateObjective(idx, 'answer_reveal', e.target.value)}
                        className="w-full rounded-xl glass-input p-2 text-xs"
                      >
                        <option value="post_submission">After Submission</option>
                        <option value="immediate">Immediate Feedback</option>
                        <option value="never">Blind Assessment</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1 font-mono text-neon-orange">Quiz Questions Count</label>
                      <select
                        value={obj.quiz_count || 3}
                        onChange={(e) => updateObjective(idx, 'quiz_count', Number(e.target.value))}
                        className="w-full rounded-xl glass-input p-2 text-xs font-mono font-bold text-neon-amber"
                      >
                        {[1, 2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                          <option key={n} value={n}>{n} Questions</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Optional Constraints Fold */}
                  <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                    <span className="text-[10px] font-mono text-slate-400">
                      RAG Retrieval Threshold: <strong className="text-neon-amber font-mono">k=5 chunks (&gt;0.18 sim)</strong>
                    </span>
                    <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> Gap Detection Active
                    </span>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={addObjective}
                className="w-full py-2.5 rounded-xl border border-dashed border-slate-700 hover:border-neon-orange text-xs text-slate-300 hover:text-white transition-all flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-neon-orange" /> Add Another Objective Contract
              </button>
            </div>
          </GlassCard>

          {/* STEP 3: Assign to Classrooms */}
          <GlassCard
            icon={Send}
            title="Step 3: Assign to Classrooms (Immediate Student Access)"
            subtitle="Select the classrooms that will immediately receive this lesson's study materials and formative assessments upon generation."
            accent={true}
          >
            <div className="space-y-4">
              {assignClassrooms.length === 0 ? (
                <div className="p-4 rounded-xl bg-dark-900 border border-slate-800 text-xs text-slate-400 text-center">
                  No active classrooms found. You can generate the lesson now and assign to classrooms later.
                </div>
              ) : (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-xs font-semibold text-slate-300">Select Target Classrooms:</label>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedClassroomIds.length === assignClassrooms.length) {
                          setSelectedClassroomIds([]);
                        } else {
                          setSelectedClassroomIds(assignClassrooms.map(c => c.id));
                        }
                      }}
                      className="text-[11px] text-neon-orange hover:text-neon-amber font-semibold transition-colors"
                    >
                      {selectedClassroomIds.length === assignClassrooms.length ? 'Deselect All' : 'Select All Classrooms'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {assignClassrooms.map((c) => {
                      const isSelected = selectedClassroomIds.includes(c.id);
                      return (
                        <div
                          key={c.id}
                          onClick={() => {
                            setSelectedClassroomIds(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                            isSelected
                              ? 'bg-neon-orange/15 border-neon-orange text-white shadow-neon-sm'
                              : 'bg-dark-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="rounded text-neon-orange focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <div className="font-semibold text-xs text-white">{c.name}</div>
                            <div className="text-[10px] text-slate-400">{c.subject} · Code: <b className="font-mono text-neon-amber">{c.join_code}</b></div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-slate-800">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-neon-orange" /> Assessment Time Limit (Minutes)
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={1}
                          max={180}
                          value={timeLimitMinutes}
                          onChange={(e) => setTimeLimitMinutes(Math.max(1, Number(e.target.value)))}
                          className="w-full rounded-xl glass-input p-2.5 text-xs font-mono text-neon-glow"
                          placeholder="15"
                        />
                        <span className="text-xs text-slate-400 whitespace-nowrap">mins</span>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1.5">Max Attempt Policy</label>
                      <select
                        value={maxAttempts}
                        onChange={(e) => setMaxAttempts(Number(e.target.value))}
                        className="w-full rounded-xl glass-input p-2.5 text-xs"
                      >
                        <option value={1}>1 Attempt Only (Standard Exam)</option>
                        <option value={2}>2 Attempts (Formative Practice)</option>
                        <option value={3}>3 Attempts (Mastery Exploration)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Submit Action */}
          <div className="text-right">
            <button
              type="submit"
              disabled={generating}
              className="btn-royal text-sm px-8 py-3.5 shadow-neon"
            >
              {generating ? (
                <span className="flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" /> Chunking, Generating & Assigning Lesson Pack...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Generate Lesson Pack & Deploy <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </button>
          </div>

        </form>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 2: CURRICULUM UNITS LIST */}
      {/* ========================================================================= */}
      {activeStudioTab === 'units' && (
        <div className="space-y-4 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-neon-orange" />
              <h2 className="text-lg font-bold text-white">All Stored Curriculum Units</h2>
            </div>
            <button
              onClick={() => setActiveStudioTab('ingest')}
              className="btn-royal text-xs flex items-center gap-1.5 py-2 px-4 shadow-neon"
            >
              <Plus className="w-4 h-4" /> Ingest New Source
            </button>
          </div>

          {allTeacherUnits.length === 0 ? (
            <GlassCard className="text-center py-12">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">No Knowledge Units Found</h3>
              <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                Ingest your first syllabus document to generate grounded lesson packs.
              </p>
              <button onClick={() => setActiveStudioTab('ingest')} className="btn-royal text-xs">
                Ingest & Build Contract
              </button>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {allTeacherUnits.map((u) => {
                const isAssigned = u.is_assigned || (u.assigned_classrooms && u.assigned_classrooms.length > 0);
                return (
                  <div
                    key={u.id}
                    onClick={() => {
                      setCurrentUnitId(u.id);
                      setActiveStudioTab('review');
                    }}
                    className="p-5 rounded-2xl glass-panel border border-slate-800 hover:border-neon-orange/50 transition-all cursor-pointer group space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-mono uppercase text-neon-orange font-semibold">
                            Source: {u.source_title}
                          </span>
                          <span className="text-slate-600">·</span>
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(u.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-white group-hover:text-neon-glow transition-colors">
                          {u.title}
                        </h3>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Badge variant={isAssigned ? 'approved' : 'warning'}>
                          {isAssigned ? `Assigned (${u.assigned_classrooms.length} Class)` : 'Draft / Unassigned'}
                        </Badge>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteUnitClick(e, u.id, u.title)}
                          className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-600/30 text-rose-400 hover:text-rose-200 border border-rose-500/30 text-xs font-semibold transition-all flex items-center gap-1"
                          title="Remove lesson and assignments"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remove</span>
                        </button>
                        <button className="px-3 py-1.5 rounded-xl bg-neon-orange/15 text-neon-glow border border-neon-orange/40 text-xs font-semibold group-hover:bg-neon-orange group-hover:text-white transition-all flex items-center gap-1">
                          Open Studio <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {isAssigned && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[10px] font-mono text-slate-400">Assigned to:</span>
                        {u.assigned_classrooms.map((c) => (
                          <span
                            key={c.id}
                            className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono"
                          >
                            {c.name} {c.subject ? `(${c.subject})` : ''}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 text-xs text-slate-400 font-mono pt-1">
                      <span>{u.objectives_count} Objectives</span>
                      <span>·</span>
                      <span>{u.assets_count} Pack Assets Generated</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 3: REVIEW STUDIO & ASSET INSPECTOR */}
      {/* ========================================================================= */}
      {activeStudioTab === 'review' && (
        <div className="space-y-6 animate-in fade-in">
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-5 h-5 animate-spin text-neon-orange" /> Loading learning pack details from PostgreSQL...
            </div>
          ) : !unitDetails ? (
            <GlassCard className="text-center py-16 space-y-3">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto" />
              <h3 className="text-base font-bold text-white">No Unit Selected</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Select an existing unit from Curriculum Units or Ingest a new document.
              </p>
              <button onClick={() => setActiveStudioTab('ingest')} className="btn-royal text-xs">
                + Ingest New Document
              </button>
            </GlassCard>
          ) : (
            <div className="space-y-6">
              
              {/* Unit Title & Asset Sub-Tabs */}
              <div className="p-5 rounded-2xl glass-panel border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] font-mono text-neon-orange uppercase font-bold">
                      Authoritative Source: {unitDetails.source?.title || 'Course Textbook'}
                    </span>
                    <h2 className="text-xl font-bold text-white mt-0.5">{unitDetails.unit?.title || unitDetails.title}</h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleApproveAllAssets}
                      className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5" /> Approve All Assets in Pack
                    </button>
                    <button
                      onClick={() => handleGenerateFullPackWithUnit(unitDetails.unit?.id || unitDetails.id)}
                      disabled={generating}
                      className="px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold border border-slate-700 flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin text-neon-orange' : ''}`} />
                      Regenerate Full Pack
                    </button>
                    <button
                      onClick={() => setShowAssignModal(true)}
                      className="btn-royal text-xs flex items-center gap-1.5 py-1.5 px-3.5"
                    >
                      <Send className="w-3.5 h-3.5" /> Assign to Class
                    </button>
                    <button
                      onClick={(e) => handleDeleteUnitClick(e, unitDetails.unit?.id || unitDetails.id, unitDetails.unit?.title || unitDetails.title)}
                      className="px-3 py-1.5 rounded-xl bg-rose-950/50 hover:bg-rose-600/40 text-rose-300 text-xs font-semibold border border-rose-500/40 flex items-center gap-1.5 transition-all"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Remove Lesson
                    </button>
                  </div>
                </div>

                {/* Aggregated Quality Guardrails Banner (Shown only if there are active flags) */}
                {(() => {
                  const allFlags = (unitDetails.assets || []).flatMap(a => a.latest_version?.quality_flags || []);
                  if (allFlags.length === 0) return null;
                  return (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 space-y-2">
                      <div className="flex items-center justify-between text-xs font-bold text-amber-300">
                        <span className="flex items-center gap-1.5 font-mono">
                          <AlertTriangle className="w-4 h-4 text-amber-400" />
                          Quality Guardrail Alerts ({allFlags.length})
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">Review before approving assets</span>
                      </div>
                      <div className="space-y-1.5 max-h-24 overflow-y-auto">
                        {allFlags.map((f, fIdx) => (
                          <div key={fIdx} className="text-[11px] text-slate-300 flex items-start gap-2 bg-dark-950/80 p-1.5 rounded-lg border border-slate-800">
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono uppercase font-bold shrink-0 ${f.severity === 'error' ? 'bg-rose-950 text-rose-300 border border-rose-500/40' : 'bg-amber-950 text-amber-300 border border-amber-500/40'}`}>
                              {f.flag_type?.replace('_', ' ')}
                            </span>
                            <span className="leading-tight">{f.message}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Objective Selector Bar */}
                {unitDetails.objectives && unitDetails.objectives.length > 0 && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-slate-800/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400 font-medium">Target Learning Objective:</span>
                      <span className="text-[10px] font-mono text-neon-orange">
                        {(unitDetails.assets || []).filter(a => a.objective_id === selectedReviewObjectiveId).length} Assets Generated
                      </span>
                    </div>
                    <div className="flex items-center gap-2 overflow-x-auto pb-1">
                      {unitDetails.objectives.map((obj, oIdx) => {
                        const isSelected = selectedReviewObjectiveId === obj.id;
                        return (
                          <button
                            key={obj.id}
                            onClick={() => {
                              setSelectedReviewObjectiveId(obj.id);
                              setEditingContent(false);
                            }}
                            className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 transition-all text-left whitespace-nowrap border ${
                              isSelected
                                ? 'bg-neon-orange/20 border-neon-orange text-white shadow-neon-sm'
                                : 'bg-dark-900 border-slate-800 text-slate-400 hover:text-white hover:border-slate-700'
                            }`}
                          >
                            <span className="w-5 h-5 rounded-full bg-dark-800 text-neon-orange flex items-center justify-center text-[10px] font-mono font-bold">
                              {oIdx + 1}
                            </span>
                            <span className="max-w-[240px] truncate font-medium">{obj.text}</span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-dark-950 border border-slate-700 text-neon-amber">
                              {obj.bloom_level}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Asset Sub-Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-t border-slate-800/80 pt-3">
                  {[
                    { id: 'explanation', label: 'Concept Explanation', icon: FileText },
                    { id: 'example', label: 'Worked Example', icon: Sparkles },
                    { id: 'quiz', label: 'Formative Quiz', icon: HelpCircle },
                    { id: 'answer_key', label: 'Answer Key', icon: Key },
                    { id: 'revision_sheet', label: 'Revision Sheet', icon: FileCheck },
                    { id: 'glossary', label: 'Domain Glossary', icon: Library },
                    { id: 'source_chunks', label: 'Source Chunks', icon: Database }
                  ].map((tab) => {
                    const IconComponent = tab.icon;
                    const isActive = activeAssetTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveAssetTab(tab.id);
                          setEditingContent(false);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-2 ${
                          isActive
                            ? 'bg-neon-orange text-white shadow-neon-sm font-bold'
                            : 'bg-dark-900 hover:bg-dark-850 text-slate-400 hover:text-white border border-slate-800'
                        }`}
                      >
                        <IconComponent className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Asset Content Inspector & Grounding Provenance */}
              {activeAssetTab === 'glossary' ? (
                <GlassCard
                  icon={BookOpen}
                  title="Canonical Domain Glossary"
                  subtitle="Authoritative terminology extracted directly from source chunks"
                  accent={true}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Total Terms: <strong className="text-white">{unitDetails.glossary?.length || 0}</strong></span>
                      <span className="font-mono text-[10px] text-neon-orange">Immutable ground-truth terminology</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {unitDetails.glossary?.map((item) => (
                        <div key={item.id} className="p-4 rounded-xl bg-dark-950 border border-slate-800 space-y-1.5 hover:border-slate-700 transition-all">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-white text-xs text-neon-orange font-mono">{item.term}</span>
                            <span className="text-[10px] font-mono text-slate-500">ID #{item.id}</span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed font-sans">{item.canonical_wording}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </GlassCard>
              ) : activeAssetTab === 'source_chunks' ? (
                <GlassCard
                  icon={Layers}
                  title="Source Chunks Ledger"
                  subtitle={`Total Chunks: ${unitDetails.source?.chunks?.length || 0} (Indexed & Vector Embedded)`}
                  accent={true}
                >
                  <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                    {unitDetails.source?.chunks?.map((chunk) => (
                      <div key={chunk.id || chunk.chunk_index} className="p-4 rounded-xl bg-dark-950 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs">
                          <span className="font-mono font-bold text-neon-orange flex items-center gap-1.5">
                            <Hash className="w-3.5 h-3.5" /> Chunk #{chunk.chunk_index !== undefined ? chunk.chunk_index + 1 : chunk.id}
                          </span>
                          <span className="font-mono text-[10px] text-slate-400">
                            {chunk.word_count || chunk.text.split(' ').length} words
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-sans leading-relaxed whitespace-pre-wrap">
                          {chunk.text}
                        </p>
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ) : currentActiveAsset ? (
                (() => {
                  const ver = currentActiveAsset.latest_version || currentActiveAsset.current_version || {};
                  const content = ver.content_json || ver.content || {};
                  const obj = unitDetails.objectives?.find(o => o.id === currentActiveAsset.objective_id);
                  const citations = content.chunk_citations || (Array.isArray(ver.chunk_ids) ? ver.chunk_ids.map(id => `Chunk #${id}`) : []);
                  const chunkIds = Array.isArray(ver.chunk_ids) ? ver.chunk_ids : [];
                  const sourceChunks = unitDetails.source?.chunks || [];

                  return (
                    <div className="w-full space-y-6">
                      <div className="w-full space-y-4">
                        <GlassCard
                          icon={BookOpen}
                          title={`${currentActiveAsset.type?.toUpperCase().replace('_', ' ')} (Version ${ver.version_no || 1})`}
                          subtitle={`Target Objective: ${obj?.text || 'Comprehensive Unit Overview'}`}
                          accent={true}
                          action={
                            <div className="flex items-center gap-2">
                              <Badge variant={ver.status === 'approved' ? 'approved' : 'warning'}>
                                {ver.status === 'approved' ? 'APPROVED' : 'DRAFT'}
                              </Badge>
                              {ver.status !== 'approved' && ver.id && (
                                <button
                                  onClick={() => handleApproveAsset(ver.id)}
                                  className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition-all"
                                >
                                  <Check className="w-3 h-3" /> Approve Asset
                                </button>
                              )}
                            </div>
                          }
                        >
                          <div className="space-y-4">
                            {editingContent ? (
                              <div className="space-y-3">
                                <textarea
                                  value={editText}
                                  onChange={(e) => setEditText(e.target.value)}
                                  rows={16}
                                  className="w-full rounded-xl glass-input p-3 text-xs font-mono resize-none leading-relaxed"
                                />
                                <div className="flex items-center justify-end gap-2">
                                  <button
                                    onClick={() => setEditingContent(false)}
                                    className="px-3 py-1.5 rounded-xl bg-dark-800 text-slate-300 text-xs"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    onClick={() => handleSaveEdit(ver.id)}
                                    className="btn-royal text-xs py-1.5 px-4"
                                  >
                                    Save Immutable Version
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                {/* Formatted Educational Content View */}
                                
                                {/* 1. Explanation View */}
                                {currentActiveAsset.type === 'explanation' && (
                                  <div className="space-y-3 text-xs text-slate-200 leading-relaxed font-sans">
                                    {content.title && (
                                      <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">
                                        {content.title}
                                      </h3>
                                    )}
                                    {content.explanation ? (
                                      content.explanation.split('\n\n').map((para, pIdx) => (
                                        <div key={pIdx} className="p-3.5 rounded-xl bg-dark-950/80 border border-slate-800/80">
                                          {para}
                                        </div>
                                      ))
                                    ) : (
                                      <p className="p-3 text-slate-400 italic">No explanation text generated yet.</p>
                                    )}
                                    {content.glossary_terms_applied && content.glossary_terms_applied.length > 0 && (
                                      <div className="flex flex-wrap items-center gap-1.5 pt-2">
                                        <span className="text-[10px] font-mono text-slate-400">Canonical Terms Applied:</span>
                                        {content.glossary_terms_applied.map((t, idx) => (
                                          <span key={idx} className="px-2 py-0.5 rounded text-[10px] font-mono bg-neon-orange/20 text-neon-glow border border-neon-orange/30">
                                            {t}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 2. Worked Example View */}
                                {currentActiveAsset.type === 'example' && (
                                  <div className="space-y-3">
                                    {content.scenario && (
                                      <div className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 text-xs text-slate-200">
                                        <span className="font-bold text-neon-orange block mb-1">Scenario / Challenge:</span>
                                        <p>{content.scenario}</p>
                                      </div>
                                    )}
                                    {content.steps && (
                                      <div className="space-y-2">
                                        <span className="text-xs font-bold text-white block">Step-by-Step Breakdown:</span>
                                        {content.steps.map((st, sIdx) => (
                                          <div key={sIdx} className="p-3.5 rounded-xl bg-dark-900 border border-slate-800 text-xs space-y-1">
                                            <div className="flex items-center gap-2 font-bold text-white">
                                              <span className="w-5 h-5 rounded-full bg-neon-orange text-white flex items-center justify-center text-[10px] font-mono">
                                                {st.step_number || sIdx + 1}
                                              </span>
                                              {st.title || `Step ${sIdx + 1}`}
                                            </div>
                                            <p className="text-slate-300 pl-7">{st.description}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                    {content.solution_summary && (
                                      <div className="p-3 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-300">
                                        <strong>Summary: </strong> {content.solution_summary}
                                      </div>
                                    )}
                                  </div>
                                )}

                                {/* 3. Formative Quiz View */}
                                {currentActiveAsset.type === 'quiz' && (
                                  <div className="space-y-4">
                                    {/* Quiz Controls Bar */}
                                    <div className="p-3.5 rounded-xl bg-dark-950 border border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-slate-300">
                                          Collective Assessment: <strong className="text-neon-amber font-mono">{content.questions?.length || 0} Questions</strong>
                                        </span>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-dark-900 border border-slate-700 text-slate-400">
                                          Progressive Tiers ({quizDifficultyToGenerate === 'Easy' ? 'Easy' : quizDifficultyToGenerate === 'Medium' ? 'Easy + Medium' : 'Easy + Medium + Hard'})
                                        </span>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2.5">
                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[11px] text-slate-400 font-medium">Difficulty:</label>
                                          <select
                                            value={quizDifficultyToGenerate}
                                            onChange={(e) => setQuizDifficultyToGenerate(e.target.value)}
                                            className="rounded-lg glass-input py-1 px-2.5 text-xs font-mono font-bold text-neon-amber bg-dark-900 border border-slate-700"
                                          >
                                            <option value="Easy">Easy (Recall & Fundamentals)</option>
                                            <option value="Medium">Medium (Easy + Medium)</option>
                                            <option value="Hard">Hard (Easy + Medium + Hard)</option>
                                          </select>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                          <label className="text-[11px] text-slate-400 font-medium">Count:</label>
                                          <select
                                            value={quizCountToGenerate}
                                            onChange={(e) => setQuizCountToGenerate(Number(e.target.value))}
                                            className="rounded-lg glass-input py-1 px-2 text-xs font-mono font-bold text-neon-orange bg-dark-900 border border-slate-700"
                                          >
                                            {[1, 2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                                              <option key={n} value={n}>{n} Qs</option>
                                            ))}
                                          </select>
                                        </div>

                                        <button
                                          onClick={() => handleSingleItemRegenerate('quiz', currentActiveAsset.objective_id, quizCountToGenerate, quizDifficultyToGenerate)}
                                          disabled={generating}
                                          className="btn-royal text-xs py-1 px-3.5 flex items-center gap-1.5 shadow-neon-sm"
                                        >
                                          <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                                          Regenerate Quiz ({quizDifficultyToGenerate} - {quizCountToGenerate} Qs)
                                        </button>
                                      </div>
                                    </div>

                                    {content.questions && content.questions.length > 0 ? (
                                      <div className="space-y-3">
                                        {content.questions.map((q, qIdx) => {
                                          const tier = q.difficulty_tier || (qIdx === 0 ? 'Easy' : (qIdx === 1 ? 'Medium' : 'Advanced'));
                                          return (
                                            <div key={qIdx} className="p-4 rounded-xl bg-dark-950 border border-slate-800 space-y-3">
                                              <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-start gap-2">
                                                  <span className="font-mono text-xs font-bold text-neon-orange">
                                                    Q{qIdx + 1}.
                                                  </span>
                                                  <span className="text-xs font-bold text-white leading-relaxed">
                                                    {q.question_text || q.question}
                                                  </span>
                                                </div>
                                                <div className="flex items-center gap-1.5 shrink-0">
                                                  {tier.toLowerCase() === 'easy' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 inline-flex items-center gap-1">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                                      Easy
                                                    </span>
                                                  )}
                                                  {tier.toLowerCase() === 'medium' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-950/80 text-blue-300 border border-blue-500/40 inline-flex items-center gap-1">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400"></span>
                                                      Medium
                                                    </span>
                                                  )}
                                                  {tier.toLowerCase() === 'advanced' && (
                                                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40 inline-flex items-center gap-1">
                                                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                                                      Hard
                                                    </span>
                                                  )}
                                                  <Badge variant="royal">{q.bloom_level || 'Understand'}</Badge>
                                                </div>
                                              </div>
                                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                                                {q.options && Object.entries(q.options).map(([optKey, optVal]) => (
                                                  <div
                                                    key={optKey}
                                                    className="p-2.5 rounded-lg border bg-dark-900 border-slate-800 text-slate-300 flex items-center gap-2"
                                                  >
                                                    <span className="font-mono text-xs font-bold uppercase text-neon-orange">{optKey})</span>
                                                    <span>{optVal}</span>
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No questions generated yet.</p>
                                    )}
                                  </div>
                                )}

                                {/* 4. Answer Key (Separate Asset) View */}
                                {currentActiveAsset.type === 'answer_key' && (
                                  <div className="space-y-3">
                                    {content.policy && (
                                      <div className="p-2.5 rounded-xl bg-dark-900 border border-slate-800 text-[11px] text-neon-amber font-mono flex items-center gap-1.5">
                                        <Lock className="w-3.5 h-3.5 text-neon-amber shrink-0" />
                                        <span>{content.policy}</span>
                                      </div>
                                    )}
                                    {content.answer_entries && content.answer_entries.length > 0 ? (
                                      content.answer_entries.map((ans, aIdx) => (
                                        <div key={aIdx} className="p-4 rounded-xl bg-dark-950 border border-slate-800 space-y-2 text-xs">
                                          <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
                                            <span className="font-bold text-white uppercase font-mono text-xs text-neon-orange">
                                              {ans.question_id || `Question ${aIdx + 1}`}
                                            </span>
                                            <span className="px-2 py-0.5 rounded font-mono text-xs font-bold bg-emerald-950/80 text-emerald-300 border border-emerald-500/40">
                                              Correct Choice: {ans.correct_option}
                                            </span>
                                          </div>
                                          {ans.question_text && (
                                            <p className="text-slate-300 text-xs italic">
                                              "{ans.question_text}"
                                            </p>
                                          )}
                                          <div className="p-3 rounded-lg bg-dark-900 border border-slate-800 space-y-1.5">
                                            <div className="text-white font-semibold flex items-center gap-1.5 text-xs">
                                              <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> {ans.correct_answer_text}
                                            </div>
                                            {ans.rationale && (
                                              <p className="text-[11px] text-slate-300 pt-1 leading-relaxed">
                                                <strong className="text-slate-200 font-mono">Scoring Rationale: </strong> {ans.rationale}
                                              </p>
                                            )}
                                            {ans.source_citation && (
                                              <span className="text-[10px] font-mono text-neon-amber block pt-1">
                                                Grounding Citation: {ans.source_citation}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      ))
                                    ) : (
                                      <p className="text-xs text-slate-400 italic">No answer key entries recorded.</p>
                                    )}
                                  </div>
                                )}

                                {/* 6. Revision Sheet (Short Points of Uploaded Document) */}
                                {currentActiveAsset.type === 'revision_sheet' && (
                                  <div className="space-y-5">
                                    {/* Executive Overview Banner */}
                                    {(content.summary_overview || content.summary) && (
                                      <div className="p-4 rounded-xl bg-dark-950 border border-slate-800 space-y-1.5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-neon-orange uppercase font-mono">
                                          <BookOpen className="w-3.5 h-3.5" /> Document Synthesis & Executive Overview
                                        </div>
                                        <p className="text-xs text-slate-200 leading-relaxed">
                                          {content.summary_overview || content.summary}
                                        </p>
                                      </div>
                                    )}

                                    {/* Short Summary Points of Uploaded Document */}
                                    {content.short_summary_points && content.short_summary_points.length > 0 && (
                                      <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-neon-amber uppercase font-mono tracking-wider flex items-center gap-1.5">
                                            <FileText className="w-3.5 h-3.5 text-neon-orange" />
                                            Document Key Summary Points ({content.short_summary_points.length} Points)
                                          </span>
                                          <span className="text-[10px] font-mono text-slate-400">
                                            Distilled directly from source
                                          </span>
                                        </div>
                                        <div className="space-y-2.5">
                                          {content.short_summary_points.map((pt, ptIdx) => (
                                            <div
                                              key={ptIdx}
                                              className="p-3.5 rounded-xl bg-dark-950 border border-slate-800/90 hover:border-slate-700 transition-all space-y-1.5"
                                            >
                                              <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 rounded-full bg-neon-orange/20 text-neon-glow flex items-center justify-center text-[10px] font-mono font-bold shrink-0">
                                                  {ptIdx + 1}
                                                </span>
                                                <span className="font-bold text-xs text-white">
                                                  {pt.topic || `Key Point #${ptIdx + 1}`}
                                                </span>
                                              </div>
                                              <p className="text-xs text-slate-300 pl-7 leading-relaxed font-sans">
                                                {pt.summary}
                                              </p>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Key Takeaways & Core Invariants */}
                                    {content.key_takeaways && content.key_takeaways.length > 0 && (
                                      <div className="space-y-2.5 pt-2">
                                        <span className="text-xs font-bold text-neon-amber uppercase font-mono tracking-wider block">
                                          Core Invariants & Architectural Rules
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                          {content.key_takeaways.map((item, kIdx) => (
                                            <div key={kIdx} className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 space-y-1.5">
                                              <span className="font-bold text-white block text-neon-glow font-mono text-xs">
                                                {item.concept || item.objective || `Rule #${kIdx + 1}`}
                                              </span>
                                              <p className="text-slate-300 leading-relaxed">{item.core_formula_rule}</p>
                                              {item.pitfall_to_avoid && (
                                                <div className="text-[11px] text-neon-orange pt-1 flex items-start gap-1">
                                                  <span className="font-bold shrink-0">Pitfall:</span>
                                                  <span>{item.pitfall_to_avoid}</span>
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}

                                    {/* Rapid Recall Triggers */}
                                    {(content.quick_recall_bullets || content.rapid_memory_triggers) && (
                                      <div className="p-4 rounded-xl bg-dark-950 border border-slate-800 text-xs space-y-2">
                                        <span className="font-bold text-neon-glow uppercase font-mono text-[10px] flex items-center gap-1.5">
                                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Quick Exam & Study Recall Points:
                                        </span>
                                        <ul className="space-y-1.5 text-slate-300 pl-1">
                                          {(content.quick_recall_bullets || content.rapid_memory_triggers).map((trig, tIdx) => (
                                            <li key={tIdx} className="flex items-start gap-2 text-xs">
                                              <span className="text-neon-orange font-bold font-mono">▸</span>
                                              <span>{trig}</span>
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                  </div>
                                )}

                              </div>
                            )}

                            {/* Bottom Controls: Toggle Raw JSON & Regenerate Item */}
                            <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                              <button
                                onClick={() => {
                                  setEditText(JSON.stringify(content, null, 2));
                                  setEditingContent(!editingContent);
                                }}
                                className="px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-slate-700 text-xs flex items-center gap-1.5"
                              >
                                <Edit3 className="w-3.5 h-3.5 text-neon-orange" />
                                {editingContent ? 'View Formatted Cards' : 'Edit Raw JSON'}
                              </button>

                              <button
                                onClick={() => handleSingleItemRegenerate(currentActiveAsset.type, currentActiveAsset.objective_id)}
                                disabled={generating}
                                className="px-3 py-1.5 rounded-xl bg-neon-orange/20 hover:bg-neon-orange text-neon-glow hover:text-white border border-neon-orange/40 text-xs font-semibold flex items-center gap-1.5 transition-all"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} />
                                Regenerate Item
                              </button>
                            </div>
                          </div>
                        </GlassCard>
                      </div>

                    </div>
                  );
                })()
              ) : (
                <GlassCard className="text-center py-12 text-slate-500 text-xs">
                  Select an asset tab above to review lesson content.
                </GlassCard>
              )}

            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 4: 6 QUALITY GUARDRAILS CHECKLIST */}
      {/* ========================================================================= */}
      {activeStudioTab === 'guardrails' && (
        <div className="space-y-6 animate-in fade-in">
          <GuardrailAlerts />
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-TAB 5 & 6: CLASSROOMS & MASTERY HEATMAP PLACEHOLDERS */}
      {/* ========================================================================= */}
      {activeStudioTab === 'heatmap' && (
        <GlassCard
          icon={BarChart3}
          title="Objective Mastery Heatmap"
          subtitle="Diagnostic class-wide mastery heatmaps across authoritative learning contracts"
        >
          <div className="py-12 text-center text-xs text-slate-400 space-y-3">
            <BarChart3 className="w-10 h-10 text-neon-orange mx-auto opacity-70" />
            <p className="max-w-md mx-auto">
              Diagnostic heatmap aggregates all formative submissions across active classrooms. Navigate to Classrooms & Analytics for live telemetry.
            </p>
            {onNavigateClassrooms && (
              <button onClick={onNavigateClassrooms} className="btn-royal text-xs">
                Open Classrooms & Analytics
              </button>
            )}
          </div>
        </GlassCard>
      )}

      {/* ASSIGN TO CLASSROOM MODAL */}
      {showAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-3xl glass-panel-accent p-6 sm:p-8 border border-neon-orange/40 shadow-neon space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-neon-orange" /> Assign Lesson to Classrooms
              </h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-slate-400 hover:text-white text-xs font-semibold"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-2">Target Classrooms</label>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {assignClassrooms.map((c) => (
                    <label
                      key={c.id}
                      className="p-3 rounded-xl bg-dark-900 border border-slate-800 flex items-center justify-between cursor-pointer hover:border-slate-700"
                    >
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={selectedClassroomIds.includes(c.id)}
                          onChange={() => {
                            setSelectedClassroomIds(prev =>
                              prev.includes(c.id) ? prev.filter(id => id !== c.id) : [...prev, c.id]
                            );
                          }}
                          className="rounded text-neon-orange focus:ring-0"
                        />
                        <span className="text-xs font-semibold text-white">{c.name} ({c.subject})</span>
                      </div>
                      <span className="text-[10px] font-mono text-neon-amber">{c.join_code}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Time Limit (Mins)</label>
                  <input
                    type="number"
                    min={1}
                    max={180}
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-xl glass-input p-2.5 text-xs font-mono text-neon-glow"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Max Attempts</label>
                  <select
                    value={maxAttempts}
                    onChange={(e) => setMaxAttempts(Number(e.target.value))}
                    className="w-full rounded-xl glass-input p-2.5 text-xs"
                  >
                    <option value={1}>1 Attempt</option>
                    <option value={2}>2 Attempts</option>
                    <option value={3}>3 Attempts</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignUnitToClassrooms}
                  disabled={assigning || selectedClassroomIds.length === 0}
                  className="btn-royal text-xs py-2 px-5 shadow-neon"
                >
                  {assigning ? 'Assigning...' : 'Deploy to Selected Classes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* In-App Delete Confirmation Modal (NO Browser Popups) */}
      {unitToDelete && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="glass-card border border-rose-500/30 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 bg-dark-900/95 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
            
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                <Trash2 className="w-6 h-6 text-rose-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base font-bold text-white tracking-wide">Remove Lesson Permanently?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Are you sure you want to remove <span className="text-rose-300 font-semibold">"{unitToDelete.title}"</span>?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-rose-950/20 border border-rose-500/20 text-xs text-slate-300 space-y-2">
              <p className="font-semibold text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                This will completely delete:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-[11px] text-slate-400">
                <li>All 7 generated learning assets & objective versions</li>
                <li>All classroom assignments & student submissions</li>
                <li>Audit logs and quality verification records</li>
              </ul>
              <p className="text-[10px] text-rose-400/80 font-mono pt-1">
                This action is permanent and cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setUnitToDelete(null)}
                disabled={deletingUnit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-dark-800 hover:bg-dark-700 text-slate-300 border border-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteUnit}
                disabled={deletingUnit}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-950/50 flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
              >
                {deletingUnit ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing Lesson...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Yes, Delete Lesson</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherStudioPage;
