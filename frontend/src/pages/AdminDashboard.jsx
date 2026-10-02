import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Shield, Check, X, Users, BookOpen, Layers, Sparkles, Filter, RefreshCw, AlertCircle, FileCheck, Lock, ArrowRight } from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';

const AdminDashboard = ({ onNavigate }) => {
  const { token, user } = useAuth();
  const { showToast } = useToast();
  const [teachers, setTeachers] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, approved
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [rejectModalTeacher, setRejectModalTeacher] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (token) {
      fetchAdminData();
    } else {
      setLoading(false);
    }
  }, [filter, token]);

  const fetchAdminData = async () => {
    setLoading(true);
    try {
      const queryParam = filter === 'all' ? '' : `?status_filter=${filter}`;
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/admin/teachers${queryParam}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch('/api/admin/stats', {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);
      
      if (tRes.ok) setTeachers(await tRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error("Admin fetch error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (teacherId) => {
    setActionLoading(teacherId);
    try {
      const res = await fetch('/api/admin/teachers/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ teacher_id: teacherId, approved: true })
      });
      if (res.ok) {
        showToast("Teacher account approved successfully!", "success");
        fetchAdminData();
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectModalTeacher) return;
    setActionLoading(rejectModalTeacher.id);
    try {
      const res = await fetch('/api/admin/teachers/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          teacher_id: rejectModalTeacher.id,
          approved: false,
          reason: rejectReason || 'Administrative decision'
        })
      });
      if (res.ok) {
        showToast(`Teacher registration for "${rejectModalTeacher.name}" was rejected.`, "info");
        setRejectModalTeacher(null);
        setRejectReason('');
        await fetchAdminData();
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.detail || "Failed to reject teacher registration.", "error");
      }
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setActionLoading(null);
    }
  };

  // If not authenticated as Admin, show clean access restricted banner
  if (!user || user.role !== 'admin') {
    return (
      <div className="max-w-md mx-auto py-16 space-y-6">
        <GlassCard
          icon={Lock}
          title="Administrator Access Required"
          subtitle="Gated system console for educator verification"
          accent={true}
        >
          <div className="space-y-4 text-xs text-slate-300 text-center py-4">
            <p className="leading-relaxed">
              This console is strictly restricted to system administrators. Please sign in with an authorized administrator account to manage teacher approvals.
            </p>

            {onNavigate && (
              <div className="pt-2">
                <button
                  onClick={() => onNavigate('login')}
                  className="btn-royal text-xs py-2.5 px-6 mx-auto flex items-center justify-center gap-2"
                >
                  Go to Sign In <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-brand-400" />
            <h1 className="text-2xl font-bold text-white">Administrator Verification Console</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gated educator verification queue and system telemetry overview
          </p>
        </div>

        <button
          onClick={fetchAdminData}
          className="btn-royal-outline text-xs flex items-center gap-2 self-start md:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh Records
        </button>
      </div>

      {/* System Telemetry Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <GlassCard className="!p-4">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Pending Approvals</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-brand-400 font-mono">{stats.pending_teachers}</span>
              <Badge variant="warning">Action Required</Badge>
            </div>
          </GlassCard>

          <GlassCard className="!p-4">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Active Teachers</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-emerald-400 font-mono">{stats.approved_teachers}</span>
              <Badge variant="approved">Verified</Badge>
            </div>
          </GlassCard>

          <GlassCard className="!p-4">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Total Classrooms</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-slate-200 font-mono">{stats.total_classrooms}</span>
              <BookOpen className="w-4 h-4 text-brand-300" />
            </div>
          </GlassCard>

          <GlassCard className="!p-4">
            <span className="text-[11px] font-mono text-slate-400 uppercase">Enrolled Students</span>
            <div className="flex items-center justify-between mt-2">
              <span className="text-2xl font-bold text-slate-200 font-mono">{stats.total_students}</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
          </GlassCard>
        </div>
      )}

      {/* Teacher Signup Queue */}
      <GlassCard
        icon={Users}
        title="Educator Signup Queue"
        subtitle="Review and authorize teacher onboarding requests stored in PostgreSQL"
        action={
          <div className="flex items-center gap-2 bg-dark-900 p-1 rounded-xl border border-slate-800 text-xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1" />
            {['all', 'pending', 'approved'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-lg capitalize transition-all ${filter === tab ? 'bg-brand-600 text-white font-semibold' : 'text-slate-400 hover:text-white'}`}
              >
                {tab}
              </button>
            ))}
          </div>
        }
      >
        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="w-4 h-4 animate-spin text-brand-400" /> Fetching PostgreSQL database records...
          </div>
        ) : teachers.length === 0 ? (
          <div className="py-12 text-center text-xs text-slate-500">
            No teacher registrations found matching the '{filter}' filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                  <th className="pb-3 font-semibold">Teacher Name</th>
                  <th className="pb-3 font-semibold">Email</th>
                  <th className="pb-3 font-semibold">Status</th>
                  <th className="pb-3 font-semibold">Classrooms</th>
                  <th className="pb-3 font-semibold">Registered Date</th>
                  <th className="pb-3 font-semibold text-right">Administrative Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {teachers.map((t) => (
                  <tr key={t.id} className="hover:bg-dark-900/40 transition-colors">
                    <td className="py-3.5 font-semibold text-white">{t.name}</td>
                    <td className="py-3.5 font-mono text-slate-400">{t.email}</td>
                    <td className="py-3.5">
                      <Badge variant={t.is_approved ? 'approved' : 'pending'}>
                        {t.is_approved ? 'APPROVED' : 'PENDING REVIEW'}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-slate-300">{t.classroom_count} active</td>
                    <td className="py-3.5 text-slate-400 font-mono text-[11px]">
                      {new Date(t.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 text-right">
                      {t.is_approved ? (
                        <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1 font-medium">
                          <Check className="w-3.5 h-3.5" /> Authorized & Active
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(t.id)}
                            disabled={actionLoading === t.id}
                            className="px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1 transition-all shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                          >
                            <Check className="w-3.5 h-3.5" /> Approve
                          </button>
                          <button
                            onClick={() => setRejectModalTeacher(t)}
                            disabled={actionLoading === t.id}
                            className="px-3 py-1.5 rounded-lg bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-500/40 font-semibold flex items-center gap-1 transition-all"
                          >
                            <X className="w-3.5 h-3.5" /> Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>

      {/* Reject Modal */}
      {rejectModalTeacher && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl glass-panel-accent p-6 border border-rose-500/40 shadow-sm">
            <h3 className="text-base font-bold text-white mb-2">Reject Teacher Registration</h3>
            <p className="text-xs text-slate-300 mb-4">
              Are you sure you want to reject the application for <b className="text-rose-400">{rejectModalTeacher.name}</b>?
            </p>

            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Optional Reason for Rejection:</label>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g., Institutional affiliation could not be verified..."
              rows={3}
              className="w-full rounded-xl glass-input p-3 text-xs mb-4 resize-none"
            />

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setRejectModalTeacher(null)}
                className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectConfirm}
                disabled={actionLoading !== null}
                className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-semibold flex items-center gap-1.5 transition disabled:opacity-50"
              >
                {actionLoading === rejectModalTeacher.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Rejecting...</span>
                  </>
                ) : (
                  <span>Confirm Rejection</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminDashboard;
