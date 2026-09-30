import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Mail, Lock, Building, ArrowRight, CheckCircle2, Clock, ArrowLeft, Eye, EyeOff } from 'lucide-react';
import Badge from '../components/Badge';
import { RetrievoIcon } from '../components/RetrievoLogo';

const TeacherSignupPage = ({ onNavigate }) => {
  const { signupTeacher } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [institution, setInstitution] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signupTeacher(name, email, password, institution);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto pt-8 pb-16">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-neon-bright to-neon-orange p-1.5 shadow-neon mx-auto mb-4 flex items-center justify-center">
          <RetrievoIcon className="w-10 h-10 drop-shadow-md" />
        </div>
        <h2 className="text-2xl font-bold text-white">Teacher Registration</h2>
        <p className="text-xs text-slate-400 mt-1">Gated educator studio access with administrative approval flow</p>
      </div>

      <div className="rounded-3xl glass-panel-accent p-8 border border-neon-orange/30 shadow-neon">
        {submitted ? (
          <div className="text-center space-y-4 py-4 animate-in fade-in">
            <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.3)]">
              <Clock className="w-8 h-8 animate-spin" />
            </div>

            <div className="inline-block">
              <Badge variant="pending">STATUS: PENDING ADMIN APPROVAL</Badge>
            </div>

            <h3 className="text-lg font-bold text-white">Registration Submitted!</h3>
            
            <p className="text-xs text-slate-300 leading-relaxed max-w-sm mx-auto">
              Your educator account for <b className="text-neon-amber">{email}</b> has been queued for administrator verification. You will be able to log in immediately once approved.
            </p>

            <div className="pt-4 flex flex-col gap-2">
              <button
                onClick={() => onNavigate('login')}
                className="btn-royal text-xs py-2.5"
              >
                Return to Sign In
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Full Name</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Rajesh Sharma"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Institutional Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="professor@university.edu"
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Institution / School Name</label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="SRM Institute of Science and Technology"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors focus:outline-none p-1 rounded-lg"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4 text-neon-orange" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-royal text-xs py-3 mt-2 flex items-center justify-center gap-2"
            >
              {loading ? 'Submitting Registration...' : 'Submit for Admin Approval'}
              <ArrowRight className="w-4 h-4" />
            </button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => onNavigate('login')}
                className="text-xs text-slate-400 hover:text-slate-200 inline-flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" /> Back to Sign In
              </button>
            </div>
          </form>
        )}
      </div>

    </div>
  );
};

export default TeacherSignupPage;
