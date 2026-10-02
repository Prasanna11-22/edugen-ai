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
    <header className="sticky top-0 z-30 w-full border-b border-slate-800/90 bg-dark-950/90 backdrop-blur-md transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        
        {/* Brand */}
        <RetrievoLogo 
          onClick={() => setActiveTab(user ? 'dashboard' : 'landing')} 
        />

        {/* Navigation items if logged in */}
        {user && (
          <nav className="hidden md:flex items-center gap-1 bg-dark-900/90 p-1 rounded-lg border border-slate-800">
            {isAdmin && (
              <button
                onClick={() => setActiveTab('admin_dashboard')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                  activeTab === 'admin_dashboard' 
                    ? 'bg-brand-600 text-white shadow-sm' 
                    : 'text-slate-300 hover:text-white hover:bg-dark-800'
                }`}
              >
                <Shield className="w-3.5 h-3.5" /> Admin Console
              </button>
            )}

            {isTeacher && (
              <>
                <button
                  onClick={() => setActiveTab('teacher_dashboard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === 'teacher_dashboard' 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <LayoutDashboard className="w-3.5 h-3.5" /> Dashboard
                </button>
                <button
                  onClick={() => setActiveTab('teacher_studio')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === 'teacher_studio' 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" /> Generate Lesson
                </button>
                <button
                  onClick={() => setActiveTab('teacher_classrooms')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === 'teacher_classrooms' 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" /> Classrooms & Analytics
                </button>
              </>
            )}

            {isStudent && (
              <>
                <button
                  onClick={() => setActiveTab('student_dashboard')}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-all ${
                    activeTab === 'student_dashboard' 
                      ? 'bg-brand-600 text-white shadow-sm' 
                      : 'text-slate-300 hover:text-white hover:bg-dark-800'
                  }`}
                >
                  <GraduationCap className="w-3.5 h-3.5" /> My Classrooms
                </button>
              </>
            )}
          </nav>
        )}

        {/* User Profile & Actions */}
        <div className="flex items-center gap-2.5">
          {user ? (
            <div className="relative" ref={profileMenuRef}>
              
              {/* Interactive Profile Pill Trigger */}
              <button
                type="button"
                onClick={() => setShowProfileMenu(prev => !prev)}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg bg-dark-900 border transition-all duration-150 cursor-pointer shadow-subtle group focus:outline-none ${
                  showProfileMenu 
                    ? 'border-brand-500/60 ring-1 ring-brand-500/20 bg-dark-850' 
                    : 'border-slate-800 hover:border-slate-700'
                }`}
                aria-expanded={showProfileMenu}
              >
                {/* User Avatar */}
                <div className="w-6 h-6 rounded-md bg-brand-600 flex items-center justify-center text-white font-semibold text-[11px] shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-3.5 h-3.5" />}
                </div>

                {/* Brief Info */}
                <div className="hidden sm:flex flex-col text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-100 tracking-tight leading-tight">
                      {user.name}
                    </span>
                    <Badge variant={user.role === 'admin' ? 'bloom' : user.role === 'teacher' ? 'royal' : 'approved'}>
                      {user.role}
                    </Badge>
                  </div>
                </div>

                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 group-hover:text-slate-200 transition-transform duration-150 ${
                  showProfileMenu ? 'rotate-180 text-brand-400' : ''
                }`} />
              </button>

              {/* Profile Dropdown */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-72 rounded-xl bg-dark-900 border border-slate-800 shadow-elevated p-4 z-50 animate-in fade-in zoom-in-95 duration-100">
                  
                  {/* Dropdown Header */}
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
                    <div className="w-9 h-9 rounded-lg bg-brand-600 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-semibold text-white truncate" title={user.name}>
                          {user.name}
                        </h4>
                        <Badge variant={user.role === 'admin' ? 'bloom' : user.role === 'teacher' ? 'royal' : 'approved'}>
                          {user.role}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-slate-400 truncate block mt-0.5" title={user.email}>
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Account Details */}
                  <div className="py-2.5">
                    <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400 block mb-1">
                      Authenticated ID
                    </span>
                    <div className="p-2 rounded-lg bg-dark-950 border border-slate-800/80 flex items-center gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="text-[11px] font-mono text-slate-300 select-all truncate">
                        {user.email}
                      </span>
                    </div>
                  </div>

                  {/* Sign Out Action */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setShowProfileMenu(false);
                        logout();
                        setActiveTab('landing');
                      }}
                      className="w-full py-2 px-3 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/20 text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
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
