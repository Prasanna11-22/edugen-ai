import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  GraduationCap, 
  BookOpen, 
  Clock, 
  FileCheck, 
  ArrowRight, 
  Download, 
  Plus, 
  CheckCircle2, 
  Award, 
  RefreshCw, 
  AlertCircle,
  Layers,
  Sparkles,
  Shield,
  Library,
  Compass,
  HelpCircle,
  BrainCircuit,
  Target,
  Sliders,
  Check,
  X,
  Eye,
  EyeOff,
  RotateCcw,
  Zap,
  CheckSquare,
  Send
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const StudentDashboard = ({ onTakeAssessment, onViewMaterial }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('all'); // 'all' or specific classroom_id
  const [selectedCategory, setSelectedCategory] = useState('all'); // 'all', 'packs', 'practice', 'assessments'
  const [allData, setAllData] = useState({ assignments: [], materials: [] });
  const [loading, setLoading] = useState(true);

  // Self-Paced AI Test Generator State
  const [selfPacedTopics, setSelfPacedTopics] = useState([]);
  const [selectedTopicUnitId, setSelectedTopicUnitId] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState('Medium');
  const [selectedQuestionCount, setSelectedQuestionCount] = useState(5);
  const [selectedBloomLevel, setSelectedBloomLevel] = useState('Apply');
  const [generatingSelfPaced, setGeneratingSelfPaced] = useState(false);
  
  // Active Generated Self-Paced Test Session
  const [activeSelfPacedTest, setActiveSelfPacedTest] = useState(null);
  const [selfPacedAnswers, setSelfPacedAnswers] = useState({});
  const [selfPacedSubmitted, setSelfPacedSubmitted] = useState(false);
  const [revealedSolutions, setRevealedSolutions] = useState({});

  // Join Classroom Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');
  const [downloadingPackId, setDownloadingPackId] = useState(null);

  const handleDownloadPackPDF = async (e, m) => {
    e.stopPropagation(); // prevent triggering card click
    const packKey = m.unit_id || m.version_id;
    if (downloadingPackId) return;
    setDownloadingPackId(packKey);
    showToast(`Generating PDF study pack for ${m.unit_title || 'unit'}...`, "info");

    try {
      const url = m.unit_id
        ? `/api/student/units/${m.unit_id}/download-pdf`
        : `/api/student/assets/${m.version_id}/download-pdf`;

      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Failed to download PDF');
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      
      const cleanTitle = (m.unit_title || 'Study_Pack').replace(/[^a-zA-Z0-9_-]/g, '_');
      link.download = `Retrievo_${cleanTitle}_Study_Pack.pdf`;
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      showToast("PDF study pack downloaded successfully!", "success");
    } catch (err) {
      console.error("PDF download error:", err);
      showToast(err.message || "Failed to download PDF pack", "error");
    } finally {
      setDownloadingPackId(null);
    }
  };

  useEffect(() => {
    fetchStudentClassrooms();
    fetchSelfPacedTopics();
  }, []);

  const fetchStudentClassrooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(data);
        if (data.length > 0) {
          setSelectedClassId(data[0].classroom_id);
          fetchAllClassData(data);
        }
      }
    } catch (err) {
      console.error("Error fetching classrooms", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSelfPacedTopics = async () => {
    try {
      const res = await fetch('/api/student/self-paced/topics', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSelfPacedTopics(data);
        if (data.length > 0 && !selectedTopicUnitId) {
          setSelectedTopicUnitId(String(data[0].unit_id));
        }
      }
    } catch (err) {
      console.error("Error fetching self-paced topics", err);
    }
  };

  const fetchAllClassData = async (classList) => {
    try {
      const allAssignments = [];
      const allMaterials = [];

      await Promise.all(classList.map(async (c) => {
        const [aRes, mRes] = await Promise.all([
          fetch(`/api/student/assignments?classroom_id=${c.classroom_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`/api/student/materials?classroom_id=${c.classroom_id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        if (aRes.ok) {
          const aData = await aRes.json();
          allAssignments.push(...aData.map(item => ({ ...item, classroom_id: c.classroom_id, subject: c.subject, classroom_name: c.name, teacher_name: c.teacher_name })));
        }
        if (mRes.ok) {
          const mData = await mRes.json();
          allMaterials.push(...mData.map(item => ({ ...item, classroom_id: c.classroom_id, subject: c.subject, classroom_name: c.name, teacher_name: c.teacher_name })));
        }
      }));

      setAllData({
        assignments: allAssignments,
        materials: allMaterials
      });
    } catch (err) {
      console.error("Error fetching class data", err);
    }
  };

  const handleJoinClassroom = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoining(true);
    setJoinMessage('');
    try {
      const res = await fetch('/api/student/classrooms/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ join_code: joinCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Join failed');
      setJoinMessage(data.message);
      showToast(data.message, "success");
      setJoinCode('');
      await fetchStudentClassrooms();
      await fetchSelfPacedTopics();
      setTimeout(() => setShowJoinModal(false), 1500);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoining(false);
    }
  };

  // Generate dynamic self-paced practice test via Gemini AI
  const handleGenerateSelfPacedTest = async (overrideUnitId = null, overrideDiff = null) => {
    const unitId = overrideUnitId || selectedTopicUnitId;
    const diff = overrideDiff || selectedDifficulty;

    if (!unitId && selfPacedTopics.length === 0) {
      showToast("No assigned pack topics available yet. Please enroll in a classroom first.", "error");
      return;
    }

    setGeneratingSelfPaced(true);
    try {
      const res = await fetch('/api/student/self-paced/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          unit_id: unitId ? Number(unitId) : null,
          difficulty: diff,
          num_questions: Number(selectedQuestionCount),
          bloom_level: selectedBloomLevel
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Generation failed');

      setActiveSelfPacedTest(data);
      setSelfPacedAnswers({});
      setSelfPacedSubmitted(false);
      setRevealedSolutions({});
      setSelectedCategory('practice');
      showToast(`✨ Generated ${data.questions?.length || 0} self-paced practice questions using Gemini AI!`, "success");
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setGeneratingSelfPaced(false);
    }
  };

  const handleSelectSelfPacedOption = (qId, optKey) => {
    if (selfPacedSubmitted) return; // Locked once submitted
    setSelfPacedAnswers(prev => ({ ...prev, [qId]: optKey }));
  };

  const resetSelfPacedTest = () => {
    setSelfPacedAnswers({});
    setRevealedSolutions({});
    setSelfPacedSubmitted(false);
  };

  const handleSubmitSelfPacedTest = () => {
    if (!activeSelfPacedTest?.questions?.length) return;
    if (selfPacedAnsweredCount === 0) {
      showToast("Please answer at least one question before submitting your practice test.", "info");
      return;
    }
    setSelfPacedSubmitted(true);
    if (selfPacedScorePercent >= 80) {
      showToast(`🎉 Outstanding! You scored ${selfPacedScorePercent}% (${selfPacedCorrectCount}/${selfPacedTotalQuestions}) on this AI practice set!`, "success");
    } else if (selfPacedScorePercent >= 50) {
      showToast(`👍 Good effort! You scored ${selfPacedScorePercent}% (${selfPacedCorrectCount}/${selfPacedTotalQuestions}). Review your answers below.`, "success");
    } else {
      showToast(`📚 Keep learning! You scored ${selfPacedScorePercent}% (${selfPacedCorrectCount}/${selfPacedTotalQuestions}). Read the step rationales below to master the topic.`, "info");
    }
  };

  // Filter assignments: ONLY show assessments where the student has attempts remaining to attend
  const availableAssignments = (allData.assignments || []).filter(a => 
    a.can_attempt === true && 
    (a.attempts_remaining !== undefined ? a.attempts_remaining > 0 : (a.attempts_used < a.max_attempts))
  );

  const displayedAssignments = selectedClassId === 'all'
    ? availableAssignments
    : availableAssignments.filter(a => a.classroom_id === selectedClassId);

  const displayedMaterials = selectedClassId === 'all'
    ? allData.materials
    : allData.materials.filter(m => m.classroom_id === selectedClassId);

  const activeClassroom = classrooms.find(c => c.classroom_id === selectedClassId);

  // Self-Paced Test Score Calculation
  const selfPacedAnsweredCount = Object.keys(selfPacedAnswers).length;
  const selfPacedTotalQuestions = activeSelfPacedTest?.questions?.length || 0;
  let selfPacedCorrectCount = 0;
  if (activeSelfPacedTest?.questions) {
    activeSelfPacedTest.questions.forEach(q => {
      const selected = selfPacedAnswers[q.id];
      const correctKey = String(q.correct_answer || q.correct_option || '').trim().toUpperCase();
      const correctText = String(q.correct_answer_text || '').trim().toLowerCase();
      if (selected) {
        const isMatch = (selected.trim().toUpperCase() === correctKey) ||
          (correctText && q.options && q.options[selected] && q.options[selected].trim().toLowerCase() === correctText);
        if (isMatch) {
          selfPacedCorrectCount += 1;
        }
      }
    });
  }
  const selfPacedScorePercent = selfPacedTotalQuestions > 0 ? Math.round((selfPacedCorrectCount / selfPacedTotalQuestions) * 100) : 0;

  return (
    <div className="space-y-8 pb-20">
      
      {/* Student Welcome Banner */}
      <div className="rounded-3xl glass-panel-accent p-6 sm:p-8 border border-neon-orange/40 shadow-neon flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-orange via-neon-amber to-neon-gold" />
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-xs font-mono uppercase tracking-widest text-neon-amber font-bold flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 text-neon-orange" /> Domain Learning Portal
            </span>
            <Badge variant="bloom">Self-Paced & Formative Modes</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white">
            Welcome, <span className="text-neon-glow">{user?.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl leading-relaxed">
            Access verified full study packs, generate dynamic AI-powered self-paced practice tests, and attempt instructor-assigned formative tests.
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 pt-4 flex-wrap text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-dark-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-mono">
              <BookOpen className="w-3.5 h-3.5 text-neon-orange" />
              <span><strong>{displayedMaterials.length}</strong> Study Packs</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-dark-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-mono">
              <BrainCircuit className="w-3.5 h-3.5 text-sky-400" />
              <span><strong>{selfPacedTopics.length}</strong> AI Practice Topics</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-dark-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-mono">
              <Clock className="w-3.5 h-3.5 text-neon-amber" />
              <span><strong>{displayedAssignments.length}</strong> Formative Tests</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowJoinModal(true)}
          className="btn-royal text-xs flex items-center gap-2 py-3 px-5 shadow-neon shrink-0"
        >
          <Plus className="w-4 h-4" /> Join Classroom with Code
        </button>
      </div>

      {/* Domain & Subject Selector Bar */}
      {classrooms.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-neon-orange" /> Filter Academic Domain & Subject:
            </span>
            <span className="text-[11px] font-mono text-neon-amber">{classrooms.length} Enrolled Domain(s)</span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-2 max-w-full">
            {classrooms.length > 1 && (
              <button
                onClick={() => setSelectedClassId('all')}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                  selectedClassId === 'all'
                    ? 'bg-neon-orange text-white shadow-neon-sm'
                    : 'bg-dark-900 hover:bg-dark-850 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                <Compass className="w-4 h-4" />
                <span>All Domains ({classrooms.length})</span>
              </button>
            )}

            {classrooms.map((c) => {
              const isSelected = selectedClassId === c.classroom_id;
              return (
                <button
                  key={c.classroom_id}
                  onClick={() => setSelectedClassId(c.classroom_id)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2.5 ${
                    isSelected
                      ? 'bg-neon-orange text-white shadow-neon-sm'
                      : 'bg-dark-900 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-800'
                  }`}
                >
                  <BookOpen className={`w-4 h-4 ${isSelected ? 'text-white' : 'text-neon-orange'}`} />
                  <div>
                    <span className="font-bold">{c.subject || 'Domain'}</span>
                    <span className={`text-[10px] ml-1.5 font-mono ${isSelected ? 'text-white/80' : 'text-slate-400'}`}>
                      ({c.name})
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Domain Info Capsule */}
          {activeClassroom && selectedClassId !== 'all' && (
            <div className="p-3.5 rounded-2xl bg-dark-900/90 border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-300 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>Active Domain: <strong className="text-white text-neon-glow">{activeClassroom.subject}</strong></span>
                <span className="text-slate-500">•</span>
                <span>Classroom: <strong className="text-slate-200">{activeClassroom.name}</strong></span>
              </div>
              <div className="text-[11px] font-mono text-slate-400">
                Instructor: <strong className="text-neon-amber">{activeClassroom.teacher_name}</strong>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Module View Tabs: All, Full Study Packs, AI Self-Paced Practice, Formative Assessments */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'all', label: 'All Learning Modules', icon: Layers, count: displayedMaterials.length + (activeSelfPacedTest ? 1 : 0) + displayedAssignments.length },
          { id: 'packs', label: 'Approved Study Packs', icon: BookOpen, count: displayedMaterials.length },
          { id: 'practice', label: 'AI Self-Paced Practice', icon: BrainCircuit, count: selfPacedTopics.length },
          { id: 'assessments', label: 'Formative Assessments', icon: Clock, count: displayedAssignments.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = selectedCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedCategory(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 ${
                isActive
                  ? 'bg-dark-850 text-neon-orange border border-neon-orange/40 shadow-neon-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-dark-900'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-neon-orange' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-mono ${isActive ? 'bg-neon-orange/20 text-neon-glow font-bold' : 'bg-dark-950 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1: APPROVED FULL STUDY MATERIAL PACKS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'packs') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-neon-orange" />
              <div>
                <h2 className="text-lg font-bold text-white">Approved Full Study Packs</h2>
                <p className="text-xs text-slate-400">Comprehensive curriculum notes, step-by-step worked solutions, high-yield rules, and glossary</p>
              </div>
            </div>
            <Badge variant="approved">Server-Side Gated</Badge>
          </div>

          {displayedMaterials.length === 0 ? (
            <GlassCard className="text-center py-10">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No approved study packs in this domain.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedMaterials.map((m) => (
                <div
                  key={m.unit_id || m.version_id}
                  onClick={() => onViewMaterial(m, 'all')}
                  className="rounded-2xl glass-panel p-5 sm:p-6 border border-slate-800/90 hover:border-neon-orange/50 transition-all cursor-pointer group space-y-3.5 relative overflow-hidden bg-dark-900/80 hover:bg-dark-900 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neon-orange/15 text-neon-orange border border-neon-orange/30 uppercase">
                            {m.subject || m.domain || 'Domain'} Pack
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{m.unit_title}</span>
                        </div>
                        <h4 className="text-base font-bold text-white group-hover:text-neon-glow transition-colors">
                          {m.content?.title || `Complete Study Pack: ${m.unit_title}`}
                        </h4>
                      </div>
                      <Badge variant="royal">v{m.version_no || 1}</Badge>
                    </div>

                    <p className="text-xs text-slate-300 line-clamp-2 leading-relaxed font-sans">
                      {m.content?.explanation || m.content?.summary || 'All-in-one learning pack containing core concept explanations, worked step-by-step problems, high-yield exam recall points, and canonical glossary terms.'}
                    </p>

                    {/* Included Pack Components Pills */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                        <FileCheck className="w-3 h-3 text-emerald-400" /> Explanation
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-neon-orange" /> Worked Steps
                      </span>
                      <span className="px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                        <Award className="w-3 h-3 text-neon-amber" /> Revision & Rules
                      </span>
                      {m.content?.glossary && m.content.glossary.length > 0 && (
                        <span className="px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-800 text-[10px] text-slate-300 font-medium flex items-center gap-1">
                          <Library className="w-3 h-3 text-violet-400" /> {m.content.glossary.length} Terms
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-800/80">
                    <span className="font-mono text-[11px] text-slate-400">
                      Citations: {m.content?.chunk_citations?.length || 0} Chunks
                    </span>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        onClick={(e) => handleDownloadPackPDF(e, m)}
                        disabled={downloadingPackId === (m.unit_id || m.version_id)}
                        className="px-2.5 py-1 rounded-lg bg-dark-950 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5 transition shadow-sm"
                        title="Quick Download PDF"
                      >
                        {downloadingPackId === (m.unit_id || m.version_id) ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin text-neon-orange" />
                            <span>PDF...</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-3 h-3 text-neon-orange" />
                            <span>PDF</span>
                          </>
                        )}
                      </button>
                      <span className="text-neon-orange group-hover:text-neon-amber font-bold flex items-center gap-1 text-xs">
                        Open Pack <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: AI-POWERED SELF-PACED PRACTICE & TEST GENERATOR (GEMINI AI) */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'practice') && (
        <div className="space-y-6">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-sky-400" />
              <div>
                <h2 className="text-lg font-bold text-white">AI Self-Paced Practice & Test Generator</h2>
                <p className="text-xs text-slate-400">Generate on-demand practice tests using Gemini AI grounded strictly in your assigned pack topics</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-sky-400" /> Powered by Gemini AI
              </span>
            </div>
          </div>

          {/* Generator Control Card */}
          <div className="rounded-3xl glass-panel-accent p-6 border border-sky-500/30 shadow-neon space-y-5 relative overflow-hidden bg-gradient-to-b from-dark-900 via-dark-950 to-dark-950">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5" /> Self-Paced AI Test Customizer
                </span>
                <h3 className="text-base font-bold text-white">Configure Your AI Practice Session</h3>
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {selfPacedTopics.length} Available Assigned Topics
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
              
              {/* 1. Topic Selector */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-sky-400" /> Choose Topic / Pack:
                </label>
                <select
                  value={selectedTopicUnitId}
                  onChange={(e) => setSelectedTopicUnitId(e.target.value)}
                  className="w-full rounded-xl bg-dark-900 border border-slate-700 text-white p-2.5 text-xs font-semibold focus:border-sky-400 focus:outline-none"
                >
                  {selfPacedTopics.length === 0 ? (
                    <option value="">No assigned pack topics available</option>
                  ) : (
                    selfPacedTopics.map((t) => (
                      <option key={t.unit_id} value={t.unit_id}>
                        {t.title} ({t.subject || 'Domain'})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* 2. Difficulty Level */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Target className="w-3.5 h-3.5 text-neon-amber" /> Difficulty Level:
                </label>
                <div className="grid grid-cols-3 gap-1 bg-dark-900 p-1 rounded-xl border border-slate-800">
                  {['Easy', 'Medium', 'Hard'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setSelectedDifficulty(d)}
                      className={`py-1.5 rounded-lg font-bold text-[11px] transition-all ${
                        selectedDifficulty === d
                          ? 'bg-sky-500 text-black shadow-sm font-black'
                          : 'text-slate-400 hover:text-white hover:bg-dark-800'
                      }`}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              </div>

              {/* 3. Number of Questions */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> Number of Questions:
                  </span>
                  <span className="text-[11px] font-mono text-neon-orange font-bold">{selectedQuestionCount} Qs</span>
                </label>
                <div className="grid grid-cols-6 gap-1 bg-dark-900 p-1 rounded-xl border border-slate-800">
                  {[3, 5, 8, 10, 15, 20].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setSelectedQuestionCount(num)}
                      className={`py-1.5 rounded-lg font-bold text-[11px] font-mono transition-all ${
                        selectedQuestionCount === num
                          ? 'bg-neon-orange text-white shadow-sm font-black'
                          : 'text-slate-400 hover:text-white hover:bg-dark-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* 4. Cognitive Level */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-violet-400" /> Focus Mode:
                </label>
                <select
                  value={selectedBloomLevel}
                  onChange={(e) => setSelectedBloomLevel(e.target.value)}
                  className="w-full rounded-xl bg-dark-900 border border-slate-700 text-white p-2.5 text-xs font-semibold focus:border-sky-400 focus:outline-none"
                >
                  <option value="Understand">Conceptual Recall & Understanding</option>
                  <option value="Apply">Application & Step Solutions</option>
                  <option value="Analyze">Analytical & System Critique</option>
                </select>
              </div>

            </div>

            {/* Launch Generator Action Button */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/80">
              <div className="text-[11px] text-slate-400 flex items-center gap-2">
                <Zap className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                <span>Gemini AI will synthesize dynamic, syllabus-grounded questions with step rationales.</span>
              </div>

              <button
                type="button"
                onClick={() => handleGenerateSelfPacedTest()}
                disabled={generatingSelfPaced || selfPacedTopics.length === 0}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs shadow-[0_0_20px_rgba(56,189,248,0.35)] flex items-center justify-center gap-2 transition-all shrink-0"
              >
                {generatingSelfPaced ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-black" /> Generating with Gemini AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-black" /> Generate AI Self-Paced Test
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick-Launch Topic Cards */}
          {selfPacedTopics.length > 0 && !activeSelfPacedTest && (
            <div className="space-y-3">
              <span className="text-xs font-mono font-bold uppercase text-slate-400 block">
                Quick-Start Pack Practice Topics:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {selfPacedTopics.map((top) => (
                  <div
                    key={top.unit_id}
                    className="p-4 rounded-2xl bg-dark-900/80 border border-slate-800 hover:border-sky-500/40 transition-all flex flex-col justify-between space-y-3 group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-sky-500/10 text-sky-400 uppercase">
                          {top.subject || 'Pack'}
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{top.objectives?.length || 1} Objective(s)</span>
                      </div>
                      <h4 className="font-bold text-sm text-white group-hover:text-sky-300 transition-colors">
                        {top.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">
                        {top.objectives?.[0]?.text || `Self-study practice grounded in ${top.title} syllabus material.`}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={generatingSelfPaced}
                      onClick={() => {
                        setSelectedTopicUnitId(String(top.unit_id));
                        handleGenerateSelfPacedTest(top.unit_id);
                      }}
                      className="w-full py-2 rounded-xl bg-dark-850 hover:bg-sky-600 hover:text-white text-sky-400 text-xs font-bold border border-slate-800 hover:border-sky-500 flex items-center justify-center gap-1.5 transition-all shadow-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5" /> Start AI Practice <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ACTIVE GENERATED SELF-PACED TEST INTERACTIVE VIEWER */}
          {activeSelfPacedTest && (
            <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-sky-500/50 shadow-neon space-y-6 animate-in fade-in bg-dark-900/95">
              
              {/* Test Header & Practice Tracker */}
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-400 border border-sky-500/40 uppercase">
                      {activeSelfPacedTest.topic} AI Practice Set
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-dark-950 text-neon-amber border border-slate-700">
                      Difficulty: {activeSelfPacedTest.difficulty}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950 text-emerald-400 border border-emerald-500/30">
                      Self-Paced Practice
                    </span>
                    {selfPacedSubmitted && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-950 text-purple-300 border border-purple-500/40 animate-pulse">
                        Evaluated & Scored
                      </span>
                    )}
                  </div>
                  <h3 className="text-xl font-black text-white">
                    Practice Test: {activeSelfPacedTest.topic}
                  </h3>
                </div>

                {/* Progress Capsule */}
                <div className="flex items-center gap-3 bg-dark-950 px-4 py-2.5 rounded-2xl border border-slate-800 shrink-0">
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                  <div>
                    <span className="text-[10px] font-mono text-slate-400 block uppercase">
                      {selfPacedSubmitted ? 'Score Result:' : 'Answer Progress:'}
                    </span>
                    <span className="text-sm font-mono font-bold text-sky-300">
                      {selfPacedSubmitted
                        ? `${selfPacedCorrectCount} / ${selfPacedTotalQuestions} Correct (${selfPacedScorePercent}%)`
                        : `${selfPacedAnsweredCount} / ${selfPacedTotalQuestions} Questions Selected`
                      }
                    </span>
                  </div>
                </div>
              </div>

              {/* POST-SUBMIT SCORECARD BANNER */}
              {selfPacedSubmitted && (
                <div className="rounded-2xl p-6 bg-gradient-to-r from-dark-950 via-slate-900 to-dark-950 border border-sky-500/40 shadow-neon flex flex-col md:flex-row items-center justify-between gap-6 animate-in fade-in">
                  <div className="flex items-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-mono font-black border ${
                      selfPacedScorePercent >= 80 
                        ? 'bg-emerald-950/60 border-emerald-500 text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.3)]' 
                        : selfPacedScorePercent >= 50 
                          ? 'bg-amber-950/60 border-amber-500 text-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.3)]'
                          : 'bg-rose-950/60 border-rose-500 text-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.3)]'
                    }`}>
                      <span className="text-xl leading-none">{selfPacedScorePercent}%</span>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 mt-1">Accuracy</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className={`w-5 h-5 ${selfPacedScorePercent >= 80 ? 'text-emerald-400' : 'text-neon-amber'}`} />
                        <h4 className="text-lg font-black text-white">
                          {selfPacedScorePercent >= 80 
                            ? 'Practice Mastery Achieved! 🎉' 
                            : selfPacedScorePercent >= 50 
                              ? 'Solid Practice Performance! 👍' 
                              : 'Keep Practicing & Review Concepts 📚'}
                        </h4>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        You answered <strong className="text-white">{selfPacedCorrectCount}</strong> out of <strong className="text-white">{selfPacedTotalQuestions}</strong> questions correctly ({selfPacedAnsweredCount} attempted). Full step rationales are displayed below.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                    <button
                      type="button"
                      onClick={resetSelfPacedTest}
                      className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-dark-900 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-700 text-xs font-bold flex items-center justify-center gap-2 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Retake This Set
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGenerateSelfPacedTest()}
                      disabled={generatingSelfPaced}
                      className="flex-1 md:flex-none px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold flex items-center justify-center gap-2 transition shadow-neon-sm"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-black" /> Generate Another Set
                    </button>
                  </div>
                </div>
              )}

              {/* Action Controls Bar */}
              {!selfPacedSubmitted && (
                <div className="flex items-center justify-between gap-3 flex-wrap text-xs pt-1">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={resetSelfPacedTest}
                      className="px-3.5 py-1.5 rounded-xl bg-dark-950 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center gap-1.5 transition"
                    >
                      <RotateCcw className="w-3.5 h-3.5 text-slate-400" /> Reset Choices
                    </button>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-dark-950 px-2 py-1 rounded-xl border border-slate-800">
                      <span className="text-[10px] font-mono text-slate-400 mr-1">Count:</span>
                      {[3, 5, 8, 10, 15, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setSelectedQuestionCount(num)}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition ${
                            selectedQuestionCount === num
                              ? 'bg-neon-orange text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleGenerateSelfPacedTest()}
                      disabled={generatingSelfPaced}
                      className="px-3.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${generatingSelfPaced ? 'animate-spin' : ''}`} /> Generate Another Set ({selectedQuestionCount} Qs)
                    </button>
                  </div>
                </div>
              )}

              {/* Questions List */}
              <div className="space-y-5">
                {activeSelfPacedTest.questions?.map((q, qIdx) => {
                  const selectedOpt = selfPacedAnswers[q.id];
                  const correctKey = String(q.correct_answer || q.correct_option || '').trim().toUpperCase();
                  const correctText = String(q.correct_answer_text || '').trim().toLowerCase();
                  
                  const isAnswered = Boolean(selectedOpt);
                  const isCorrect = isAnswered && (
                    (selectedOpt.trim().toUpperCase() === correctKey) ||
                    (correctText && q.options && q.options[selectedOpt] && q.options[selectedOpt].trim().toLowerCase() === correctText)
                  );

                  return (
                    <div
                      key={q.id || qIdx}
                      className={`p-5 sm:p-6 rounded-2xl bg-dark-950 border transition-all space-y-4 ${
                        selfPacedSubmitted
                          ? isCorrect
                            ? 'border-emerald-500/40 bg-dark-950/90'
                            : isAnswered
                              ? 'border-rose-500/40 bg-dark-950/90'
                              : 'border-slate-800 bg-dark-950/90'
                          : 'border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {/* Question Stem Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <span className={`w-7 h-7 rounded-xl flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                            selfPacedSubmitted
                              ? isCorrect
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isAnswered
                                  ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              : 'bg-sky-500/20 text-sky-400 border border-sky-500/40'
                          }`}>
                            {qIdx + 1}
                          </span>
                          <h4 className="font-semibold text-xs sm:text-sm text-white leading-relaxed pt-0.5">
                            {q.question}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {selfPacedSubmitted && (
                            isCorrect ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Correct (+1)
                              </span>
                            ) : isAnswered ? (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-950/80 text-rose-400 border border-rose-500/40 flex items-center gap-1">
                                <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Incorrect (0/1)
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-slate-900 text-slate-400 border border-slate-800">
                                Skipped (0/1)
                              </span>
                            )
                          )}
                          {q.difficulty_tier && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-dark-900 border border-slate-700 text-neon-amber">
                              {q.difficulty_tier}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Options Grid */}
                      {q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pl-0 sm:pl-10">
                          {Object.entries(q.options).map(([optKey, optVal]) => {
                            const isSelected = selectedOpt === optKey;
                            const isOptionCorrect = (
                              optKey.trim().toUpperCase() === correctKey ||
                              (correctText && optVal && optVal.trim().toLowerCase() === correctText)
                            );

                            let cardClasses = 'bg-dark-900 border-slate-800 text-slate-300 hover:border-slate-700 cursor-pointer';
                            let badgeClasses = 'bg-dark-800 text-slate-400';
                            let rightBadge = null;

                            if (!selfPacedSubmitted) {
                              if (isSelected) {
                                cardClasses = 'bg-sky-950/40 border-sky-500/60 text-sky-200 font-semibold shadow-sm ring-1 ring-sky-500/30 cursor-pointer';
                                badgeClasses = 'bg-sky-500 text-black font-bold';
                              }
                            } else {
                              // Submitted mode styling
                              if (isSelected && isOptionCorrect) {
                                cardClasses = 'bg-emerald-950/40 border-emerald-500 text-emerald-200 font-semibold ring-1 ring-emerald-500/40';
                                badgeClasses = 'bg-emerald-500 text-black font-bold';
                                rightBadge = (
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Your Choice (Correct)
                                  </span>
                                );
                              } else if (isSelected && !isOptionCorrect) {
                                cardClasses = 'bg-rose-950/40 border-rose-500 text-rose-200 font-semibold ring-1 ring-rose-500/40';
                                badgeClasses = 'bg-rose-500 text-white font-bold';
                                rightBadge = (
                                  <span className="text-[10px] font-mono font-bold text-rose-400 flex items-center gap-1 shrink-0">
                                    <AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Your Choice (Incorrect)
                                  </span>
                                );
                              } else if (!isSelected && isOptionCorrect) {
                                cardClasses = 'bg-emerald-950/20 border-emerald-500/60 text-emerald-300 font-medium';
                                badgeClasses = 'bg-emerald-600/40 text-emerald-300 border border-emerald-500/50 font-bold';
                                rightBadge = (
                                  <span className="text-[10px] font-mono font-bold text-emerald-400 flex items-center gap-1 shrink-0">
                                    <Check className="w-3.5 h-3.5 text-emerald-400" /> Correct Key
                                  </span>
                                );
                              } else {
                                cardClasses = 'bg-dark-900/60 border-slate-800/80 text-slate-500 opacity-60';
                                badgeClasses = 'bg-dark-800 text-slate-500';
                              }
                            }

                            return (
                              <button
                                key={optKey}
                                type="button"
                                disabled={selfPacedSubmitted}
                                onClick={() => handleSelectSelfPacedOption(q.id, optKey)}
                                className={`p-3 rounded-xl border text-xs flex items-center justify-between text-left transition-all ${cardClasses}`}
                              >
                                <div className="flex items-center gap-2.5 mr-2">
                                  <span className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono shrink-0 ${badgeClasses}`}>
                                    {optKey}
                                  </span>
                                  <span className="leading-relaxed">{optVal}</span>
                                </div>

                                {rightBadge ? rightBadge : (
                                  isSelected && !selfPacedSubmitted && (
                                    <Check className="w-4 h-4 text-sky-400 shrink-0" />
                                  )
                                )}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Pedagogical Rationale & Explanations (Shown after Submission) */}
                      {selfPacedSubmitted && (q.rationale || q.citation) && (
                        <div className="pl-0 sm:pl-10 pt-2 animate-in fade-in">
                          <div className="p-4 rounded-xl bg-dark-900 border border-sky-500/20 space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-neon-amber font-semibold">
                              <Sparkles className="w-3.5 h-3.5 text-neon-amber" />
                              <span>Step Rationale & Concept Explanation:</span>
                            </div>
                            <p className="text-slate-300 font-sans leading-relaxed">
                              {q.rationale || 'Concept derived from source textbook objective material.'}
                            </p>
                            {q.citation && (
                              <div className="text-[10px] font-mono text-slate-400 pt-1 border-t border-slate-800 flex items-center gap-1.5">
                                <span>Source Reference:</span>
                                <strong className="text-sky-300">{q.citation}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Bottom Action / Submission Bar */}
              <div className="pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                {!selfPacedSubmitted ? (
                  <>
                    <div className="text-xs text-slate-400 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
                      <span>
                        Choose your answers and click <strong>Submit Practice Test</strong> to evaluate your score and read step rationales.
                      </span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={resetSelfPacedTest}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-dark-950 hover:bg-dark-850 text-slate-400 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Reset Choices
                      </button>
                      <button
                        type="button"
                        onClick={handleSubmitSelfPacedTest}
                        disabled={selfPacedAnsweredCount === 0}
                        className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-black font-extrabold text-xs shadow-[0_0_25px_rgba(56,189,248,0.4)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5 text-black" /> Submit Practice Test ({selfPacedAnsweredCount}/{selfPacedTotalQuestions})
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-xs text-slate-300 flex items-center gap-2">
                      <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>
                        Practice test complete! Score: <strong className="text-white">{selfPacedCorrectCount}/{selfPacedTotalQuestions} ({selfPacedScorePercent}%)</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={resetSelfPacedTest}
                        className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-dark-950 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-800 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Retake This Set
                      </button>
                      <button
                        type="button"
                        onClick={() => handleGenerateSelfPacedTest()}
                        disabled={generatingSelfPaced}
                        className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-black font-bold text-xs shadow-neon-sm flex items-center justify-center gap-2 transition"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-black" /> Generate Another Set
                      </button>
                    </div>
                  </>
                )}
              </div>

            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FORMATIVE ASSESSMENTS (TEACHER ASSIGNED TESTS) */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'assessments') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-orange" />
              <div>
                <h2 className="text-lg font-bold text-white">Formative Assessments (Assigned Tests)</h2>
                <p className="text-xs text-slate-400">Formal instructor-assigned tests with timed examination limits and verified mastery scoring</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">{displayedAssignments.length} Assigned Test(s)</span>
          </div>

          {displayedAssignments.length === 0 ? (
            <GlassCard className="text-center py-10">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active assigned tests in this domain.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {displayedAssignments.map((a) => (
                <div
                  key={a.assignment_id}
                  className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-neon-orange/40 transition-all space-y-3 bg-dark-900/80 hover:bg-dark-900 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neon-orange/15 text-neon-orange border border-neon-orange/30 uppercase">
                            {a.subject || a.domain || 'Domain Assessment'}
                          </span>
                          <span className="text-[11px] font-mono text-slate-400">{a.unit_title}</span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-dark-950 border border-slate-700 text-neon-glow flex items-center gap-1">
                            <Clock className="w-3 h-3 text-neon-orange" /> {a.time_limit_minutes || 15} Mins
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white">{a.title}</h4>
                        <p className="text-xs text-slate-400">
                          {a.questions?.length || 0} Objective-Grounded Questions · Max {a.max_attempts} Attempt(s)
                        </p>
                      </div>

                      <Badge variant="warning">
                        {`${a.attempts_remaining !== undefined ? a.attempts_remaining : (a.max_attempts - (a.attempts_used || 0))} Attempt(s) Remaining`}
                      </Badge>
                    </div>

                    {a.latest_submission && (
                      <div className="p-3 rounded-xl bg-dark-950 border border-slate-800 text-xs flex items-center justify-between">
                        <span className="text-slate-400">Latest Mastery Index:</span>
                        <span className="font-bold text-neon-glow font-mono text-sm">{a.latest_submission.score}%</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2.5 flex items-center justify-between border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {a.due_date ? `Due: ${new Date(a.due_date).toLocaleDateString()}` : 'No Due Date'}
                    </span>

                    {a.can_attempt ? (
                      <button
                        onClick={() => onTakeAssessment(a)}
                        className="px-4 py-2 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-bold shadow-neon-sm flex items-center gap-1.5 transition-all"
                      >
                        Attempt Assessment <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onTakeAssessment(a)}
                        className="px-3.5 py-1.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-300 text-xs font-semibold"
                      >
                        View Breakdown
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Join Classroom Modal */}
      {showJoinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-neon-orange" /> Join Classroom via Code
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Enter the 6-character uppercase code provided by your instructor.
            </p>

            {joinMessage && (
              <div className="mb-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>{joinMessage}</span>
              </div>
            )}

            <form onSubmit={handleJoinClassroom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Classroom Join Code</label>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="e.g. BIO101"
                  required
                  maxLength={12}
                  className="w-full rounded-xl glass-input p-3 text-center text-lg font-mono tracking-widest uppercase font-bold text-neon-amber"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowJoinModal(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={joining}
                  className="btn-royal text-xs py-2 px-4"
                >
                  {joining ? 'Verifying...' : 'Enroll in Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentDashboard;
