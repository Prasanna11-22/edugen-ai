import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Lock, 
  Mail, 
  ArrowRight, 
  AlertCircle, 
  RefreshCw, 
  Eye, 
  EyeOff, 
  Key, 
  CheckCircle2, 
  ArrowLeft, 
  ShieldCheck,
  Send,
  X
} from 'lucide-react';
import { RetrievoIcon } from '../components/RetrievoLogo';

const LoginPage = ({ onNavigate }) => {
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Forgot Password Modal State
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [forgotEmail, setForgotEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

  // Resend Timer Countdown
  useEffect(() => {
    let timer;
    if (resendCountdown > 0) {
      timer = setTimeout(() => setResendCountdown(resendCountdown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCountdown]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }
    setError('');
    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === 'admin') onNavigate('admin_dashboard');
      else if (user.role === 'teacher') onNavigate('teacher_dashboard');
      else onNavigate('student_dashboard');
    } catch (err) {
      setError(err.message || 'Login failed. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP to email
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!forgotEmail.trim()) {
      setForgotError("Please enter your registered email address.");
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to send verification code.");
      }
      setForgotSuccess(data.message || "OTP sent successfully!");
      setForgotStep(2);
      setResendCountdown(60);
      showToast("Verification code sent to your email!", "success");
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otp.trim() || otp.trim().length < 6) {
      setForgotError("Please enter the complete 6-digit verification code.");
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: otp.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Invalid verification code.");
      }
      setForgotSuccess("Code verified! Set your new password.");
      setForgotStep(3);
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  // Step 3: Reset Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword.trim()) {
      setForgotError("Please enter a new password.");
      return;
    }
    if (newPassword.length < 4) {
      setForgotError("Password must be at least 4 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError("Passwords do not match. Please verify.");
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await fetch('/api/auth/forgot-password/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: forgotEmail.trim().toLowerCase(),
          otp: otp.trim(),
          new_password: newPassword
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to reset password.");
      }
      setForgotStep(4);
      setEmail(forgotEmail);
      setPassword(newPassword);
      showToast("Password reset successfully!", "success");
    } catch (err) {
      setForgotError(err.message);
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotModal = () => {
    setShowForgotModal(false);
    setForgotStep(1);
    setForgotError('');
    setForgotSuccess('');
    setOtp('');
    setNewPassword('');
    setConfirmPassword('');
  };

  return (
    <div className="max-w-md mx-auto pt-10 pb-16">
      
      {/* Brand Header */}
      <div className="text-center mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-neon-bright to-neon-orange p-1.5 shadow-neon mx-auto mb-4 flex items-center justify-center">
          <RetrievoIcon className="w-10 h-10 drop-shadow-md" />
        </div>
        <h2 className="text-2xl font-bold text-white">Sign In to Retrievo</h2>
        <p className="text-xs text-slate-400 mt-1">Enter your registered credentials to access your studio</p>
      </div>

      {/* Main Glass Form */}
      <div className="rounded-3xl glass-panel-accent p-8 border border-neon-orange/30 shadow-neon">
        
        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-rose-950/60 border border-rose-500/50 text-rose-300 text-xs flex items-start gap-2.5 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@institution.edu"
                required
                className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-slate-300">Password</label>
              <button
                type="button"
                onClick={() => {
                  setForgotEmail(email || '');
                  setForgotStep(1);
                  setForgotError('');
                  setForgotSuccess('');
                  setShowForgotModal(true);
                }}
                className="text-[11px] text-neon-orange hover:text-neon-amber transition-colors font-medium hover:underline"
              >
                Forgot Password?
              </button>
            </div>
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
            className="w-full btn-royal text-xs py-3 mt-2 flex items-center justify-center gap-2 shadow-neon"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" /> Authenticating with PostgreSQL...
              </>
            ) : (
              <>
                Sign In to Workspace <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400">
            Are you a new educator?{' '}
            <button
              onClick={() => onNavigate('teacher_signup')}
              className="text-neon-orange hover:text-neon-amber font-semibold ml-1 underline decoration-neon-orange/40"
            >
              Submit Teacher Registration
            </button>
          </p>
        </div>
      </div>

      {/* FORGOT PASSWORD MODAL */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-3xl glass-panel-accent p-6 sm:p-8 border border-neon-orange/40 shadow-2xl relative space-y-5 bg-dark-900/95 overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neon-orange via-neon-amber to-neon-gold" />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-neon-orange/20 border border-neon-orange/40 flex items-center justify-center text-neon-orange">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Reset Password</h3>
                  <span className="text-[10px] text-slate-400 font-mono">Step {forgotStep} of 3</span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeForgotModal}
                className="w-7 h-7 rounded-lg bg-dark-800 hover:bg-dark-700 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message */}
            {forgotError && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <span>{forgotError}</span>
              </div>
            )}

            {/* STEP 1: Email Input */}
            {forgotStep === 1 && (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-slate-300 leading-relaxed">
                  Enter your registered email address. We will verify your account and send a 6-digit verification code (OTP) from <strong className="text-neon-orange font-mono text-[11px]">lessonfoundrykce@gmail.com</strong>.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Registered Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="name@institution.edu"
                      required
                      autoFocus
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl glass-input text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={closeForgotModal}
                    className="px-4 py-2 rounded-xl text-xs bg-dark-800 text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="btn-royal text-xs py-2.5 px-5 flex items-center gap-1.5 shadow-neon"
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Sending Code...</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>Send Verification OTP</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: OTP Verification */}
            {forgotStep === 2 && (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <div className="p-3 rounded-xl bg-neon-orange/10 border border-neon-orange/30 text-xs text-slate-300 space-y-1">
                  <p className="text-neon-glow font-semibold flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-neon-orange" /> Code Dispatched!
                  </p>
                  <p className="text-[11px] text-slate-400">
                    We sent a 6-digit OTP from <strong className="text-white">lessonfoundrykce@gmail.com</strong> to <strong className="text-neon-amber">{forgotEmail}</strong>.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Enter 6-Digit OTP</label>
                  <input
                    type="text"
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="123456"
                    required
                    autoFocus
                    className="w-full py-3 px-4 rounded-xl glass-input text-center font-mono text-xl font-bold tracking-[0.4em] text-white border-neon-orange/50 focus:border-neon-orange"
                  />
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-slate-400 text-[11px]">Didn't receive code?</span>
                  {resendCountdown > 0 ? (
                    <span className="text-slate-400 font-mono text-[11px]">Resend in {resendCountdown}s</span>
                  ) : (
                    <button
                      type="button"
                      onClick={handleSendOtp}
                      disabled={forgotLoading}
                      className="text-neon-orange hover:text-neon-amber font-semibold text-[11px]"
                    >
                      Resend OTP Code
                    </button>
                  )}
                </div>

                <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => { setForgotStep(1); setForgotError(''); }}
                    className="px-3 py-2 rounded-xl text-xs bg-dark-800 text-slate-300 hover:text-white flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" /> Back
                  </button>
                  <button
                    type="submit"
                    disabled={forgotLoading || otp.length < 6}
                    className="btn-royal text-xs py-2.5 px-5 flex items-center gap-1.5 shadow-neon disabled:opacity-50"
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Verify Code</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: Set New Password */}
            {forgotStep === 3 && (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <p className="text-xs text-slate-300">
                  OTP verification successful for <strong className="text-neon-orange">{forgotEmail}</strong>. Please set your new password below.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoFocus
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4 text-neon-orange" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">Confirm New Password</label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl glass-input text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors p-1"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4 text-neon-orange" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                  <button
                    type="submit"
                    disabled={forgotLoading}
                    className="w-full btn-royal text-xs py-3 flex items-center justify-center gap-1.5 shadow-neon"
                  >
                    {forgotLoading ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password in PostgreSQL...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-4 h-4" />
                        <span>Set New Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* STEP 4: Success Screen */}
            {forgotStep === 4 && (
              <div className="text-center py-4 space-y-4 animate-in fade-in">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div className="space-y-1.5">
                  <h4 className="text-base font-bold text-white">Password Updated Successfully!</h4>
                  <p className="text-xs text-slate-300 max-w-xs mx-auto">
                    Your password for <span className="text-neon-orange font-mono">{forgotEmail}</span> has been updated. You can now sign in with your new credentials.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeForgotModal}
                  className="w-full btn-royal text-xs py-3 mt-2 flex items-center justify-center gap-2 shadow-neon"
                >
                  <span>Continue to Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
};

export default LoginPage;
