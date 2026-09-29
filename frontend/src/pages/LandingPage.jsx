import React from 'react';
import { 
  Sparkles, 
  BrainCircuit, 
  ArrowRight, 
  Lock, 
  Award, 
  GraduationCap, 
  Users, 
  BarChart3, 
  CheckCircle2,
  Sliders
} from 'lucide-react';
import GlassCard from '../components/GlassCard';

const LandingPage = ({ onNavigate }) => {
  return (
    <div className="space-y-16 pb-20">
      
      {/* Hero Section */}
      <section className="relative pt-16 pb-10 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-neon-orange/15 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="text-center max-w-3xl mx-auto space-y-6">
          <h1 className="text-4xl sm:text-6xl font-black text-white tracking-tight leading-tight">
            Turn Trusted Sources Into <span className="text-transparent bg-clip-text bg-gradient-to-r from-neon-orange via-neon-amber to-neon-gold">Objective-Aligned</span> Learning Packs
          </h1>

          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            Teacher-directed RAG workspace that transforms raw curriculum into 7 verified learning assets, collective multi-tier formative quizzes, automated guardrails, and classroom analytics.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button
              onClick={() => onNavigate('login')}
              className="btn-royal text-sm flex items-center gap-2 px-6 py-3 shadow-neon"
            >
              Launch Studio <ArrowRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => onNavigate('teacher_signup')}
              className="px-6 py-3 rounded-2xl bg-dark-900 hover:bg-dark-850 text-slate-300 hover:text-white border border-slate-700 hover:border-neon-orange text-sm font-semibold transition-all shadow-sm"
            >
              Teacher Registration
            </button>
          </div>
        </div>
      </section>

      {/* 6 Key Feature Pillars */}
      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <GlassCard 
          icon={BrainCircuit}
          title="RAG Generation Engine"
          subtitle="Grounded & Inject-Proof"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Semantic chunking with cosine similarity vector retrieval.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Inert delimiter wrapping protecting against adversarial prompt injection.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Canonical glossary extraction ensuring exact terminology alignment.</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard 
          icon={Sliders}
          title="Collective Tiered Quizzes"
          subtitle="Easy + Medium + Hard"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Unified formative quizzes with progressive cognitive tiers.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Select Medium to generate Easy + Medium; Hard for all three collective tiers.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Bloom's Taxonomy mapping with distractor rationale and step explanations.</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard 
          icon={Award}
          title="7-in-1 Complete Pack"
          subtitle="Comprehensive Studio"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Concept explanation, worked examples, formative quizzes & answer keys.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Exam revision cheat sheets & domain glossaries for every objective.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Per-item single regeneration, raw JSON editing, and instant approval gates.</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard 
          icon={Users}
          title="Classroom Orchestration"
          subtitle="Teacher Control Hub"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Create classrooms with unique join codes and auto-generated rosters.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Student directory with password display and one-click credential copying.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Deploy timed assignments with configurable attempt limits.</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard 
          icon={BarChart3}
          title="Mastery & Diagnostics"
          subtitle="Objective Telemetry"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Objective-by-objective student score breakdown and diagnostic telemetry.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Live submission review with student answer comparison.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Individual and class-wide performance insights for targeted intervention.</span>
            </li>
          </ul>
        </GlassCard>

        <GlassCard 
          icon={GraduationCap}
          title="Student Experience"
          subtitle="Interactive Learning"
        >
          <ul className="space-y-2.5 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Modern interactive quiz portal with instant feedback and timed assessments.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Comprehensive study materials: worked steps, formulas, and revision notes.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 mt-0.5" />
              <span>Seamless student dashboard with active assignments and mastery scores.</span>
            </li>
          </ul>
        </GlassCard>

      </section>

      {/* Role Navigation */}
      <section className="max-w-4xl mx-auto rounded-3xl glass-panel p-8 text-center space-y-6">
        <h3 className="text-2xl font-bold text-white">Access the Platform by Role</h3>
        <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto">
          Sign in with your credentials or register a new educator account.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <button
            onClick={() => onNavigate('login')}
            className="p-5 rounded-2xl bg-dark-900 hover:bg-dark-850 border border-slate-800 hover:border-neon-orange transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-neon-orange font-bold">Administrator</span>
                <Lock className="w-4 h-4 text-slate-500 group-hover:text-neon-orange transition-colors" />
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-neon-glow">Admin Console</h4>
              <p className="text-[11px] text-slate-400 mt-1">Review & authorize educator signups and system audits.</p>
            </div>
            <div className="mt-4 text-xs text-neon-orange flex items-center gap-1 font-semibold">
              Sign In <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => onNavigate('login')}
            className="p-5 rounded-2xl bg-dark-900 hover:bg-dark-850 border border-slate-800 hover:border-neon-orange transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-neon-orange font-bold">Educator</span>
                <Sparkles className="w-4 h-4 text-slate-500 group-hover:text-neon-orange transition-colors" />
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-neon-glow">Teacher Studio</h4>
              <p className="text-[11px] text-slate-400 mt-1">Upload syllabus, generate packs, manage classrooms & credentials.</p>
            </div>
            <div className="mt-4 text-xs text-neon-orange flex items-center gap-1 font-semibold">
              Sign In <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>

          <button
            onClick={() => onNavigate('login')}
            className="p-5 rounded-2xl bg-dark-900 hover:bg-dark-850 border border-slate-800 hover:border-neon-orange transition-all text-left group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-mono uppercase text-neon-orange font-bold">Student</span>
                <GraduationCap className="w-4 h-4 text-slate-500 group-hover:text-neon-orange transition-colors" />
              </div>
              <h4 className="text-base font-semibold text-white group-hover:text-neon-glow">Student Portal</h4>
              <p className="text-[11px] text-slate-400 mt-1">Take tiered formative tests, review explanations & track mastery.</p>
            </div>
            <div className="mt-4 text-xs text-neon-orange flex items-center gap-1 font-semibold">
              Sign In <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        </div>
      </section>

    </div>
  );
};

export default LandingPage;
