import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, Shield, BookOpen, GraduationCap, LogOut, User as UserIcon, LayoutDashboard, Sparkles } from 'lucide-react';
import Badge from './Badge';

const Navbar = ({ activeTab, setActiveTab }) => {
  const { user, logout, isAdmin, isTeacher, isStudent } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-neon-orange/20 bg-dark-950/80 backdrop-blur-xl transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
        
        {/* Brand */}
        <div 
          onClick={() => setActiveTab(user ? 'dashboard' : 'landing')}
          className="flex items-center gap-3 cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-neon-bright to-neon-orange flex items-center justify-center shadow-neon group-hover:scale-105 transition-transform duration-300">
            <Flame className="w-6 h-6 text-white animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-wider text-white">Retri<span className="text-neon-orange">evo</span></span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Retrieve Smarter. Learn Better.</p>
          </div>
        </div>

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
            <div className="flex items-center gap-2.5">
              {/* User Profile Pill Card */}
              <div className="flex items-center gap-3 px-3 py-1.5 rounded-2xl bg-dark-900/80 hover:bg-dark-850 border border-slate-800/90 shadow-sm transition-all">
                {/* User Avatar Circle */}
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-neon-bright to-neon-orange flex items-center justify-center text-white font-bold text-xs shadow-neon-sm shrink-0">
                  {user.name ? user.name.charAt(0).toUpperCase() : <UserIcon className="w-4 h-4" />}
                </div>

                {/* User Info Details */}
                <div className="hidden sm:flex flex-col text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white tracking-wide leading-tight">
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
                  <span className="text-[10px] text-slate-400 font-mono leading-tight max-w-[170px] truncate" title={user.email}>
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  logout();
                  setActiveTab('landing');
                }}
                title="Sign out"
                className="p-2.5 rounded-2xl bg-dark-900/80 hover:bg-rose-950/50 text-slate-400 hover:text-rose-400 border border-slate-800 hover:border-rose-500/40 shadow-sm transition-all duration-200 group flex items-center justify-center"
              >
                <LogOut className="w-4 h-4 group-hover:scale-110 transition-transform" />
              </button>
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
