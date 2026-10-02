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
    <div className="space-y-6 pb-16">
      
      {/* Welcome Banner */}
      <div className="rounded-xl glass-panel-accent p-6 border border-slate-800 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400 font-semibold">Educator Studio Control</span>
            <Badge variant="approved">Authoritative Access</Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Welcome back, {user?.name}
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
            Upload authoritative documents, define objective contracts, generate grounded learning packs, and monitor classroom mastery.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => onNavigate('teacher_studio')}
            className="btn-royal text-xs flex items-center gap-1.5 py-2.5 px-4"
          >
            <Sparkles className="w-4 h-4" /> Generate Lesson
          </button>

          <button
            onClick={() => setShowHistoryModal(true)}
            className="btn-royal-outline text-xs flex items-center gap-1.5 py-2.5 px-3.5"
          >
            <History className="w-4 h-4 text-brand-400" /> History ({units.length})
          </button>

          <button
            onClick={() => setShowClassModal(true)}
            className="btn-royal-outline text-xs flex items-center gap-1.5 py-2.5 px-3.5"
          >
            <Plus className="w-4 h-4" /> New Classroom
          </button>
        </div>
      </div>

      {/* Grid: Units and Classrooms */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Assigned Lessons Column (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Assigned Learning Packs</h2>
              <Badge variant="approved">{assignedUnits.length} Live in Classrooms</Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowHistoryModal(true)}
                className="text-xs text-slate-400 hover:text-white font-medium flex items-center gap-1 transition-colors"
              >
                <History className="w-3.5 h-3.5" /> Full History ({units.length})
              </button>
              <button
                onClick={() => onNavigate('teacher_studio')}
                className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
              >
                Generate Lesson <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-brand-400" /> Loading units...
            </div>
          ) : assignedUnits.length === 0 ? (
            <GlassCard className="text-center py-10">
              <Layers className="w-8 h-8 text-slate-600 mx-auto mb-2.5" />
              <h3 className="text-xs font-semibold text-white mb-1">No Lessons Assigned to Classrooms Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
                {units.length > 0 
                  ? `You have ${units.length} generated lesson pack(s) stored in your History. Open History to assign them to active classrooms.`
                  : "Upload documents to generate objective-aligned lesson packs and assign them to your classrooms."}
              </p>
              <div className="flex items-center justify-center gap-2.5">
                {units.length > 0 && (
                  <button onClick={() => setShowHistoryModal(true)} className="btn-royal text-xs flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Open History ({units.length})
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
                  className="rounded-xl glass-panel p-4 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer group space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block mb-0.5">
                        Authoritative Source: {u.source_title}
                      </span>
                      <h3 className="text-sm font-semibold text-white group-hover:text-brand-300 transition-colors">
                        {u.title}
                      </h3>

                      {/* Assigned Classrooms Badges */}
                      {u.assigned_classrooms && u.assigned_classrooms.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                          <span className="text-[10px] text-slate-400 font-mono">Assigned to:</span>
                          {u.assigned_classrooms.map((c) => (
                            <span 
                              key={c.id} 
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono"
                            >
                              {c.name} {c.subject ? `(${c.subject})` : ''}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-400">
                        <span className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-brand-400" />
                          {u.objectives_count} Objectives
                        </span>
                        <span className="flex items-center gap-1.5 font-mono text-[11px]">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          {u.assets_count} Pack Assets
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-2">
                      <button className="px-2.5 py-1 rounded-md bg-dark-800 text-slate-200 border border-slate-700 text-xs font-medium group-hover:bg-brand-600 group-hover:text-white group-hover:border-brand-500 transition-all flex items-center gap-1">
                        Open Studio <ArrowRight className="w-3 h-3" />
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
              <BookOpen className="w-4 h-4 text-brand-400" />
              <h2 className="text-sm font-semibold text-slate-100 tracking-tight">Active Classrooms</h2>
            </div>
            <button
              onClick={() => setShowClassModal(true)}
              className="text-xs text-brand-400 hover:text-brand-300 font-medium"
            >
              + Create
            </button>
          </div>

          <div className="space-y-3">
            {classrooms.map((c) => (
              <div
                key={c.id}
                className="rounded-xl glass-panel p-4 border border-slate-800 space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold block">{c.subject}</span>
                    <h4 className="text-xs font-semibold text-white">{c.name} {c.subject ? `(${c.subject})` : ''}</h4>
                  </div>
                  <Badge variant="bloom">{c.student_count} Students</Badge>
                </div>

                {/* Join Code box */}
                <div className="p-2 rounded-lg bg-dark-950 border border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">Join Code: <b className="text-brand-300 font-mono tracking-wider">{c.join_code}</b></span>
                  <button
                    onClick={() => copyJoinCode(c.join_code)}
                    className="p-1 rounded text-slate-400 hover:text-white"
                    title="Copy Join Code"
                  >
                    {copiedCode === c.join_code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>

                <div className="pt-1 flex items-center justify-between">
                  <button
                    onClick={() => onSelectClassroom(c.id)}
                    className="text-xs text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1"
                  >
                    Manage Roster & Analytics <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LESSON GENERATION HISTORY MODAL */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-3xl rounded-2xl glass-panel p-6 border border-slate-800 shadow-elevated max-h-[85vh] flex flex-col">
            
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-3.5 border-b border-slate-800 shrink-0">
              <div>
                <div className="flex items-center gap-2">
                  <History className="w-4 h-4 text-brand-400" />
                  <h3 className="text-base font-semibold text-white tracking-tight">Generated Lessons History</h3>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  All {units.length} objective-grounded lesson units generated and stored in history.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-400 hover:text-white border border-slate-700 text-xs"
              >
                ✕ Close
              </button>
            </div>

            {/* List of all generated units */}
            <div className="overflow-y-auto py-3.5 space-y-3 flex-1 pr-1">
              {units.length === 0 ? (
                <div className="text-center py-10 text-slate-500 text-xs">
                  No lessons generated yet. Click "Generate Lesson" to create your first learning pack.
                </div>
              ) : (
                units.map((u) => {
                  const isAssigned = u.is_assigned || (u.assigned_classrooms && u.assigned_classrooms.length > 0);
                  return (
                    <div
                      key={u.id}
                      className="p-3.5 rounded-xl glass-panel border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-mono uppercase text-slate-400 font-semibold">
                              Source: {u.source_title}
                            </span>
                            <span className="text-slate-600">·</span>
                            <span className="text-[10px] font-mono text-slate-400">
                              {new Date(u.created_at).toLocaleDateString()}
                            </span>
                          </div>
                          <h4 className="text-xs font-semibold text-white">{u.title}</h4>
                        </div>

                        <Badge variant={isAssigned ? 'approved' : 'warning'}>
                          {isAssigned ? `Assigned (${u.assigned_classrooms.length} Class)` : 'Draft / Unassigned'}
                        </Badge>
                      </div>

                      {/* Assigned Classrooms tags */}
                      {isAssigned ? (
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="text-[10px] font-mono text-slate-400">Assigned to:</span>
                          {u.assigned_classrooms.map((c) => (
                            <span
                              key={c.id}
                              className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-mono"
                            >
                              {c.name} {c.subject ? `(${c.subject})` : ''}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[11px] text-amber-300/80 italic">
                          Not assigned to any classroom yet. Students cannot access this unit until assigned.
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                          <span>{u.objectives_count} Objectives</span>
                          <span>·</span>
                          <span>{u.assets_count} Pack Assets</span>
                        </div>

                        <button
                          onClick={() => {
                            setShowHistoryModal(false);
                            onSelectUnit(u.id);
                          }}
                          className="px-3 py-1 rounded-md bg-brand-600 hover:bg-brand-500 text-white text-xs font-medium flex items-center gap-1 transition-all"
                        >
                          Open in Studio <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between shrink-0">
              <span className="text-xs font-mono text-slate-400">
                Total Stored: <b className="text-white">{units.length}</b> Units ({units.filter(u => u.is_assigned).length} Assigned, {units.filter(u => !u.is_assigned).length} Unassigned)
              </span>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  onNavigate('teacher_studio');
                }}
                className="btn-royal text-xs flex items-center gap-1 py-1.5 px-3"
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
          <div className="w-full max-w-md rounded-xl glass-panel p-6 border border-slate-800 shadow-elevated">
            <h3 className="text-base font-semibold text-white mb-1">Create New Classroom</h3>
            <p className="text-xs text-slate-400 mb-4">
              A 6-character uppercase join code will be generated automatically for student onboarding.
            </p>

            <form onSubmit={handleCreateClassroom} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Classroom Name</label>
                <input
                  type="text"
                  value={className}
                  onChange={(e) => setClassName(e.target.value)}
                  placeholder="e.g. Molecular Bio Section A"
                  required
                  className="w-full rounded-lg glass-input p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Subject Domain</label>
                <input
                  type="text"
                  value={classSubject}
                  onChange={(e) => setClassSubject(e.target.value)}
                  placeholder="e.g. Biology / Computer Science"
                  required
                  className="w-full rounded-lg glass-input p-2.5 text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowClassModal(false)}
                  className="px-3.5 py-1.5 rounded-lg text-xs bg-dark-800 text-slate-300 hover:bg-dark-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingClass}
                  className="btn-royal text-xs py-1.5 px-4"
                >
                  {creatingClass ? 'Creating...' : 'Create Classroom'}
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
