import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  GraduationCap, BookOpen, Clock, FileCheck, ArrowRight, Download, 
  Plus, CheckCircle2, Award, RefreshCw, AlertCircle
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const StudentDashboard = ({ onTakeAssessment, onViewMaterial }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);

  // Join Classroom Modal
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinMessage, setJoinMessage] = useState('');

  useEffect(() => {
    fetchStudentClassrooms();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchClassData(selectedClassId);
    }
  }, [selectedClassId]);

  const fetchStudentClassrooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/student/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(data);
        if (data.length > 0 && !selectedClassId) {
          setSelectedClassId(data[0].classroom_id);
        }
      }
    } catch (err) {
      console.error("Error fetching classrooms", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchClassData = async (classId) => {
    try {
      const [aRes, mRes] = await Promise.all([
        fetch(`/api/student/assignments?classroom_id=${classId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`/api/student/materials?classroom_id=${classId}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      if (aRes.ok) setAssignments(await aRes.json());
      if (mRes.ok) setMaterials(await mRes.json());
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

  return (
    <div className="space-y-8 pb-16">
      
      {/* Student Welcome Banner */}
      <div className="rounded-3xl glass-panel-accent p-8 border border-neon-orange/40 shadow-neon flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono uppercase tracking-widest text-neon-amber font-bold">Student Portal</span>
            <Badge variant="bloom">Formative Practice Mode</Badge>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white">
            Welcome, <span className="text-neon-glow">{user?.name}</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-xl">
            Access verified study packs, complete objective-aligned formative assessments, and track continuous mastery signals.
          </p>
        </div>

        <button
          onClick={() => setShowJoinModal(true)}
          className="btn-royal text-xs flex items-center gap-2 py-3 px-5 shadow-neon shrink-0"
        >
          <Plus className="w-4 h-4" /> Join Classroom with Code
        </button>
      </div>

      {/* Classroom Selector Tabs */}
      {classrooms.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800">
          {classrooms.map((c) => (
            <button
              key={c.classroom_id}
              onClick={() => setSelectedClassId(c.classroom_id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${selectedClassId === c.classroom_id ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-400 hover:text-white bg-dark-900 border border-slate-800'}`}
            >
              {c.name} ({c.subject})
            </button>
          ))}
        </div>
      )}

      {/* Main Grid: Active Assessments & Approved Study Packs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Active Formative Assessments */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-neon-orange" />
              <h2 className="text-lg font-bold text-white">Formative Assessments</h2>
            </div>
            <span className="text-xs text-slate-400 font-mono">{assignments.length} Available</span>
          </div>

          {assignments.length === 0 ? (
            <GlassCard className="text-center py-10">
              <FileCheck className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No active assessments currently assigned.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => (
                <div
                  key={a.assignment_id}
                  className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-neon-orange/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-mono text-neon-orange uppercase font-bold">
                          {a.unit_title || 'Objective Assessment'}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-dark-900 border border-slate-700 text-neon-glow flex items-center gap-1">
                          <Clock className="w-3 h-3 text-neon-orange" /> {a.time_limit_minutes || 15} Mins
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{a.title}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {a.questions?.length || 0} Objective-Grounded Questions · Full Assessment Set · Max {a.max_attempts} Attempt(s)
                      </p>
                    </div>

                    <Badge variant={a.can_attempt ? 'warning' : 'approved'}>
                      {a.can_attempt ? `${a.attempts_used}/${a.max_attempts} Attempts` : 'COMPLETED'}
                    </Badge>
                  </div>

                  {a.latest_submission && (
                    <div className="p-2.5 rounded-xl bg-dark-950/80 border border-slate-800 text-xs flex items-center justify-between">
                      <span className="text-slate-400">Latest Mastery Index:</span>
                      <span className="font-bold text-neon-glow font-mono">{a.latest_submission.score}%</span>
                    </div>
                  )}

                  <div className="pt-2 flex items-center justify-between border-t border-slate-800/80">
                    <span className="text-[11px] text-slate-500 font-mono">
                      {a.due_date ? `Due: ${new Date(a.due_date).toLocaleDateString()}` : 'No Due Date'}
                    </span>

                    {a.can_attempt ? (
                      <button
                        onClick={() => onTakeAssessment(a)}
                        className="px-4 py-1.5 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-semibold shadow-neon-sm flex items-center gap-1.5 transition-all"
                      >
                        Attempt Assessment <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onTakeAssessment(a)}
                        className="px-3 py-1.5 rounded-xl bg-dark-800 text-slate-300 text-xs font-semibold"
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

        {/* Approved Learning Materials (Explanation & Revision Sheets) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-neon-orange" />
              <h2 className="text-lg font-bold text-white">Approved Study Materials</h2>
            </div>
            <Badge variant="approved">Server-Side Gated</Badge>
          </div>

          {materials.length === 0 ? (
            <GlassCard className="text-center py-10">
              <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-xs text-slate-400">No approved study packs published yet.</p>
            </GlassCard>
          ) : (
            <div className="space-y-3">
              {materials.map((m) => (
                <div
                  key={m.version_id}
                  onClick={() => onViewMaterial(m)}
                  className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-neon-orange/40 transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-mono text-neon-amber uppercase block">
                        {m.unit_title} · {m.type.replace(/_/g, ' ')}
                      </span>
                      <h4 className="text-base font-bold text-white group-hover:text-neon-glow transition-colors">
                        {m.content?.title || m.objective_text}
                      </h4>
                    </div>
                    <Badge variant="royal">v{m.version_no}</Badge>
                  </div>

                  <p className="text-xs text-slate-400 line-clamp-2">
                    {m.content?.explanation || m.content?.summary || 'Authoritative grounded learning pack approved by instructor.'}
                  </p>

                  <div className="pt-2 flex items-center justify-between text-xs text-slate-500 border-t border-slate-800/60">
                    <span className="font-mono text-[11px] text-slate-400">
                      Citations: {m.content?.chunk_citations?.length || 0} Chunks
                    </span>
                    <span className="text-neon-orange group-hover:text-neon-amber font-semibold flex items-center gap-1">
                      Read Pack & Export PDF <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

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
