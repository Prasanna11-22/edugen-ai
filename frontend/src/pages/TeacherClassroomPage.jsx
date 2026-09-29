import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Users, UserPlus, Upload, BarChart3, Target, Award, Key, Copy, Check, 
  RefreshCw, CheckCircle2, ChevronRight, BookOpen, AlertCircle, Sparkles, Plus, GraduationCap, FolderPlus,
  AlertTriangle, HelpCircle, MessageSquare, Filter, X, Send
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const TeacherClassroomPage = ({ classroomId, onBack }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  
  // Tabs: 'students' or 'classrooms'
  const [activeTab, setActiveTab] = useState('classrooms');
  
  // Data states
  const [allStudents, setAllStudents] = useState([]);
  const [classrooms, setClassrooms] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(classroomId || null);
  const [analytics, setAnalytics] = useState(null);
  
  const [loadingStudents, setLoadingStudents] = useState(true);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Struggle Signals & Student Requests state
  const [struggleSignals, setStruggleSignals] = useState({ signals: [], general_requests_count: 0, total_active_requests: 0 });
  const [studentRequests, setStudentRequests] = useState([]);
  const [selectedObjectiveFilter, setSelectedObjectiveFilter] = useState(null);
  const [requestStatusFilter, setRequestStatusFilter] = useState('active'); // 'all', 'active', 'resolved'
  const [loadingSignals, setLoadingSignals] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Student help request creation modal (for simulation / testing)
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [classroomObjectives, setClassroomObjectives] = useState([]);
  const [newReqObjId, setNewReqObjId] = useState('');
  const [newReqText, setNewReqText] = useState('');
  const [newReqDetails, setNewReqDetails] = useState('');
  const [creatingRequest, setCreatingRequest] = useState(false);

  // Quick reply state
  const [replyingRequestId, setReplyingRequestId] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

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
      fetchStruggleSignals(selectedClassId);
      fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
      fetchClassroomObjectives(selectedClassId);
    }
  }, [selectedClassId, selectedObjectiveFilter, requestStatusFilter]);

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

  const fetchStruggleSignals = async (classId) => {
    if (!classId) return;
    setLoadingSignals(true);
    try {
      const res = await fetch(`/api/teacher/classrooms/${classId}/struggle-signals`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStruggleSignals(data);
      }
    } catch (err) {
      console.error("Struggle signals fetch error", err);
    } finally {
      setLoadingSignals(false);
    }
  };

  const fetchStudentRequests = async (classId, objFilter = selectedObjectiveFilter, statusFilter = requestStatusFilter) => {
    if (!classId) return;
    setLoadingRequests(true);
    try {
      let url = `/api/teacher/classrooms/${classId}/student-requests`;
      const params = new URLSearchParams();
      if (objFilter !== null && objFilter !== undefined) {
        params.append('objective_id', objFilter);
      }
      if (statusFilter && statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setStudentRequests(await res.json());
      }
    } catch (err) {
      console.error("Student requests fetch error", err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchClassroomObjectives = async (classId) => {
    if (!classId) return;
    try {
      const res = await fetch(`/api/teacher/classrooms/${classId}/objectives`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setClassroomObjectives(await res.json());
      }
    } catch (err) {
      console.error("Classroom objectives fetch error", err);
    }
  };

  const handleSelectObjectiveFilter = (objId) => {
    if (selectedObjectiveFilter === objId) {
      setSelectedObjectiveFilter(null);
    } else {
      setSelectedObjectiveFilter(objId);
    }
  };

  const handleUpdateRequestStatus = async (reqId, newStatus) => {
    try {
      const res = await fetch(`/api/teacher/student-requests/${reqId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Request marked as ${newStatus}!`, "success");
        if (selectedClassId) {
          fetchStruggleSignals(selectedClassId);
          fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    }
  };

  const handleSendReply = async (reqId) => {
    if (!replyMessage.trim()) return;
    setSendingReply(true);
    try {
      const res = await fetch(`/api/teacher/student-requests/${reqId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message: replyMessage.trim() })
      });
      if (res.ok) {
        showToast("Response sent to student!", "success");
        setReplyMessage('');
        setReplyingRequestId(null);
        if (selectedClassId) {
          fetchStruggleSignals(selectedClassId);
          fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateHelpRequest = async (e) => {
    e.preventDefault();
    if (!newReqText.trim() || !selectedClassId) return;
    setCreatingRequest(true);
    try {
      const res = await fetch(`/api/teacher/classrooms/${selectedClassId}/student-requests/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          classroom_id: selectedClassId,
          objective_id: newReqObjId ? Number(newReqObjId) : null,
          question_text: newReqText.trim(),
          details: newReqDetails.trim() || undefined
        })
      });
      if (res.ok) {
        showToast("Student help request logged successfully!", "success");
        setShowNewRequestModal(false);
        setNewReqText('');
        setNewReqDetails('');
        setNewReqObjId('');
        if (selectedClassId) {
          fetchStruggleSignals(selectedClassId);
          fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
        }
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setCreatingRequest(false);
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

              {/* ========================================================================= */}
              {/* 1. CLASS STRUGGLE SIGNALS CARD */}
              {/* ========================================================================= */}
              <GlassCard
                icon={AlertTriangle}
                title={`Class Struggle Signals: ${activeClass?.name}${activeClass?.subject ? ` (${activeClass.subject})` : ''}`}
                subtitle="Open student help requests grouped and ranked by curriculum learning objective"
                accent={true}
                action={
                  <div className="flex items-center gap-2">
                    {struggleSignals.total_active_requests > 0 && (
                      <span className="px-2.5 py-1 rounded-full text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/50 flex items-center gap-1 shadow-sm">
                        <AlertTriangle className="w-3 h-3 text-rose-400" /> {struggleSignals.total_active_requests} Open Signal(s)
                      </span>
                    )}
                    <button
                      onClick={() => setShowNewRequestModal(true)}
                      className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                      title="Log or Simulate Student Help Request"
                    >
                      <Plus className="w-3.5 h-3.5 text-neon-orange" /> Log Help Request
                    </button>
                  </div>
                }
              >
                {loadingSignals ? (
                  <div className="py-6 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Aggregating struggle signals...
                  </div>
                ) : struggleSignals.signals.length === 0 && struggleSignals.general_requests_count === 0 ? (
                  <div className="py-6 text-center space-y-2">
                    <div className="w-10 h-10 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs text-slate-400">
                      No active struggle signals logged for this classroom. All learning objectives are on track without open student help blockers.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Active Filter Reminder */}
                    {selectedObjectiveFilter !== null && (
                      <div className="p-2.5 rounded-xl bg-neon-orange/15 border border-neon-orange/40 flex items-center justify-between text-xs text-slate-200">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-neon-orange" />
                          <span>
                            Filtering Student Requests Inbox below by Objective ID: <strong className="text-neon-glow font-mono">#{selectedObjectiveFilter}</strong>
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedObjectiveFilter(null)}
                          className="text-[11px] font-mono text-neon-orange hover:text-white underline flex items-center gap-1 font-bold"
                        >
                          <X className="w-3.5 h-3.5" /> Clear Filter
                        </button>
                      </div>
                    )}

                    {/* Ranked Objectives List */}
                    <div className="space-y-2.5">
                      {struggleSignals.signals.map((sig, idx) => {
                        const isSelected = selectedObjectiveFilter === sig.objective_id;
                        return (
                          <div
                            key={sig.objective_id}
                            onClick={() => handleSelectObjectiveFilter(sig.objective_id)}
                            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                              isSelected
                                ? 'bg-neon-orange/20 border-neon-orange ring-2 ring-neon-orange/50 shadow-neon-sm'
                                : sig.has_warning
                                  ? 'bg-rose-950/25 border-rose-500/60 hover:border-rose-500 shadow-sm'
                                  : 'bg-dark-900/90 border-slate-800 hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs shrink-0 ${
                                sig.has_warning 
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                                  : 'bg-dark-950 text-slate-400 border border-slate-800'
                              }`}>
                                #{idx + 1}
                              </span>

                              <div className="space-y-0.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-xs font-bold text-white hover:text-neon-glow transition-colors">
                                    {sig.objective_text}
                                  </span>
                                  {sig.unit_title && (
                                    <span className="text-[10px] font-mono text-slate-500">
                                      ({sig.unit_title})
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  {isSelected ? '✓ Currently filtering inbox below (Click to reset)' : 'Click row to filter student requests inbox below'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                              {sig.has_warning && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-rose-500/25 text-rose-300 border border-rose-500/60 flex items-center gap-1 shadow-sm">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" /> ⚠ Multiple students need help
                                </span>
                              )}
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold ${
                                sig.has_warning 
                                  ? 'bg-rose-950 text-rose-200 border border-rose-500/60' 
                                  : 'bg-dark-950 text-neon-orange border border-slate-800'
                              }`}>
                                {sig.request_count} {sig.request_count === 1 ? 'Request' : 'Requests'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* General Requests (no objective_id) */}
                    {struggleSignals.general_requests_count > 0 && (
                      <div className="p-3 rounded-xl bg-dark-950/80 border border-slate-800/80 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 text-slate-300">
                          <HelpCircle className="w-4 h-4 text-neon-amber" />
                          <span>General requests: <strong className="text-neon-amber font-mono text-sm">{struggleSignals.general_requests_count}</strong></span>
                        </div>
                        <span className="text-[11px] font-mono text-slate-500">Unassigned to specific objective</span>
                      </div>
                    )}
                  </div>
                )}
              </GlassCard>

              {/* ========================================================================= */}
              {/* 2. STUDENT HELP REQUESTS INBOX CARD */}
              {/* ========================================================================= */}
              <GlassCard
                icon={MessageSquare}
                title={`Student Help Requests Inbox: ${activeClass?.name}`}
                subtitle="Student inquiries, conceptual clarification tickets, and step blockers"
                action={
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-dark-950 p-1 rounded-xl border border-slate-800 text-[11px]">
                      {[
                        { id: 'active', label: 'Open & In Progress' },
                        { id: 'resolved', label: 'Resolved' },
                        { id: 'all', label: 'All' }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          onClick={() => setRequestStatusFilter(tab.id)}
                          className={`px-2.5 py-1 rounded-lg font-semibold transition ${
                            requestStatusFilter === tab.id
                              ? 'bg-neon-orange text-white'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                }
              >
                {loadingRequests ? (
                  <div className="py-8 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Loading student requests...
                  </div>
                ) : studentRequests.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500 space-y-2">
                    <p>No student requests match the active filter criteria.</p>
                    {selectedObjectiveFilter && (
                      <button
                        onClick={() => setSelectedObjectiveFilter(null)}
                        className="text-neon-orange underline font-semibold block mx-auto"
                      >
                        Clear Objective Filter
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {studentRequests.map((req) => (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl bg-dark-900/90 border border-slate-800 hover:border-slate-700 transition space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-white">{req.student_name}</span>
                            <span className="text-[11px] font-mono text-slate-400">({req.student_email})</span>
                            <Badge variant={req.status === 'resolved' ? 'approved' : (req.status === 'in_progress' ? 'warning' : 'royal')}>
                              {req.status === 'in_progress' ? 'In Progress' : req.status.toUpperCase()}
                            </Badge>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500">
                            {new Date(req.created_at).toLocaleString()}
                          </span>
                        </div>

                        {req.objective_text && (
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-300 bg-dark-950 p-2 rounded-lg border border-slate-800">
                            <Target className="w-3.5 h-3.5 text-neon-orange shrink-0" />
                            <span>Tagged Objective: <strong className="text-white">{req.objective_text}</strong></span>
                          </div>
                        )}

                        <div className="text-xs text-slate-200 leading-relaxed font-sans">
                          <strong className="text-white block mb-0.5">{req.question_text}</strong>
                          {req.details && <p className="text-slate-400 text-[11px] mt-1">{req.details}</p>}
                        </div>

                        {/* Response Thread */}
                        {req.responses && req.responses.length > 0 && (
                          <div className="space-y-2 pt-2 border-t border-slate-800/60 pl-3 border-l-2 border-neon-orange/40">
                            {req.responses.map(resp => (
                              <div key={resp.id} className="text-xs space-y-0.5">
                                <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                                  <span className="font-bold text-neon-orange">{resp.user_name} ({resp.user_role}):</span>
                                  <span>{new Date(resp.created_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-slate-300 bg-dark-950 p-2 rounded-lg border border-slate-800 text-[11px]">
                                  {resp.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick Actions & Reply Box */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                          <div className="flex items-center gap-1.5">
                            {req.status !== 'in_progress' && req.status !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'in_progress')}
                                className="px-2.5 py-1 rounded-lg bg-dark-950 hover:bg-dark-850 text-neon-amber border border-slate-800 text-[11px] font-semibold transition"
                              >
                                Mark In Progress
                              </button>
                            )}
                            {req.status !== 'resolved' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'resolved')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/40 text-[11px] font-semibold transition flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Mark Resolved
                              </button>
                            )}
                            {req.status === 'resolved' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'open')}
                                className="px-2.5 py-1 rounded-lg bg-dark-950 hover:bg-dark-850 text-slate-400 text-[11px] font-semibold transition"
                              >
                                Reopen
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => setReplyingRequestId(replyingRequestId === req.id ? null : req.id)}
                            className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-sky-400 border border-slate-700 text-[11px] font-semibold flex items-center gap-1"
                          >
                            <MessageSquare className="w-3 h-3" /> {replyingRequestId === req.id ? 'Cancel Reply' : 'Reply'}
                          </button>
                        </div>

                        {/* Inline Reply Input */}
                        {replyingRequestId === req.id && (
                          <div className="pt-2 animate-in fade-in flex items-center gap-2">
                            <input
                              type="text"
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Type response to student..."
                              className="flex-1 rounded-xl glass-input p-2 text-xs"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply(req.id); }}
                            />
                            <button
                              onClick={() => handleSendReply(req.id)}
                              disabled={sendingReply || !replyMessage.trim()}
                              className="btn-royal text-xs py-2 px-3 flex items-center gap-1 shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" /> Send
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassCard>

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

      {/* LOG STUDENT HELP REQUEST MODAL */}
      {showNewRequestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-neon-orange" /> Log Student Help Request
              </h3>
              <button onClick={() => setShowNewRequestModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-300">
              Record a student struggle signal or question tagged to a learning objective.
            </p>

            <form onSubmit={handleCreateHelpRequest} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Curriculum Objective (Optional)</label>
                <select
                  value={newReqObjId}
                  onChange={(e) => setNewReqObjId(e.target.value)}
                  className="w-full rounded-xl glass-input p-2.5 text-xs"
                >
                  <option value="">General request (no specific objective)</option>
                  {classroomObjectives.map((o) => (
                    <option key={o.objective_id} value={o.objective_id}>
                      {o.objective_text} ({o.unit_title || 'Unit'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Student Question / Struggle Area *</label>
                <input
                  type="text"
                  value={newReqText}
                  onChange={(e) => setNewReqText(e.target.value)}
                  placeholder="e.g. Can't understand why user mode can't access hardware directly"
                  required
                  className="w-full rounded-xl glass-input p-2.5 text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Context / Details (Optional)</label>
                <textarea
                  value={newReqDetails}
                  onChange={(e) => setNewReqDetails(e.target.value)}
                  placeholder="e.g. Struggling with protected system call traps"
                  rows={2}
                  className="w-full rounded-xl glass-input p-2.5 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewRequestModal(false)}
                  className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingRequest || !newReqText.trim()}
                  className="btn-royal text-xs py-2 px-4"
                >
                  {creatingRequest ? 'Logging...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default TeacherClassroomPage;

