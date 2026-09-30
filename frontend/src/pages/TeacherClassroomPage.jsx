import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Users, UserPlus, Upload, BarChart3, Target, Award, Key, Copy, Check, 
  RefreshCw, CheckCircle2, ChevronRight, BookOpen, AlertCircle, Sparkles, Plus, GraduationCap, FolderPlus,
  AlertTriangle, HelpCircle, MessageSquare, Filter, X, Send,
  ShieldCheck, Clock, UserCheck, UserX, Trash2, Paperclip, FileText, Download, Ban,
  TrendingUp, ArrowUpDown
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

  // Sorting state for students tables (Default: descending progress)
  const [enrolledSortBy, setEnrolledSortBy] = useState('progress_desc');
  const [directorySortBy, setDirectorySortBy] = useState('progress_desc');

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

  // Quick reply & rejection state
  const [replyingRequestId, setReplyingRequestId] = useState(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyFile, setReplyFile] = useState(null);
  const [sendingReply, setSendingReply] = useState(false);
  const [rejectingRequestId, setRejectingRequestId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectingRequest, setRejectingRequest] = useState(false);

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
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [isGeneratingSingle, setIsGeneratingSingle] = useState(false);

  // Classroom creation modal state
  const [showClassModal, setShowClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassSubject, setNewClassSubject] = useState('');
  const [creatingClass, setCreatingClass] = useState(false);

  // Join Permission Requests state
  const [joinRequests, setJoinRequests] = useState([]);
  const [loadingJoinRequests, setLoadingJoinRequests] = useState(false);
  const [processingRequestId, setProcessingRequestId] = useState(null);

  // Copy state
  const [copiedKey, setCopiedKey] = useState('');

  useEffect(() => {
    fetchStudentsDirectory();
    fetchClassroomsList();
    fetchJoinRequests();
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

  const fetchJoinRequests = async (classId = null) => {
    setLoadingJoinRequests(true);
    try {
      const url = classId 
        ? `/api/teacher/classrooms/join-requests?classroom_id=${classId}` 
        : '/api/teacher/classrooms/join-requests';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setJoinRequests(await res.json());
      }
    } catch (err) {
      console.error("Error fetching join requests", err);
    } finally {
      setLoadingJoinRequests(false);
    }
  };

  const handleApproveJoinRequest = async (enrollmentId, studentName, className) => {
    setProcessingRequestId(enrollmentId);
    try {
      const res = await fetch(`/api/teacher/classrooms/join-requests/${enrollmentId}/approve`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to approve join request");
      showToast(`✨ Permission granted! ${studentName} is now enrolled in ${className}.`, "success");
      await fetchJoinRequests();
      await fetchClassroomsList();
      await fetchStudentsDirectory();
      if (selectedClassId) await fetchAnalytics(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setProcessingRequestId(null);
    }
  };

  const handleRejectJoinRequest = async (enrollmentId, studentName) => {
    setProcessingRequestId(enrollmentId);
    try {
      const res = await fetch(`/api/teacher/classrooms/join-requests/${enrollmentId}/reject`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Failed to decline join request");
      showToast(`Join permission request for ${studentName} declined.`, "info");
      await fetchJoinRequests();
      await fetchClassroomsList();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setProcessingRequestId(null);
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

  const handleSendReply = async (reqId, markResolved = false) => {
    if (!replyMessage.trim() && !replyFile) {
      showToast("Please enter a response message or attach a PDF/notes document.", "warning");
      return;
    }
    setSendingReply(true);
    try {
      let res;
      if (replyFile) {
        const formData = new FormData();
        formData.append('message', replyMessage.trim());
        formData.append('status', markResolved ? 'resolved' : 'in_progress');
        formData.append('file', replyFile);
        res = await fetch(`/api/teacher/student-requests/${reqId}/respond-file`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
      } else {
        res = await fetch(`/api/teacher/student-requests/${reqId}/respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            message: replyMessage.trim(),
            status: markResolved ? 'resolved' : 'in_progress'
          })
        });
      }
      if (res.ok) {
        showToast(markResolved ? "🎉 Response & notes sent! Request marked resolved." : "Response sent to student!", "success");
        setReplyMessage('');
        setReplyFile(null);
        setReplyingRequestId(null);
        if (selectedClassId) {
          fetchStruggleSignals(selectedClassId);
          fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to send response");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSendingReply(false);
    }
  };

  const handleRejectRequest = async (reqId) => {
    setRejectingRequest(true);
    try {
      const res = await fetch(`/api/teacher/student-requests/${reqId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ reason: rejectReason.trim() || "Request declined by instructor." })
      });
      if (res.ok) {
        showToast("Request marked as rejected.", "success");
        setRejectReason('');
        setRejectingRequestId(null);
        if (selectedClassId) {
          fetchStruggleSignals(selectedClassId);
          fetchStudentRequests(selectedClassId, selectedObjectiveFilter, requestStatusFilter);
        }
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to decline request");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setRejectingRequest(false);
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
      } else {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to log student help request");
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

  const handleDeleteClassroom = async (classId, className) => {
    if (!window.confirm(`Are you sure you want to delete classroom "${className}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/teacher/classrooms/${classId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to delete classroom');
      showToast(data.message || 'Classroom deleted successfully', 'success');
      await fetchClassroomsList();
      await fetchStudentsDirectory();
      setSelectedClassId(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleCreateSingleStudent = async (e) => {
    e.preventDefault();
    setIsGeneratingSingle(true);
    try {
      const res = await fetch('/api/teacher/students/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: singleName.trim(),
          email: singleEmail.trim(),
          password: singlePassword.trim() || undefined,
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
    } finally {
      setIsGeneratingSingle(false);
    }
  };

  const handleCreateBulkStudents = async (e) => {
    e.preventDefault();
    if (!bulkText.trim()) {
      showToast('Please enter or upload student names and emails.', 'warning');
      return;
    }
    setIsGeneratingBulk(true);
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
      setBulkCreatedStudents(data.students || []);
      setBulkText('');
      const count = data.created_count ?? data.students?.length ?? 0;
      showToast(`Successfully generated credentials for ${count} students!`, "success");
      await fetchStudentsDirectory();
      if (selectedClassId) await fetchAnalytics(selectedClassId);
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setIsGeneratingBulk(false);
    }
  };

  const handleCsvFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setBulkText(text);
        showToast(`Loaded ${file.name}`, 'info');
      }
    };
    reader.readAsText(file);
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const exportStudentsCsv = (studentsList, filename = 'retrievo_student_credentials.csv') => {
    if (!studentsList || studentsList.length === 0) {
      showToast('No students to export', 'warning');
      return;
    }
    const headers = ['Name', 'Email/Username', 'Password', 'Classrooms', 'Latest Score %', 'Attempts'];
    const rows = studentsList.map(s => [
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.email || '').replace(/"/g, '""')}"`,
      `"${(s.password || '').replace(/"/g, '""')}"`,
      `"${(s.enrolled_classrooms?.map(c => c.name).join('; ') || '').replace(/"/g, '""')}"`,
      s.latest_score !== null && s.latest_score !== undefined ? s.latest_score : '',
      s.attempts_count || 0
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast(`Exported ${studentsList.length} student credentials to CSV!`, 'success');
  };

  const copyAllCredentialsText = (studentsList) => {
    if (!studentsList || studentsList.length === 0) {
      showToast('No credentials to copy', 'warning');
      return;
    }
    const lines = studentsList.map((s, idx) => 
      `${idx + 1}. Name: ${s.name} | Username: ${s.email} | Password: ${s.password || ''}`
    );
    const formatted = `=== RETRIEVO STUDENT CREDENTIALS ===\n\n` + lines.join('\n');
    copyToClipboard(formatted, 'all_creds');
    showToast(`Copied ${studentsList.length} student credentials to clipboard!`, 'success');
  };

  const activeClass = classrooms.find(c => c.id === selectedClassId);

  // Sort Enrolled Students (Default: Descending Progress & Assessment Results)
  const sortedEnrolledStudents = React.useMemo(() => {
    const list = [...(analytics?.enrolled_students || [])];
    return list.sort((a, b) => {
      if (enrolledSortBy === 'progress_desc') {
        const aCompleted = a.has_completed || (a.attempts_count > 0 && a.latest_score !== null);
        const bCompleted = b.has_completed || (b.attempts_count > 0 && b.latest_score !== null);
        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;
        return (b.progress || b.latest_score || 0) - (a.progress || a.latest_score || 0);
      }
      if (enrolledSortBy === 'progress_asc') {
        return (a.progress || a.latest_score || 0) - (b.progress || b.latest_score || 0);
      }
      if (enrolledSortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (enrolledSortBy === 'date_desc') {
        return new Date(b.joined_at || 0) - new Date(a.joined_at || 0);
      }
      return 0;
    });
  }, [analytics?.enrolled_students, enrolledSortBy]);

  // Sort All Students in Directory (Default: Descending Progress)
  const sortedDirectoryStudents = React.useMemo(() => {
    const list = [...allStudents];
    return list.sort((a, b) => {
      if (directorySortBy === 'progress_desc') {
        const aCompleted = a.has_completed || (a.attempts_count > 0 && a.latest_score !== null);
        const bCompleted = b.has_completed || (b.attempts_count > 0 && b.latest_score !== null);
        if (aCompleted && !bCompleted) return -1;
        if (!aCompleted && bCompleted) return 1;
        return (b.progress || b.latest_score || 0) - (a.progress || a.latest_score || 0);
      }
      if (directorySortBy === 'progress_asc') {
        return (a.progress || a.latest_score || 0) - (b.progress || b.latest_score || 0);
      }
      if (directorySortBy === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (directorySortBy === 'date_desc') {
        return new Date(b.created_at || 0) - new Date(a.created_at || 0);
      }
      return 0;
    });
  }, [allStudents, directorySortBy]);

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
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2 flex-wrap">
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

        <button
          onClick={() => setActiveTab('requests')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            activeTab === 'requests' 
              ? 'bg-neon-orange text-white shadow-neon-sm' 
              : joinRequests.length > 0
                ? 'text-amber-300 bg-amber-950/40 border border-amber-500/50 hover:bg-amber-900/50 shadow-neon-sm'
                : 'text-slate-400 hover:text-white bg-dark-900 border border-slate-800'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Join Permission Requests</span>
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
            joinRequests.length > 0 ? 'bg-amber-400 text-dark-950 animate-pulse' : 'bg-dark-950 text-slate-500'
          }`}>
            {joinRequests.length}
          </span>
        </button>
      </div>

      {/* TAB 1: INDEPENDENT STUDENT CREDENTIALS DIRECTORY */}
      {activeTab === 'students' && (
        <div className="space-y-6 animate-in fade-in">
          
          <GlassCard
            icon={Users}
            title="Teacher Student Credentials Directory"
            subtitle="All student accounts created by you, ranked in descending order of assessment progress"
            accent={true}
            action={
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-[11px] font-mono bg-dark-950 px-2.5 py-1 rounded-xl border border-slate-800 text-slate-300">
                  <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                  <span>Sort:</span>
                  <select
                    value={directorySortBy}
                    onChange={(e) => setDirectorySortBy(e.target.value)}
                    className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                  >
                    <option value="progress_desc" className="bg-dark-900 text-white">Highest Progress ⬇️</option>
                    <option value="progress_asc" className="bg-dark-900 text-white">Lowest Progress ⬆️</option>
                    <option value="name_asc" className="bg-dark-900 text-white">Name (A-Z)</option>
                    <option value="date_desc" className="bg-dark-900 text-white">Newest First</option>
                  </select>
                </div>
                {allStudents.length > 0 && (
                  <>
                    <button
                      onClick={() => copyAllCredentialsText(allStudents)}
                      className="px-2.5 py-1 rounded-xl bg-dark-950 hover:bg-dark-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                      title="Copy All Student Usernames & Passwords"
                    >
                      {copiedKey === 'all_creds' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neon-orange" />
                          <span>Copy All Logins</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => exportStudentsCsv(allStudents)}
                      className="px-2.5 py-1 rounded-xl bg-dark-950 hover:bg-dark-900 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-[11px] font-mono flex items-center gap-1.5 transition-colors"
                      title="Export Student Directory to CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export CSV</span>
                    </button>
                  </>
                )}
                <Badge variant="royal">{allStudents.length} Students</Badge>
              </div>
            }
          >
            {loadingStudents ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Fetching student records...
              </div>
            ) : allStudents.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-dark-900 border border-slate-800 flex items-center justify-center text-slate-500 mx-auto">
                  <UserPlus className="w-6 h-6 text-neon-orange" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">No Student Credentials Issued Yet</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto mt-1">
                    Create student credentials individually or paste a bulk list.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => { setCreatedStudent(null); setShowSingleModal(true); }}
                    className="btn-royal text-xs py-2 px-4"
                  >
                    + Create Single Student
                  </button>
                  <button
                    onClick={() => { setBulkCreatedStudents([]); setShowBulkModal(true); }}
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
                      <th className="pb-3 font-semibold w-12 text-center">Rank</th>
                      <th className="pb-3 font-semibold">Student Name</th>
                      <th className="pb-3 font-semibold">Username / Email</th>
                      <th className="pb-3 font-semibold text-neon-orange">Password</th>
                      <th className="pb-3 font-semibold">Enrolled Classrooms</th>
                      <th className="pb-3 font-semibold text-sky-400 min-w-[200px]">Student Progress</th>
                      <th className="pb-3 font-semibold text-right">Credentials Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {sortedDirectoryStudents.map((st, idx) => {
                      const hasResult = st.latest_score !== null && st.latest_score !== undefined;
                      return (
                        <tr key={st.id} className="hover:bg-dark-900/40 transition-colors">
                          <td className="py-3.5 font-mono text-center">
                            {idx === 0 && hasResult ? (
                              <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-300 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 1">
                                🥇
                              </span>
                            ) : idx === 1 && hasResult ? (
                              <span className="w-6 h-6 rounded-lg bg-slate-300/20 border border-slate-300/50 text-slate-200 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 2">
                                🥈
                              </span>
                            ) : idx === 2 && hasResult ? (
                              <span className="w-6 h-6 rounded-lg bg-amber-700/20 border border-amber-600/50 text-amber-400 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 3">
                                🥉
                              </span>
                            ) : (
                              <span className="w-6 h-6 rounded-lg bg-dark-950 border border-slate-800 text-slate-400 inline-flex items-center justify-center text-[11px]">
                                #{idx + 1}
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 font-semibold text-white">{st.name}</td>
                          <td className="py-3.5 font-mono text-slate-300">{st.email}</td>
                          <td className="py-3.5 font-mono">
                            <span className="font-mono text-xs font-bold text-neon-amber px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm select-all">
                              <Key className="w-3 h-3 text-neon-orange" />
                              {st.password || '••••••••'}
                            </span>
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
                          <td className="py-3.5">
                            {hasResult ? (
                              <div className="space-y-1.5 min-w-[190px]">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-mono font-black text-white flex items-center gap-1.5">
                                    {st.latest_score >= 75 ? (
                                      <span className="text-emerald-400 font-bold">🏆 {st.latest_score}%</span>
                                    ) : st.latest_score >= 50 ? (
                                      <span className="text-neon-amber font-bold">⚡ {st.latest_score}%</span>
                                    ) : (
                                      <span className="text-rose-400 font-bold">🌱 {st.latest_score}%</span>
                                    )}
                                  </span>
                                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                    st.latest_score >= 75
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : st.latest_score >= 50
                                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                  }`}>
                                    {st.mastery_signal || (st.latest_score >= 75 ? 'Mastery' : st.latest_score >= 50 ? 'Developing' : 'Needs Practice')}
                                  </span>
                                </div>
                                <div className="w-full h-2 rounded-full bg-dark-950 overflow-hidden border border-slate-800">
                                  <div
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      st.latest_score >= 75
                                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                                        : st.latest_score >= 50
                                          ? 'bg-gradient-to-r from-neon-orange to-neon-amber shadow-[0_0_10px_rgba(255,107,0,0.5)]'
                                          : 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(5, st.latest_score))}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-slate-400 block">
                                  {st.attempts_count} Completed Assessment(s)
                                </span>
                              </div>
                            ) : (
                              <div className="space-y-1 min-w-[150px]">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                  <span>0% Progress</span>
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-dark-950 text-slate-500 border border-slate-800">Pending</span>
                                </div>
                                <div className="w-full h-1.5 rounded-full bg-dark-950 border border-slate-800/80">
                                  <div className="h-full rounded-full bg-slate-700/30" style={{ width: '0%' }} />
                                </div>
                              </div>
                            )}
                          </td>
                          <td className="py-3.5 text-right">
                            <button
                              onClick={() => copyToClipboard(`Username: ${st.email} | Password: ${st.password || ''}`, `usr_${st.id}`)}
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
                      );
                    })}
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
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${selectedClassId === c.id ? 'bg-neon-orange text-white shadow-neon-sm' : 'bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-800'}`}
                    >
                      <span>{c.name} {c.subject ? `(${c.subject})` : ''}</span>
                      {c.pending_requests_count > 0 && (
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-amber-400 text-dark-950 animate-pulse">
                          {c.pending_requests_count}
                        </span>
                      )}
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
                    <span className="text-slate-700">|</span>
                    <button
                      onClick={() => handleDeleteClassroom(activeClass.id, activeClass.name)}
                      className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                      title="Delete Classroom"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              {/* Pending Join Requests Alert Banner for Active Class */}
              {activeClass && activeClass.pending_requests_count > 0 && (
                <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-500/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-200 shadow-neon-sm animate-in fade-in">
                  <div className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                    <span>
                      <strong>{activeClass.pending_requests_count} student(s)</strong> have submitted this classroom's join code ({activeClass.join_code}) and are awaiting your permission.
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveTab('requests')}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-dark-950 font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm transition"
                  >
                    <UserCheck className="w-3.5 h-3.5" /> Review & Grant Permission
                  </button>
                </div>
              )}

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
                            <Badge variant={
                              req.status === 'resolved' 
                                ? 'approved' 
                                : req.status === 'in_progress' 
                                ? 'warning' 
                                : req.status === 'rejected' 
                                ? 'error' 
                                : 'royal'
                            }>
                              {req.status === 'in_progress' ? 'In Progress' : req.status === 'rejected' ? 'REJECTED' : req.status.toUpperCase()}
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
                              <div key={resp.id} className="text-xs space-y-1.5 bg-dark-950 p-2.5 rounded-lg border border-slate-800">
                                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                  <span className="font-bold text-neon-orange">{resp.user_name} ({resp.user_role}):</span>
                                  <span>{new Date(resp.created_at).toLocaleTimeString()}</span>
                                </div>
                                {resp.message && (
                                  <p className="text-slate-300 text-[11px] leading-relaxed">
                                    {resp.message}
                                  </p>
                                )}
                                {resp.file_url && (
                                  <a
                                    href={resp.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-900 border border-slate-700 hover:border-neon-orange text-neon-orange hover:text-neon-amber transition text-xs font-mono group"
                                  >
                                    <FileText className="w-3.5 h-3.5 text-neon-orange" />
                                    <span className="font-semibold underline decoration-dotted">{resp.file_name || 'Download Attached PDF / Notes'}</span>
                                    <Download className="w-3.5 h-3.5 ml-1 text-slate-400 group-hover:text-neon-orange transition" />
                                  </a>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Quick Actions & Reply Box */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {req.status !== 'in_progress' && req.status !== 'resolved' && req.status !== 'rejected' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'in_progress')}
                                className="px-2.5 py-1 rounded-lg bg-dark-950 hover:bg-dark-850 text-neon-amber border border-slate-800 text-[11px] font-semibold transition"
                              >
                                Mark In Progress
                              </button>
                            )}
                            {req.status !== 'resolved' && req.status !== 'rejected' && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'resolved')}
                                className="px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-500/40 text-[11px] font-semibold transition flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" /> Mark Resolved
                              </button>
                            )}
                            {(req.status === 'resolved' || req.status === 'rejected') && (
                              <button
                                onClick={() => handleUpdateRequestStatus(req.id, 'open')}
                                className="px-2.5 py-1 rounded-lg bg-dark-950 hover:bg-dark-850 text-slate-400 text-[11px] font-semibold transition"
                              >
                                Reopen
                              </button>
                            )}
                            {req.status !== 'rejected' && req.status !== 'resolved' && (
                              <button
                                onClick={() => {
                                  setRejectingRequestId(rejectingRequestId === req.id ? null : req.id);
                                  setReplyingRequestId(null);
                                }}
                                className="px-2.5 py-1 rounded-lg bg-rose-950/40 hover:bg-rose-900/40 text-rose-400 border border-rose-500/30 text-[11px] font-semibold flex items-center gap-1 transition"
                              >
                                <Ban className="w-3 h-3" /> Reject
                              </button>
                            )}
                          </div>

                          <button
                            onClick={() => {
                              setReplyingRequestId(replyingRequestId === req.id ? null : req.id);
                              setRejectingRequestId(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-sky-400 border border-slate-700 text-[11px] font-semibold flex items-center gap-1 transition"
                          >
                            <MessageSquare className="w-3 h-3" /> {replyingRequestId === req.id ? 'Cancel Reply' : 'Reply (Text / PDF)'}
                          </button>
                        </div>

                        {/* Inline Rejection Box */}
                        {rejectingRequestId === req.id && (
                          <div className="p-3 rounded-xl bg-rose-950/20 border border-rose-500/30 space-y-2 animate-in fade-in">
                            <div className="flex items-center gap-1.5 text-xs text-rose-400 font-semibold">
                              <Ban className="w-3.5 h-3.5" /> Decline Course Notes Request
                            </div>
                            <input
                              type="text"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              placeholder="Reason for declining (e.g. Please refer to Unit 2 Lecture Slide 14)..."
                              className="w-full rounded-xl glass-input p-2 text-xs"
                              onKeyDown={(e) => { if (e.key === 'Enter') handleRejectRequest(req.id); }}
                            />
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                onClick={() => setRejectingRequestId(null)}
                                className="px-3 py-1 rounded-lg text-xs bg-dark-800 text-slate-400 hover:text-white"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleRejectRequest(req.id)}
                                disabled={rejectingRequest}
                                className="px-3 py-1 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1"
                              >
                                <Ban className="w-3 h-3" /> Confirm Decline
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Inline Reply Input with PDF attachment support */}
                        {replyingRequestId === req.id && (
                          <div className="p-3.5 rounded-xl bg-dark-950 border border-slate-800 space-y-3 animate-in fade-in">
                            <textarea
                              rows={2}
                              value={replyMessage}
                              onChange={(e) => setReplyMessage(e.target.value)}
                              placeholder="Type response notes, explanations, or solution summary for the student..."
                              className="w-full rounded-xl glass-input p-2.5 text-xs resize-none"
                            />

                            {/* File Upload / Attachment Picker */}
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <div className="flex items-center gap-2">
                                <label className="cursor-pointer px-2.5 py-1.5 rounded-lg bg-dark-900 hover:bg-dark-850 text-slate-300 border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition">
                                  <Paperclip className="w-3.5 h-3.5 text-neon-orange" />
                                  <span>{replyFile ? 'Change File' : 'Attach PDF / Document'}</span>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
                                    onChange={(e) => {
                                      if (e.target.files && e.target.files[0]) {
                                        setReplyFile(e.target.files[0]);
                                      }
                                    }}
                                  />
                                </label>

                                {replyFile && (
                                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-dark-900 border border-neon-orange/40 text-neon-orange text-[11px] font-mono">
                                    <FileText className="w-3.5 h-3.5" />
                                    <span className="max-w-[180px] truncate">{replyFile.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => setReplyFile(null)}
                                      className="ml-1 text-slate-400 hover:text-rose-400"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleSendReply(req.id, false)}
                                  disabled={sendingReply || (!replyMessage.trim() && !replyFile)}
                                  className="px-3 py-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 text-sky-300 border border-slate-700 text-xs font-semibold flex items-center gap-1 transition disabled:opacity-50"
                                >
                                  <Send className="w-3 h-3" /> Send (Keep Open)
                                </button>
                                <button
                                  onClick={() => handleSendReply(req.id, true)}
                                  disabled={sendingReply || (!replyMessage.trim() && !replyFile)}
                                  className="btn-royal text-xs py-1.5 px-3 flex items-center gap-1 shrink-0 disabled:opacity-50"
                                >
                                  <Check className="w-3.5 h-3.5" /> Send & Resolve
                                </button>
                              </div>
                            </div>
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
                    <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Computing objective alignment metrics...
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
                subtitle="Students enrolled in this classroom, ranked in descending order of assessment progress & score results"
                action={
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <div className="flex items-center gap-1.5 text-[11px] font-mono bg-dark-950 px-2.5 py-1 rounded-xl border border-slate-800 text-slate-300">
                      <ArrowUpDown className="w-3.5 h-3.5 text-sky-400" />
                      <span>Sort:</span>
                      <select
                        value={enrolledSortBy}
                        onChange={(e) => setEnrolledSortBy(e.target.value)}
                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer"
                      >
                        <option value="progress_desc" className="bg-dark-900 text-white">Highest Progress ⬇️</option>
                        <option value="progress_asc" className="bg-dark-900 text-white">Lowest Progress ⬆️</option>
                        <option value="name_asc" className="bg-dark-900 text-white">Name (A-Z)</option>
                        <option value="date_desc" className="bg-dark-900 text-white">Newest Joined</option>
                      </select>
                    </div>
                    <Badge variant="royal">{sortedEnrolledStudents.length} Students</Badge>
                  </div>
                }
              >
                {!sortedEnrolledStudents || sortedEnrolledStudents.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-500">
                    No students have joined this classroom yet. Share Join Code: <b className="text-neon-amber font-mono">{activeClass?.join_code}</b>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                          <th className="pb-3 font-semibold w-12 text-center">Rank</th>
                          <th className="pb-3 font-semibold">Student Name</th>
                          <th className="pb-3 font-semibold">Username / Email</th>
                          <th className="pb-3 font-semibold text-neon-orange">Password</th>
                          <th className="pb-3 font-semibold">Assessments Completed</th>
                          <th className="pb-3 font-semibold text-sky-400 min-w-[220px]">Student Progress</th>
                          <th className="pb-3 font-semibold text-right">Joined Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {sortedEnrolledStudents.map((st, idx) => {
                          const hasResult = st.latest_score !== null && st.latest_score !== undefined;
                          return (
                            <tr key={st.id} className="hover:bg-dark-900/40 transition-colors">
                              <td className="py-3.5 font-mono text-center">
                                {idx === 0 && hasResult ? (
                                  <span className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-400/60 text-amber-300 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 1">
                                    🥇
                                  </span>
                                ) : idx === 1 && hasResult ? (
                                  <span className="w-6 h-6 rounded-lg bg-slate-300/20 border border-slate-300/50 text-slate-200 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 2">
                                    🥈
                                  </span>
                                ) : idx === 2 && hasResult ? (
                                  <span className="w-6 h-6 rounded-lg bg-amber-700/20 border border-amber-600/50 text-amber-400 inline-flex items-center justify-center text-xs shadow-sm" title="Rank 3">
                                    🥉
                                  </span>
                                ) : (
                                  <span className="w-6 h-6 rounded-lg bg-dark-950 border border-slate-800 text-slate-400 inline-flex items-center justify-center text-[11px]">
                                    #{idx + 1}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 font-semibold text-white">{st.name}</td>
                              <td className="py-3.5 font-mono text-slate-300">{st.email}</td>
                              <td className="py-3.5 font-mono">
                                <span className="font-mono text-xs font-bold text-neon-amber px-2 py-0.5 rounded bg-dark-950 border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm select-all">
                                  <Key className="w-3 h-3 text-neon-orange" />
                                  {st.password || '••••••••'}
                                </span>
                              </td>
                              <td className="py-3.5">
                                <Badge variant={st.attempts_count > 0 ? 'approved' : 'default'}>
                                  {st.attempts_count} Completed
                                </Badge>
                              </td>
                              <td className="py-3.5">
                                {hasResult ? (
                                  <div className="space-y-1.5 min-w-[210px]">
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="font-mono font-black text-white flex items-center gap-1.5">
                                        {st.latest_score >= 75 ? (
                                          <span className="text-emerald-400 font-bold">🏆 {st.latest_score}%</span>
                                        ) : st.latest_score >= 50 ? (
                                          <span className="text-neon-amber font-bold">⚡ {st.latest_score}%</span>
                                        ) : (
                                          <span className="text-rose-400 font-bold">🌱 {st.latest_score}%</span>
                                        )}
                                      </span>
                                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                        st.latest_score >= 75
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                          : st.latest_score >= 50
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                      }`}>
                                        {st.mastery_signal || (st.latest_score >= 75 ? 'Mastery' : st.latest_score >= 50 ? 'Developing' : 'Needs Practice')}
                                      </span>
                                    </div>
                                    
                                    {/* Visual Animated Progress Bar */}
                                    <div className="w-full h-2 rounded-full bg-dark-950 overflow-hidden border border-slate-800">
                                      <div
                                        className={`h-full rounded-full transition-all duration-500 ${
                                          st.latest_score >= 75
                                            ? 'bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]'
                                            : st.latest_score >= 50
                                              ? 'bg-gradient-to-r from-neon-orange to-neon-amber shadow-[0_0_10px_rgba(255,107,0,0.5)]'
                                              : 'bg-gradient-to-r from-rose-600 to-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.5)]'
                                        }`}
                                        style={{ width: `${Math.min(100, Math.max(5, st.latest_score))}%` }}
                                      />
                                    </div>

                                    {st.latest_unit_title && (
                                      <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                                        <span className="truncate max-w-[150px]" title={st.latest_unit_title}>
                                          {st.latest_unit_title}
                                        </span>
                                        {st.average_score && st.attempts_count > 1 && (
                                          <span className="text-slate-500">Avg: {st.average_score}%</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="space-y-1 min-w-[150px]">
                                    <div className="flex items-center justify-between text-[11px] text-slate-500 font-mono">
                                      <span>0% Progress</span>
                                      <span className="text-[10px] px-2 py-0.5 rounded bg-dark-950 text-slate-500 border border-slate-800">Pending</span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-dark-950 border border-slate-800/80">
                                      <div className="h-full rounded-full bg-slate-700/30" style={{ width: '0%' }} />
                                    </div>
                                  </div>
                                )}
                              </td>
                              <td className="py-3.5 text-right font-mono text-slate-400 text-[11px]">
                                {st.joined_at ? new Date(st.joined_at).toLocaleDateString() : 'Active'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlassCard>

            </div>
          )}

        </div>
      )}

      {/* TAB 3: JOIN PERMISSION REQUESTS */}
      {activeTab === 'requests' && (
        <div className="space-y-6 animate-in fade-in">
          <GlassCard
            icon={ShieldCheck}
            title="Classroom Join Permission Requests"
            subtitle="Students who have entered your classroom join code and are awaiting instructor approval before accessing curriculum packs and tests."
            accent={true}
            action={
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fetchJoinRequests()}
                  className="px-2.5 py-1 rounded-lg bg-dark-850 hover:bg-dark-800 text-slate-300 text-xs font-semibold flex items-center gap-1 border border-slate-700 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingJoinRequests ? 'animate-spin' : ''}`} /> Refresh
                </button>
                <Badge variant={joinRequests.length > 0 ? "warning" : "approved"}>
                  {joinRequests.length} Pending
                </Badge>
              </div>
            }
          >
            {loadingJoinRequests ? (
              <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                <RefreshCw className="w-4 h-4 animate-spin text-neon-orange" /> Loading join permission requests...
              </div>
            ) : joinRequests.length === 0 ? (
              <div className="py-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-semibold text-white">All Caught Up!</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  There are no pending join requests. When students enter your classroom code, their permission requests will appear here for your review and approval.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                      <th className="pb-3 font-semibold">Student Name & Email</th>
                      <th className="pb-3 font-semibold">Target Classroom</th>
                      <th className="pb-3 font-semibold">Join Code</th>
                      <th className="pb-3 font-semibold">Requested At</th>
                      <th className="pb-3 font-semibold">Status</th>
                      <th className="pb-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {joinRequests.map(req => {
                      const isProcessing = processingRequestId === req.enrollment_id;
                      return (
                        <tr key={req.enrollment_id} className="hover:bg-dark-900/50 transition">
                          <td className="py-3.5">
                            <div className="font-semibold text-white">{req.student_name}</div>
                            <div className="text-[11px] text-slate-400 font-mono">{req.student_email}</div>
                          </td>
                          <td className="py-3.5">
                            <div className="font-semibold text-slate-200">{req.classroom_name}</div>
                            <div className="text-[11px] text-neon-orange font-mono">{req.classroom_subject}</div>
                          </td>
                          <td className="py-3.5">
                            <span className="px-2 py-0.5 rounded bg-dark-950 border border-slate-800 font-mono text-neon-amber font-bold text-xs tracking-wider">
                              {req.join_code}
                            </span>
                          </td>
                          <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                            {new Date(req.requested_at).toLocaleString()}
                          </td>
                          <td className="py-3.5">
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 uppercase tracking-wider animate-pulse">
                              Pending Approval
                            </span>
                          </td>
                          <td className="py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleApproveJoinRequest(req.enrollment_id, req.student_name, req.classroom_name)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 shadow-sm transition disabled:opacity-50"
                              >
                                <Check className="w-3.5 h-3.5" /> Approve
                              </button>
                              <button
                                onClick={() => handleRejectJoinRequest(req.enrollment_id, req.student_name)}
                                disabled={isProcessing}
                                className="px-3 py-1.5 rounded-xl bg-dark-800 hover:bg-rose-950/80 hover:border-rose-500/50 border border-slate-700 text-slate-300 hover:text-rose-300 text-xs font-semibold transition disabled:opacity-50"
                              >
                                <X className="w-3.5 h-3.5" /> Decline
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>
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
              Student credentials will be created immediately with unique login keys.
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
                    disabled={isGeneratingSingle}
                    className="btn-royal text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {isGeneratingSingle ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      'Generate Credentials'
                    )}
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
          <div className="w-full max-w-xl rounded-2xl glass-panel-accent p-6 border border-neon-orange/40 shadow-neon">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Upload className="w-5 h-5 text-neon-orange" /> Bulk Student Account Generator
              </h3>
              <button
                onClick={() => { setBulkCreatedStudents([]); setShowBulkModal(false); }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-slate-300 mb-4">
              Paste names and emails (one per line: <code>Name, email</code>). System-generated unique credentials will be created immediately.
            </p>

            {bulkCreatedStudents.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Badge variant="approved">
                    <CheckCircle2 className="w-3.5 h-3.5 inline mr-1" />
                    Generated {bulkCreatedStudents.length} Student Credentials
                  </Badge>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => copyAllCredentialsText(bulkCreatedStudents)}
                      className="px-2.5 py-1 rounded-lg bg-dark-900 hover:bg-dark-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Copy all credentials to clipboard"
                    >
                      {copiedKey === 'all_creds' ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Copied All!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-neon-orange" />
                          <span>Copy All</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => exportStudentsCsv(bulkCreatedStudents, 'retrievo_bulk_credentials.csv')}
                      className="px-2.5 py-1 rounded-lg bg-dark-900 hover:bg-dark-800 border border-slate-700 text-slate-200 text-xs font-mono flex items-center gap-1.5 transition-colors"
                      title="Download CSV"
                    >
                      <Download className="w-3.5 h-3.5 text-sky-400" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                </div>

                <div className="max-h-72 overflow-y-auto space-y-2 p-2.5 rounded-xl bg-dark-950 border border-slate-800">
                  {bulkCreatedStudents.map((st, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-dark-900/90 border border-slate-800/80 text-xs flex items-center justify-between gap-2 text-slate-300 hover:border-slate-700 transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-white truncate">{st.name}</div>
                        <div className="font-mono text-[11px] text-slate-400 truncate">{st.email}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-neon-amber px-2.5 py-1 rounded-lg bg-dark-950 border border-slate-700/80 inline-flex items-center gap-1.5 shadow-sm select-all">
                          <Key className="w-3 h-3 text-neon-orange" />
                          {st.password}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(`Username: ${st.email} | Password: ${st.password}`, `bulk_${i}`)}
                          className="p-1.5 rounded-lg bg-dark-850 hover:bg-dark-800 border border-slate-700 text-slate-300 hover:text-white"
                          title="Copy student login"
                        >
                          {copiedKey === `bulk_${i}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-neon-orange" />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => { setBulkCreatedStudents([]); setBulkText(''); }}
                    className="flex-1 btn-royal-outline text-xs py-2"
                  >
                    + Generate More Accounts
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBulkCreatedStudents([]); setShowBulkModal(false); }}
                    className="flex-1 btn-royal text-xs py-2"
                  >
                    View in Student Directory
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleCreateBulkStudents} className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300">Names & Emails (One per line)</label>
                    <label className="cursor-pointer text-[11px] text-neon-orange hover:text-neon-orange/80 flex items-center gap-1 font-semibold transition-colors">
                      <Upload className="w-3.5 h-3.5" /> Upload .csv file
                      <input
                        type="file"
                        accept=".csv,.txt"
                        className="hidden"
                        onChange={handleCsvFileUpload}
                      />
                    </label>
                  </div>
                  <textarea
                    value={bulkText}
                    onChange={(e) => setBulkText(e.target.value)}
                    placeholder={`Ananya Sen, ananya@school.edu\nDev Kumar, dev@school.edu\nMeera Nair, meera@school.edu\nRohan Sharma, rohan.sharma@school.edu`}
                    rows={6}
                    required
                    className="w-full rounded-xl glass-input p-3 text-xs font-mono resize-none focus:border-neon-orange"
                  />
                  <span className="text-[11px] text-slate-400 block mt-1">
                    Accepts comma separated, tab-separated, or CSV files. Auto-generates unique password per student.
                  </span>
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
                    onClick={() => setShowBulkModal(false)}
                    className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300 hover:bg-dark-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingBulk}
                    className="btn-royal text-xs py-2 px-4 flex items-center gap-1.5"
                  >
                    {isGeneratingBulk ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Generating Accounts...
                      </>
                    ) : (
                      'Bulk Generate Credentials'
                    )}
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

