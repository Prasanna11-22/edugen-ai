import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Users, UserPlus, Upload, BarChart3, Target, Award, Key, Copy, Check, 
  RefreshCw, CheckCircle2, ChevronRight, BookOpen, AlertCircle, Sparkles, Plus, GraduationCap, FolderPlus
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const TeacherClassroomPage = ({ classroomId, onBack }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  
  // Tabs: 'students' or 'classrooms'
  const [activeTab, setActiveTab] = useState('students');
  
  // Data states
  const [allStudents, setAllStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(classroomId || null);
  const [analytics, setAnalytics] = useState(null);
  
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Student creation modal states
  const [showSingleModal, setShowSingleModal] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [singleName, setSingleName] = useState('');
  const [singleEmail, setSingleEmail] = useState('');
  const [singlePassword, setSinglePassword] = useState('');
  const [createdStudent, setCreatedStudent] = useState(null);
  const [bulkText, setBulkText] = useState('');
  const [bulkCreatedStudents, setBulkCreatedStudents] = useState([]);
  const [modalClassroomId, setModalClassroomId] = useState('');

  // Classroom creation modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  // Copy state
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    fetchStudentsDirectory();
    fetchClassroomsList();
  }, []);

  useEffect(() => {
    if (selectedClassId) {
      fetchAnalytics(selectedClassId);
    }
  }, [selectedClassId]);

  const fetchStudentsDirectory = async () => {
    setLoadingStudents(true);
    try {
      const res = await fetch('/api/teacher/students', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAllStudents(await res.json());
      }
    } catch (err) {
      console.error("Error fetching students directory", err);
    } finally {
      setLoadingStudents(false);
    }
  };

  const fetchClassroomsList = async () => {
    try {
      const res = await fetch('/api/teacher/classrooms', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setClassrooms(data);
        if (!selectedClassId && data.length > 0) {
          setSelectedClassId(data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching classrooms", err);
    }
  };

  const fetchAnalytics = async (classId) => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`/api/teacher/classrooms/${classId}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setAnalytics(await res.json());
      }
    } catch (err) {
      console.error("Analytics fetch error", err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleCreateClassroom = async (e) => {
    e.preventDefault();
    if (!newClassName.trim() || !newClassSubject.trim()) return;
    setCreatingClass(true);
    try {
      const res = await fetch('/api/teacher/classrooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ name: newClassName, subject: newClassSubject })
      });
      if (res.ok) {
        const newClass = await res.json();
        setShowClassModal(false);
        setNewClassName('');
        setNewClassSubject('');
        await fetchClassroomsList();
        setSelectedClassId(newClass.id);
        setActiveTab('classrooms');
        showToast(`Classroom '${newClass.name}' created with Join Code: ${newClass.join_code}`, "success");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingClass(false);
    }
  };

  const handleCreateSingleStudent = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teacher/students/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: singleName,
          email: singleEmail,
          password: singlePassword || undefined,
          classroom_id: modalClassroomId ? Number(modalClassroomId) : undefined
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Creation failed');
      setCreatedStudent(data);
      setSingleName('');
      setSingleEmail('');
      setSinglePassword('');
      showToast(`Student credentials created for ${data.email}!`, "success");
      await fetchStudentsDirectory();
      if (selectedClassId) await fetchAnalytics(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleCreateBulkStudents = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/teacher/students/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classroom_id: modalClassroomId ? Number(modalClassroomId) : undefined,
          students_raw: bulkText
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Bulk creation failed');
      setBulkCreatedStudents(data.students);
      setBulkText('');
      showToast(`Successfully created ${data.count} student accounts!`, "success");
      await fetchStudentsDirectory();
      if (selectedClassId) await fetchAnalytics(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const activeClass = classrooms.find(c => c.id === selectedClassId);

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner & Primary Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-neon-orange" />
            <h1 className="text-2xl font-bold text-white">Student Directory & Classroom Manager</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Independent student credential issuance and unique join code classroom routing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => { setModalClassroomId(''); setShowSingleModal(true); }}
            className="btn-royal text-xs flex items-center gap-1.5 py-2.5 px-4 shadow-neon"
          >
            <UserPlus className="w-4 h-4" /> Single Student
          </button>

          <button
            onClick={() => { setModalClassroomId(''); setShowBulkModal(true); }}
            className="btn-royal-outline text-xs flex items-center gap-1.5 py-2.5 px-4"
          >
            <Upload className="w-4 h-4" /> Bulk CSV
          </button>

          <button
            onClick={() => setShowClassModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-dark-800 hover:bg-dark-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5 text-neon-orange" /> New Classroom
          </button>
        </div>
      </div>

      {/* Navigation Tab Bar */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'students' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-400 hover:text-white bg-dark-900 border border-slate-800'}`}
        >
          <Users className="w-4 h-4" /> Student Credentials Directory ({allStudents.length})
        </button>

        <button
          onClick={() => setActiveTab('classrooms')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'classrooms' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-400 hover:text-white bg-dark-900 border border-slate-800'}`}
        >
          <BookOpen className="w-4 h-4" /> Classrooms & Unique Join Codes ({classrooms.length})
        </button>
      </div>

      {/* TAB 1: INDEPENDENT STUDENT CREDENTIALS DIRECTORY */}
      {activeTab === 'students' && (
        <div className="space-y-6 animate-in fade-in">
          
          <GlassCard
            icon={Users}
            title="Teacher Student Credentials Directory"
            subtitle="All student accounts created by you. Students can join any classroom using the classroom unique join code."
            accent={true}
            action={
              <Badge variant="royal">{allStudents.length} Students in PostgreSQL</Badge>
            }
          >
            {loadingStudents ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Fetching student records from PostgreSQL...
              </div>
            ) : allStudents.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-dark-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <UserPlus className="w-6 h-6 text-neon-orange" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">No Student Credentials Issued Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Create student credentials individually or paste a bulk list. Accounts are stored directly in PostgreSQL.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setShowSingleModal(true)}
                    className="btn-royal text-xs py-2 px-4"
                  >
                    + Create Single Student
                  </button>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="btn-royal-outline text-xs py-2 px-4"
                  >
                    + Bulk CSV Upload
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                      <th className="pb-3 font-semibold">Student Name</th>
                      <th className="pb-3 font-semibold">Username / Email</th>
                      <th className="pb-3 font-semibold text-neon-orange">Password</th>
                      <th className="pb-3 font-semibold">Created Date</th>
                      <th className="pb-3 font-semibold">Enrolled Classrooms</th>
                      <th className="pb-3 font-semibold text-right">Credentials Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {allStudents.map((st) => (
                      <tr key={st.id} className="hover:bg-dark-900/40 transition-colors">
                        <td className="py-3.5 font-semibold text-white">{st.name}</td>
                        <td className="py-3.5 font-mono text-slate-300">{st.email}</td>
                        <td className="py-3.5 font-mono">
                          <span className="font-mono text-xs font-bold text-neon-amber px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm select-all">
                            <Key className="w-3 h-3 text-neon-orange" />
                            {st.password || 'student123'}
                          </span>
                        </td>
                        <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                          {new Date(st.created_at).toLocaleDateString()}
                        </td>
                        <td className="py-3.5">
                          {st.enrolled_classrooms && st.enrolled_classrooms.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              {st.enrolled_classrooms.map((c) => (
                                <Badge key={c.classroom_id} variant="approved">
                                  {c.name} {c.subject ? `(${c.subject})` : ''}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-500 italic">Not joined to any class yet</span>
                          )}
                        </td>
                        <td className="py-3.5 text-right">
                          <button
                            onClick={() => copyToClipboard(`Username: ${st.email} | Password: ${st.password || 'student123'}`, `usr_${st.id}`)}
                            className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 border border-slate-700 hover:border-neon-orange text-[11px] text-slate-200 hover:text-white font-mono transition-all inline-flex items-center gap-1.5 shadow-sm"
                            title="Copy Username and Password"
                          >
                            {copiedKey === `usr_${st.id}` ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400" /> Copied Login!
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 text-neon-orange" /> Copy Login
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

        </div>
      )}

      {/* TAB 2: CLASSROOMS & UNIQUE JOIN CODE ROUTING */}
      {activeTab === 'classrooms' && (
        <div className="space-y-6 animate-in fade-in">
          
          {classrooms.length === 0 ? (
            <GlassCard className="text-center py-12">
              <BookOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <h3 className="text-sm font-semibold text-white mb-1">No Classrooms Available Yet</h3>
              <p className="text-xs text-slate-400 mb-4 max-w-sm mx-auto">
                Create your first classroom to generate unique join codes and view objective analytics.
              </p>
              <button onClick={() => setShowClassModal(true)} className="btn-royal text-xs">
                + Create Classroom
              </button>
            </GlassCard>
          ) : (
            <div className="space-y-6">
              
              {/* Classroom Switcher Bar */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-neon-orange/30">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400 mr-2">Select Classroom Domain:</span>
                  {classrooms.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedClassId(c.id)}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${selectedClassId === c.id ? 'bg-neon-orange text-white shadow-neon-sm' : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'}`}
                    >
                      {c.name} {c.subject ? `(${c.subject})` : ''}
                    </button>
                  ))}
                </div>

                {activeClass && (
                  <div className="flex items-center gap-3 bg-dark-950/80 p-2 rounded-xl border border-slate-800 text-xs">
                    <span className="text-slate-400 font-mono">Domain:</span>
                    <span className="text-neon-orange font-bold text-xs">{activeClass.subject}</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-slate-400 font-mono">Join Code:</span>
                    <span className="text-neon-amber font-mono font-bold tracking-widest text-sm">{activeClass.join_code}</span>
                    <button
                      onClick={() => copyToClipboard(activeClass.join_code, 'join_code')}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Copy Join Code"
                    >
                      {copiedKey === 'join_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* OBJECTIVE ALIGNMENT MAP */}
              <GlassCard
                icon={Target}
                title={`Class-Wide Objective Alignment Map: ${activeClass?.name}${activeClass?.subject ? ` (${activeClass.subject})` : ''}`}
                subtitle="Aggregated mastery signals across all learning objectives (Continuous diagnostic evidence)"
                accent={true}
              >
                {loadingAnalytics ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Computing objective alignment metrics from PostgreSQL...
                  </div>
                ) : !analytics?.objective_alignment_map || analytics.objective_alignment_map.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No assessment submissions logged yet for this classroom. Assign an approved assessment from Generate Lesson to generate alignment data.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {analytics.objective_alignment_map.map((item, idx) => (
                      <div key={idx} className="p-4 rounded-xl bg-dark-900 border border-slate-800 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-xs text-slate-200 line-clamp-2">{item.objective}</span>
                          <Badge variant={item.average_mastery >= 75 ? 'approved' : (item.average_mastery >= 50 ? 'warning' : 'error')}>
                            {item.mastery_signal}
                          </Badge>
                        </div>

                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[11px] font-mono">
                            <span className="text-slate-400">Class Average Mastery</span>
                            <span className="font-bold text-neon-orange">{item.average_mastery}%</span>
                          </div>
                          <div className="w-full h-2 rounded-full bg-dark-950 overflow-hidden border border-slate-800">
                            <div
                              className="h-full bg-gradient-to-r from-neon-orange to-neon-amber rounded-full shadow-neon-sm"
                              style={{ width: `${item.average_mastery}%` }}
                            />
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-500 block font-mono">Sample Size: {item.sample_size} submissions</span>
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

              {/* ENROLLED STUDENTS IN THIS SPECIFIC CLASSROOM */}
              <GlassCard
                icon={Users}
                title={`Students Enrolled in ${activeClass?.name}${activeClass?.subject ? ` (${activeClass.subject})` : ''}`}
                subtitle="Students who have joined this classroom using the unique join code or direct enrollment"
              >
                {!analytics?.enrolled_students || analytics.enrolled_students.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No students have joined this classroom yet. Share Join Code: <b className="text-neon-amber font-mono">{activeClass?.join_code}</b>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                          <th className="pb-3 font-semibold">Student Name</th>
                          <th className="pb-3 font-semibold">Username</th>
                          <th className="pb-3 font-semibold text-neon-orange">Password</th>
                          <th className="pb-3 font-semibold">Assessments Taken</th>
                          <th className="pb-3 font-semibold">Latest Mastery</th>
                          <th className="pb-3 font-semibold text-right">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {analytics.enrolled_students.map((st) => (
                          <tr key={st.id} className="hover:bg-dark-900/40">
                            <td className="py-3 font-semibold text-white">{st.name}</td>
                            <td className="py-3 font-mono text-slate-300">{st.email}</td>
                            <td className="py-3 font-mono">
                              <span className="font-mono text-xs font-bold text-neon-amber px-2 py-0.5 rounded bg-dark-950 border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm select-all">
                                <Key className="w-3 h-3 text-neon-orange" />
                                {st.password || 'student123'}
                              </span>
                            </td>
                            <td className="py-3">
                              <Badge variant={st.attempts_count > 0 ? 'approved' : 'default'}>
                                {st.attempts_count} Attempt(s)
                              </Badge>
                            </td>
                            <td className="py-3 font-mono font-bold text-neon-orange">
                              {st.latest_score !== null ? `${st.latest_score}%` : 'Pending'}
                            </td>
                            <td className="py-3 text-right font-mono text-slate-400 text-[11px]">
                              {new Date(st.joined_at).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

            </div>
          )}

        </div>
      )}

      {/* CREATE CLASSROOM MODAL */}
      {showClassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <FolderPlus className="w-5 h-5 text-neon-orange" /> Create New Classroom
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              A 6-character uppercase unique join code will be generated automatically for students to join.
            </p>

            <form onSubmit={handleCreateClassroom} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Classroom Name</label>
                <input
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="e.g. Bioenergetics Section A"
                  required
                  className="w-full rounded-xl glass-input p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">Subject Domain</label>
                <input
                  type="text"
                  value={newClassSubject}
                  onChange={(e) => setNewClassSubject(e.target.value)}
                  placeholder="e.g. Molecular Biology"
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
                  {creatingClass ? 'Creating...' : 'Generate Classroom & Unique Code'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* SINGLE STUDENT CREATION MODAL */}
      {showSingleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-neon-orange" /> Create Student Account
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Student credentials will be created immediately in PostgreSQL.
            </p>

            {createdStudent ? (
              <div className="p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" /> Student Account Created!
                </div>
                <div className="text-xs space-y-1 font-mono text-slate-300 bg-dark-950 p-2.5 rounded border border-slate-800">
                  <div>Name: <b className="text-white">{createdStudent.name}</b></div>
                  <div>Username: <b className="text-white">{createdStudent.email}</b></div>
                  <div>Password: <b className="text-neon-amber font-bold">{createdStudent.temporary_password}</b></div>
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => copyToClipboard(`Username: ${createdStudent.email} | Password: ${createdStudent.temporary_password}`, 'new_st')}
                    className="flex-1 btn-royal-outline text-xs py-2"
                  >
                    {copiedKey === 'new_st' ? 'Copied Credentials!' : 'Copy Credentials'}
                  </button>
                  <button
                    onClick={() => { setCreatedStudent(null); setShowSingleModal(false); }}
                    className="flex-1 btn-royal text-xs py-2"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateSingleStudent} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Full Name</label>
                  <input
                    type="text"
                    value={singleName}
                    onChange={(e) => setSingleName(e.target.value)}
                    placeholder="e.g. Sarah Jenkins"
                    required
                    className="w-full rounded-xl glass-input p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Student Email / Username</label>
                  <input
                    type="email"
                    value={singleEmail}
                    onChange={(e) => setSingleEmail(e.target.value)}
                    placeholder="sarah.jenkins@school.edu"
                    required
                    className="w-full rounded-xl glass-input p-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Custom Password (Optional)</label>
                  <input
                    type="text"
                    value={singlePassword}
                    onChange={(e) => setSinglePassword(e.target.value)}
                    placeholder="Leave blank for auto-generated password"
                    className="w-full rounded-xl glass-input p-2.5 text-xs font-mono"
                  />
                </div>

                {classrooms.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assign to Classroom (Optional)</label>
                    <select
                      value={modalClassroomId}
                      onChange={(e) => setModalClassroomId(e.target.value)}
                      className="w-full rounded-xl glass-input p-2.5 text-xs"
                    >
                      <option value="">Do not enroll yet (Join via Code later)</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.subject ? `(${c.subject})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowSingleModal(false)}
                    className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-royal text-xs py-2 px-4"
                  >
                    Generate Credentials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* BULK STUDENT CREATION MODAL */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Upload className="w-5 h-5 text-neon-orange" /> Bulk Student Account Generator
            </h3>
            <p className="text-xs text-slate-300 mb-4">
              Paste names and emails (one per line: <code>Name, email</code>). System-generated credentials will be created immediately in PostgreSQL.
            </p>

            {bulkCreatedStudents.length > 0 ? (
              <div className="space-y-3">
                <Badge variant="approved">Created {bulkCreatedStudents.length} Student Credentials</Badge>
                <div className="max-h-60 overflow-y-auto space-y-2 p-2 rounded-xl bg-dark-950 border border-slate-800">
                  {bulkCreatedStudents.map((st, i) => (
                    <div key={i} className="p-2 rounded bg-dark-900 text-xs font-mono flex items-center justify-between text-slate-300">
                      <span>{st.name} ({st.email})</span>
                      <span className="text-neon-amber font-bold">{st.password}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={() => { setBulkCreatedStudents([]); setShowBulkModal(false); }}
                    className="w-full btn-royal text-xs py-2"
                  >
                    View in Student Directory
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBulkStudents} className="space-y-4">
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={`Ananya Sen, ananya@school.edu\nDev Kumar, dev@school.edu\nMeera Nair, meera@school.edu`}
                  rows={6}
                  required
                  className="w-full rounded-xl glass-input p-3 text-xs font-mono resize-none"
                />

                {classrooms.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">Assign to Classroom (Optional)</label>
                    <select
                      value={modalClassroomId}
                      onChange={(e) => setModalClassroomId(e.target.value)}
                      className="w-full rounded-xl glass-input p-2.5 text-xs"
                    >
                      <option value="">Do not enroll yet (Join via Code later)</option>
                      {classrooms.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} {c.subject ? `(${c.subject})` : ''}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-royal text-xs py-2 px-4"
                  >
                    Bulk Generate Credentials
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherClassroomPage;
