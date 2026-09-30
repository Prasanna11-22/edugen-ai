import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Shield, BookOpen, GraduationCap, LogOut, User as UserIcon, 
  LayoutDashboard, Sparkles, Mail, ChevronDown
} from 'lucide-react';
import Badge from './Badge';
import RetrievoLogo from './RetrievoLogo';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin, isTeacher, isStudent } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setShowProfileMenu(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-neon-orange/20 bg-dark-950/95 backdrop-blur-xl transition-all shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
        
        {/* Brand */}
        <RetrievoLogo 
          onClick={() => setActiveTab(user ? 'dashboard' : 'landing')} 
        />

        {/* Navigation items if logged in */}
        {user && (
          <nav className="hidden md:flex items-center gap-1.5 bg-dark-900/60 p-1.5 rounded-2xl border border-slate-800/80 backdrop-blur-md">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin_dashboard')}
                className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'admin_dashboard' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-300 hover:text-white hover:bg-dark-800'}`}
              >
                <Shield className="w-4 h-4" /> Admin Console
              </button>
            )}

            {isTeacher && (
              <>
                <button
                  onClick={() => setActiveTab('teacher_dashboard')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'teacher_dashboard' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-300 hover:text-white hover:bg-dark-800'}`}
                >
                  <LayoutDashboard className="w-4 h-4" /> Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('teacher_studio')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'teacher_studio' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-300 hover:text-white hover:bg-dark-800'}`}
                >
                  <Sparkles className="w-4 h-4" /> Generate Lesson
                </button>
                <button
                  onClick={() => setActiveTab('teacher_classrooms')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'teacher_classrooms' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-300 hover:text-white hover:bg-dark-800'}`}
                >
                  <BookOpen className="w-4 h-4" /> Classrooms & Analytics
                </button>
              </>
            )}

            {isStudent && (
              <>
                <button
                  onClick={() => setActiveTab('student_dashboard')}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${activeTab === 'student_dashboard' ? 'bg-neon-orange text-white shadow-neon-sm' : 'text-slate-300 hover:text-white hover:bg-dark-800'}`}
                >
                  <GraduationCap className="w-4 h-4" /> My Classrooms
                </button>
              </>
            )}
          </nav>
        )}

        {/* User Profile & Actions */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="relative" ref={profileMenuRef}>
              
              {/* Interactive Profile Pill Trigger */}
              <button
                type="button"
                onClick={() => setShowProfileMenu(prev => !prev)}
                className={`flex items-center gap-2.5 sm:gap-3 px-3 py-1.5 rounded-2xl bg-dark-900/90 hover:bg-dark-850 border transition-all duration-200 cursor-pointer shadow-sm group focus:outline-none ${
                  showProfileMenu 
                    ? 'border-neon-orange ring-2 ring-neon-orange/25 bg-dark-850' 
                    : 'border-slate-800/90 hover:border-slate-700'
                }`}
                title="Click profile logo to view details & sign out"
                aria-expanded={showProfileMenu}
              >
                {/* User Avatar Logo */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-neon-bright to-neon-orange flex items-center justify-center text-white font-bold text-xs shadow-neon-sm shrink-0 group-hover:scale-105 transition-transform">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>

                {/* Brief Info */}
                <div className="hidden sm:flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white tracking-wide leading-tight group-hover:text-neon-orange transition-colors">
                      {user.name}
                    </span>
                    <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider ${
                      user.role === 'admin' 
                        ? 'bg-purple-950/80 text-purple-300 border border-purple-500/40' 
                        : user.role === 'teacher'
                        ? 'bg-orange-950/80 text-neon-orange border border-neon-orange/40'
                        : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                    }`}>
                      {user.role}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono leading-tight max-w-[140px] truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-white transition-transform duration-200 ${
                  showProfileMenu ? 'rotate-180 text-neon-orange' : ''
                }`} />
              </button>

              {/* Profile Dropdown Popup (Name, Email, and Sign Out) */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2.5 w-72 sm:w-80 rounded-3xl bg-dark-900 border border-slate-700/80 shadow-[0_15px_40px_rgba(0,0,0,0.7)] backdrop-blur-2xl p-5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  
                  {/* Dropdown Header: Avatar, Name & Role */}
                  <div className="flex items-center gap-3.5 pb-4 border-b border-slate-800">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neon-bright to-neon-orange flex items-center justify-center text-white font-black text-lg shadow-neon shrink-0">
                      {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-6 h-6" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white truncate" title={user.name}>
                          {user.name}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider ${
                          user.role === 'admin' 
                            ? 'bg-purple-950/90 text-purple-300 border border-purple-500/40' 
                            : user.role === 'teacher'
                            ? 'bg-orange-950/90 text-neon-orange border border-neon-orange/40'
                            : 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/40'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono text-slate-400 block mt-0.5">
                        Active Account
                      </span>
                    </div>
                  </div>

                  {/* Profile Email Section */}
                  <div className="py-3.5 space-y-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold block">
                      Email Address
                    </span>
                    <div className="p-3 rounded-2xl bg-dark-950/90 border border-slate-800 flex items-center gap-2.5">
                      <Mail className="w-4 h-4 text-neon-orange shrink-0" />
                      <span className="text-xs font-mono text-slate-200 select-all break-all leading-tight">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Divider and Sign Out Action */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                        setActiveTab('landing');
                      }}
                      className="w-full py-2.5 px-4 rounded-2xl bg-rose-500/15 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 hover:border-rose-500 text-xs font-bold transition-all duration-200 flex items-center justify-center gap-2 shadow-sm group cursor-pointer active:scale-98"
                    >
                      <LogOut className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
                      <span>Sign Out</span>
                    </button>
                  </div>

                </div>
              )}

            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('login')}
                className="btn-royal text-xs"
              >
                Sign In
              </button>
              <button
                onClick={() => setActiveTab('teacher_signup')}
                className="btn-royal-outline text-xs"
              >
                Teacher Registration
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  );
};

export default Navbar;
