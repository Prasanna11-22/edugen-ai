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
  Target
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

  // Join Classroom Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    fetchStudentClassrooms();
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
      setTimeout(() => setShowJoinModal(false), 1500);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setJoining(false);
    }
  };

  // Filter assignments and materials by selected domain/classroom
  const displayedAssignments = selectedClassId === 'all'
    ? allData.assignments
    : allData.assignments.filter(a => a.classroom_id === selectedClassId);

  const displayedMaterials = selectedClassId === 'all'
    ? allData.materials
    : allData.materials.filter(m => m.classroom_id === selectedClassId);

  // Separate dedicated practice question sets from study packs
  const displayedPracticeSets = displayedMaterials.filter(
    m => m.content?.questions && m.content.questions.length > 0
  );

  const activeClassroom = classrooms.find(c => c.classroom_id === selectedClassId);

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
            Access verified full study packs, solve self-paced practice questions, and attempt timed formative assessments.
          </p>

          {/* Quick Metrics Bar */}
          <div className="flex items-center gap-3 pt-4 flex-wrap text-xs">
            <div className="px-3 py-1.5 rounded-xl bg-dark-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-mono">
              <BookOpen className="w-3.5 h-3.5 text-neon-orange" />
              <span><strong>{displayedMaterials.length}</strong> Study Packs</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-dark-950/80 border border-slate-800 text-slate-300 flex items-center gap-1.5 font-mono">
              <HelpCircle className="w-3.5 h-3.5 text-sky-400" />
              <span><strong>{displayedPracticeSets.length}</strong> Practice Sets</span>
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

      {/* Module View Tabs: All, Full Study Packs, Practice Questions, Formative Assessments */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-800">
        {[
          { id: 'all', label: 'All Learning Modules', icon: Layers, count: displayedMaterials.length + displayedPracticeSets.length + displayedAssignments.length },
          { id: 'packs', label: 'Full Study Packs', icon: BookOpen, count: displayedMaterials.length },
          { id: 'practice', label: 'Self-Paced Practice Questions', icon: HelpCircle, count: displayedPracticeSets.length },
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
                <p className="text-xs text-slate-400">All-in-one comprehensive curriculum notes, worked steps, revision sheets, and glossary</p>
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
                          {m.content?.title || `Comprehensive Study Material: ${m.unit_title}`}
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

                  <div className="pt-3 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/80">
                    <span className="font-mono text-[11px] text-slate-400">
                      Citations: {m.content?.chunk_citations?.length || 0} Chunks
                    </span>
                    <span className="text-neon-orange group-hover:text-neon-amber font-bold flex items-center gap-1 text-xs">
                      Open Full Study Pack & PDF <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 2: SEPARATE SELF-PACED PRACTICE QUESTIONS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'practice') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-sky-400" />
              <div>
                <h2 className="text-lg font-bold text-white">Self-Paced Practice Questions</h2>
                <p className="text-xs text-slate-400">Separate untimed formative practice sets with interactive answer testing & distractor rationales</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">{displayedPracticeSets.length} Practice Set(s)</span>
          </div>

          {displayedPracticeSets.length === 0 ? (
            <GlassCard className="text-center py-10">
              <HelpCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No practice questions available in this domain.</p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {displayedPracticeSets.map((m) => {
                const qList = m.content?.questions || [];
                const cognitiveTiers = Array.from(new Set(qList.map(q => q.cognitive_tier).filter(Boolean)));

                return (
                  <div
                    key={`practice-${m.unit_id || m.version_id}`}
                    className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-sky-500/40 transition-all space-y-4 bg-dark-900/80 hover:bg-dark-900 flex flex-col justify-between group"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/15 text-sky-400 border border-sky-500/30 uppercase">
                          {m.subject || m.domain || 'Domain'} Practice
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-dark-950 border border-slate-700 text-sky-300 flex items-center gap-1">
                          <Target className="w-3 h-3 text-sky-400" /> {qList.length} Questions
                        </span>
                      </div>

                      <div>
                        <span className="text-[11px] font-mono text-slate-400 block mb-0.5">{m.unit_title}</span>
                        <h4 className="text-base font-bold text-white group-hover:text-sky-300 transition-colors">
                          Practice Set: {m.unit_title}
                        </h4>
                      </div>

                      <p className="text-xs text-slate-400 leading-relaxed font-sans">
                        Untimed self-study questions designed to reinforce core syllabus principles with immediate rationale verification.
                      </p>

                      {/* Cognitive Tiers Pills */}
                      {cognitiveTiers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[10px] font-mono text-slate-500 mr-1">Tiers:</span>
                          {cognitiveTiers.map((tier, tIdx) => (
                            <span key={tIdx} className="px-2 py-0.5 rounded-md bg-dark-950 border border-slate-800 text-[10px] font-mono text-slate-300">
                              {tier}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Instant Solutions
                      </span>
                      <button
                        onClick={() => onViewMaterial(m, 'practice')}
                        className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                      >
                        Start Practice <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 3: FORMATIVE ASSESSMENTS */}
      {/* ========================================================================= */}
      {(selectedCategory === 'all' || selectedCategory === 'assessments') && (
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-1 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-orange" />
              <div>
                <h2 className="text-lg font-bold text-white">Formative Assessments</h2>
                <p className="text-xs text-slate-400">Formal timed assessments with limited attempts and automated mastery scoring</p>
              </div>
            </div>
            <span className="text-xs text-slate-400 font-mono">{displayedAssignments.length} Available</span>
          </div>

          {displayedAssignments.length === 0 ? (
            <GlassCard className="text-center py-10">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active assessments in this domain.</p>
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

                      <Badge variant={a.can_attempt ? 'warning' : 'approved'}>
                        {a.can_attempt ? `${a.attempts_used}/${a.max_attempts} Attempts` : 'COMPLETED'}
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
