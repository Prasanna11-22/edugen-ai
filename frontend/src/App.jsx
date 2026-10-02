import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import Navbar from './components/Navbar';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import TeacherSignupPage from './pages/TeacherSignupPage';
import AdminDashboard from './pages/AdminDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import TeacherStudioPage from './pages/TeacherStudioPage';
import TeacherClassroomPage from './pages/TeacherClassroomPage';
import StudentDashboard from './pages/StudentDashboard';
import StudentAssessmentPage from './pages/StudentAssessmentPage';
import StudentMaterialViewer from './pages/StudentMaterialViewer';

const AppContent = () => {
  const { user, isAdmin, isTeacher, isStudent } = useAuth();
  const [activeTab, setActiveTab] = useState('landing');
  
  // Navigation State
  const [selectedUnitId, setSelectedUnitId] = useState(null);
  const [selectedClassroomId, setSelectedClassroomId] = useState(null);
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [activeMaterial, setActiveMaterial] = useState(null);

  // Auto-switch tab when user logs in or out
  useEffect(() => {
    if (user) {
      if (activeTab === 'login' || activeTab === 'landing' || activeTab === 'teacher_signup') {
        if (user.role === 'admin') setActiveTab('admin_dashboard');
        else if (user.role === 'teacher') setActiveTab('teacher_dashboard');
        else if (user.role === 'student') setActiveTab('student_dashboard');
      }
    } else {
      setSelectedUnitId(null);
      setSelectedClassroomId(null);
      setActiveAssessment(null);
      setActiveMaterial(null);
      if (activeTab !== 'login' && activeTab !== 'teacher_signup') {
        setActiveTab('landing');
      }
    }
  }, [user]);

  const handleNavigate = (tab, params = {}) => {
    setActiveTab(tab);
    if (params.unitId) setSelectedUnitId(params.unitId);
    if (params.classroomId) setSelectedClassroomId(params.classroomId);
  };

  // Determine current screen
  const renderScreen = () => {
    // If not authenticated, restrict protected routes to LandingPage
    if (!user && !['landing', 'login', 'teacher_signup'].includes(activeTab)) {
      return <LandingPage onNavigate={handleNavigate} />;
    }

    switch (activeTab) {
      case 'landing':
        return <LandingPage onNavigate={handleNavigate} />;
      
      case 'login':
        return <LoginPage onNavigate={handleNavigate} />;
      
      case 'teacher_signup':
        return <TeacherSignupPage onNavigate={handleNavigate} />;
      
      case 'admin_dashboard':
        return <AdminDashboard onNavigate={handleNavigate} />;
      
      case 'teacher_dashboard':
      case 'dashboard':
        if (isAdmin) return <AdminDashboard onNavigate={handleNavigate} />;
        if (isTeacher) {
          return (
            <TeacherDashboard
              onNavigate={handleNavigate}
              onSelectUnit={(uId) => { setSelectedUnitId(uId); setActiveTab('teacher_studio'); }}
              onSelectClassroom={(cId) => { setSelectedClassroomId(cId); setActiveTab('teacher_classrooms'); }}
            />
          );
        }
        if (isStudent) {
          return (
            <StudentDashboard
              onTakeAssessment={(a) => { setActiveAssessment(a); setActiveTab('student_assessment'); }}
              onViewMaterial={(m, initialTab = 'all') => { setActiveMaterial({ ...m, initialTab }); setActiveTab('student_material'); }}
            />
          );
        }
        return <LandingPage onNavigate={handleNavigate} />;

      case 'teacher_studio':
        return (
          <TeacherStudioPage
            selectedUnitId={selectedUnitId}
            onBack={() => setActiveTab('teacher_dashboard')}
            onNavigateClassrooms={() => setActiveTab('teacher_classrooms')}
          />
        );

      case 'teacher_classrooms':
        return (
          <TeacherClassroomPage
            classroomId={selectedClassroomId}
            onBack={() => setActiveTab('teacher_dashboard')}
          />
        );

      case 'student_dashboard':
        return (
          <StudentDashboard
            onTakeAssessment={(a) => { setActiveAssessment(a); setActiveTab('student_assessment'); }}
            onViewMaterial={(m, initialTab = 'all') => { setActiveMaterial({ ...m, initialTab }); setActiveTab('student_material'); }}
          />
        );

      case 'student_assessment':
        return activeAssessment ? (
          <StudentAssessmentPage
            assignment={activeAssessment}
            onBack={() => setActiveTab('student_dashboard')}
          />
        ) : (
          <StudentDashboard
            onTakeAssessment={(a) => { setActiveAssessment(a); setActiveTab('student_assessment'); }}
            onViewMaterial={(m, initialTab = 'all') => { setActiveMaterial({ ...m, initialTab }); setActiveTab('student_material'); }}
          />
        );

      case 'student_material':
        return activeMaterial ? (
          <StudentMaterialViewer
            material={activeMaterial}
            onBack={() => setActiveTab('student_dashboard')}
          />
        ) : (
          <StudentDashboard
            onTakeAssessment={(a) => { setActiveAssessment(a); setActiveTab('student_assessment'); }}
            onViewMaterial={(m, initialTab = 'all') => { setActiveMaterial({ ...m, initialTab }); setActiveTab('student_material'); }}
          />
        );

      default:
        return <LandingPage onNavigate={handleNavigate} />;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 text-slate-100 flex flex-col selection:bg-brand-600 selection:text-white">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {renderScreen()}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-slate-900 bg-dark-950/90 py-6 text-center text-xs text-slate-500 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Retrievo</span>
            <span>·</span>
            <span>Retrieve Smarter. Learn Better.</span>
          </div>
          <div className="text-xs text-slate-400">
            © {new Date().getFullYear()} Byte Buddies. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}

export default App;
