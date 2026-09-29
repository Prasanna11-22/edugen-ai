import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  BookOpen, Sparkles, Plus, Users, Layers, ArrowRight, Copy, Check, 
  Hash, RefreshCw, History, Calendar, CheckCircle2, AlertCircle, FileText
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const TeacherDashboard = ({ onNavigate, onSelectUnit, onSelectClassroom }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [classrooms, setClassrooms] = useState([]);
  const [units, setUnits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState('');

  // History modal state
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  // Create classroom modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [className, setClassName] = useState('');
  const [classSubject, setClassSubject] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [cRes, uRes] = await Promise.all([
        fetch('/api/teacher/classrooms', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/teacher/units', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);
      if (cRes.ok) setClassrooms(await cRes.json());
      if (uRes.ok) setUnits(await uRes.json());
    } catch (err) {
      console.error("Dashboard error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateClassroom = async (e) => {
    e.preventDefault();
    if (!className.trim() || !classSubject.trim()) return;
    setCreatingClass(true);
    try {
      const res = await fetch('/api/teacher/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: className, subject: classSubject })
      });
      if (res.ok) {
        const newClass = await res.json();
        setShowClassModal(false);
        setClassName('');
        setClassSubject('');
        showToast(`Classroom '${newClass.name}' created! (Join Code: ${newClass.join_code})`, "success");
        fetchDashboardData();
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingClass(false);
    }
  };

  const copyJoinCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(''), 2000);
  };

  // Filter units: On dashboard, only show units that are assigned to classroom(s)
  const assignedUnits = units.filter(u => u.is_assigned || (u.assigned_classrooms && u.assigned_classrooms.length > 0));

  return (
    <div className="space-y-8 pb-16">
      
      {/* Welcome Banner */}
      <div className="rounded-3xl glass-panel-accent p-8 border border-neon-orange/40 shadow-neon flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-neon-amber font-bold">Educator Studio Control</span>
            <Badge variant="approved">Authoritative Access</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome back, <span className="text-neon-glow">{user?.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Upload authoritative documents, define objective contracts, generate grounded learning packs, and monitor classroom mastery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onNavigate('teacher_studio')}
            className="btn-royal text-xs flex items-center gap-2 py-3 px-5 shadow-neon"
          >
            <Sparkles className="w-4 h-4" /> Generate Lesson
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="px-4 py-3 rounded-xl bg-dark-900/90 hover:bg-dark-800 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-2 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-neon-amber" /> History ({units.length})
          </button>

          <button
            onClick={() => setShowClassModal(true)}
            className="btn-royal-outline text-xs flex items-center gap-2 py-3 px-5"
          >
            <Plus className="w-4 h-4" /> New Classroom
          </button>
        </div>
      </div>

      {/* Grid: Units and Classrooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Assigned Lessons Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-neon-orange" />
              <h2 className="text-lg font-bold text-white">Assigned Learning Packs</h2>
              <Badge variant="approved">{assignedUnits.length} Live in Classrooms</Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="text-xs text-neon-amber hover:text-white font-semibold flex items-center gap-1 transition-colors"
              >
                <History className="w-3.5 h-3.5" /> Full History ({units.length})
              </button>
              <button
                onClick={() => onNavigate('teacher_studio')}
                className="text-xs text-neon-orange hover:text-neon-amber font-semibold flex items-center gap-1"
              >
                Generate Lesson <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Loading units from PostgreSQL...
            </div>
          ) : assignedUnits.length === 0 ? (
            <GlassCard className="text-center py-12">
              <Layers className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">No Lessons Assigned to Classrooms Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                {units.length > 0 
                  ? `You have ${units.length} generated lesson pack(s) stored in your History. Open History to assign them to active classrooms.`
                  : "Upload documents to generate objective-aligned lesson packs and assign them to your classrooms."}
              </p>
              <div className="flex items-center justify-center gap-3">
                {units.length > 0 && (
                  <button onClick={() => setShowHistoryModal(true)} className="btn-royal text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Open Lesson History ({units.length})
                  </button>
                )}
                <button onClick={() => onNavigate('teacher_studio')} className="btn-royal-outline text-xs">
                  Generate New Lesson
                </button>
              </div>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {assignedUnits.map((u) => (
                <div
                  key={u.id}
                  onClick={() => onSelectUnit(u.id)}
                  className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-neon-orange/50 transition-all cursor-pointer group space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-neon-orange font-semibold block mb-1">
                        Authoritative Source: {u.source_title}
                      </span>
                      <h3 className="text-base font-bold text-white group-hover:text-neon-glow transition-colors">
                        {u.title}
                      </h3>

                      {/* Assigned Classrooms Badges */}
                      {u.assigned_classrooms && u.assigned_classrooms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-400 font-mono">Assigned to:</span>
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

                      <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1 font-mono">
                          <span className="w-2 h-2 rounded-full bg-neon-orange" />
                          {u.objectives_count} Objectives
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                          {u.assets_count} Pack Assets Generated
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button className="px-3 py-1.5 rounded-xl bg-neon-orange/15 text-neon-glow border border-neon-orange/40 text-xs font-semibold group-hover:bg-neon-orange group-hover:text-white transition-all flex items-center gap-1">
                        Open Studio <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Classrooms Column (1 col) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-neon-orange" />
              <h2 className="text-lg font-bold text-white">Active Classrooms</h2>
            </div>
            <button
              onClick={() => setShowClassModal(true)}
              className="text-xs text-neon-orange hover:text-neon-amber font-semibold"
            >
              + Create
            </button>
          </div>

          {classrooms.map((c) => (
            <div
              key={c.id}
              className="rounded-2xl glass-panel p-5 border border-slate-800 space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-mono uppercase text-neon-orange font-semibold block">{c.subject}</span>
                  <h4 className="text-base font-bold text-white">{c.name} {c.subject ? `(${c.subject})` : ''}</h4>
                </div>
                <Badge variant="bloom">{c.student_count} Students</Badge>
              </div>

              {/* Join Code box */}
              <div className="p-2.5 rounded-xl bg-dark-950/80 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400 font-mono">Join Code: <b className="text-neon-amber font-mono tracking-wider">{c.join_code}</b></span>
                <button
                  onClick={() => copyJoinCode(c.join_code)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Copy Join Code"
                >
                  {copiedCode === c.join_code ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="pt-1 flex items-center justify-between">
                <button
                  onClick={() => onSelectClassroom(c.id)}
                  className="text-xs text-neon-orange hover:text-neon-amber font-semibold flex items-center gap-1"
                >
                  Manage Roster & Analytics <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

      </div>

      {/* LESSON GENERATION HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl rounded-3xl glass-panel-accent p-6 sm:p-8 border border-neon-orange/40 shadow-neon max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-neon-orange" />
                  <h3 className="text-xl font-bold text-white">Generated Lessons History</h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  All {units.length} objective-grounded lesson units generated and stored in PostgreSQL storage.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700 text-xs font-semibold"
              >
                ✕ Close
              </button>
            </div>

            {/* List of all generated units */}
            <div className="overflow-y-auto py-4 space-y-3.5 flex-1 pr-1">
              {units.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs">
                  No lessons generated yet. Click "Generate Lesson" to create your first learning pack.
                </div>
              ) : (
                units.map((u) => {
                  const isAssigned = u.is_assigned || (u.assigned_classrooms && u.assigned_classrooms.length > 0);
                  return (
                    <div
                      key={u.id}
                      className="p-4 rounded-2xl glass-panel border border-slate-800 hover:border-neon-orange/40 transition-all space-y-3"
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
                          <h4 className="text-base font-bold text-white">{u.title}</h4>
                        </div>

                        <Badge variant={isAssigned ? 'approved' : 'warning'}>
                          {isAssigned ? `Assigned (${u.assigned_classrooms.length} Class)` : 'Draft / Unassigned'}
                        </Badge>
                      </div>

                      {/* Assigned Classrooms tags */}
                      {isAssigned ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <span className="text-[10px] font-mono text-slate-400">Assigned to:</span>
                          {u.assigned_classrooms.map((c) => (
                            <span
                              key={c.id}
                              className="px-2.5 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 font-mono"
                            >
                              {c.name} {c.subject ? `(${c.subject})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-400/80 italic">
                          Not assigned to any classroom yet. Students cannot access this unit until assigned.
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                        <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
                          <span>{u.objectives_count} Objectives</span>
                          <span>·</span>
                          <span>{u.assets_count} Pack Assets</span>
                        </div>

                        <button
                          onClick={() => {
                            setShowHistoryModal(false);
                            onSelectUnit(u.id);
                          }}
                          className="px-3.5 py-1.5 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-semibold shadow-neon-sm flex items-center gap-1.5 transition-all"
                        >
                          Open in Studio <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-4 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono text-slate-400">
                Total Stored: <b className="text-white">{units.length}</b> Units ({units.filter(u => u.is_assigned).length} Assigned, {units.filter(u => !u.is_assigned).length} Unassigned)
              </span>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  onNavigate('teacher_studio');
                }}
                className="btn-royal text-xs flex items-center gap-1.5 py-2 px-4 shadow-neon"
              >
                <Sparkles className="w-3.5 h-3.5" /> Generate New Lesson
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Create Classroom Modal */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <h3 className="text-lg font-bold text-white mb-2">Create New Classroom</h3>
            <p className="text-xs text-slate-300 mb-4">
              A 6-character uppercase join code will be generated automatically for student onboarding.
            </p>

            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Classroom Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Molecular Bio Section A"
                  required
                  className="w-full rounded-xl glass-input p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject Domain</label>
                <input
                  type="text"
                  value={classSubject}
                  onChange={(e) => setClassSubject(e.target.value)}
                  placeholder="e.g. Biology / Computer Science"
                  required
                  className="w-full rounded-xl glass-input p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClass}
                  className="btn-royal text-xs py-2 px-4"
                >
                  {creatingClass ? 'Creating...' : 'Generate Classroom'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherDashboard;
