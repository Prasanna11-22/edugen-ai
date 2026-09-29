import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Target, CheckCircle2, Award, Clock, ArrowLeft, Send, Sparkles, 
  AlertCircle, RefreshCw, AlertTriangle, CheckSquare, HelpCircle 
} from 'lucide-react';
import GlassCard from '../components/GlassCard';
import Badge from '../components/Badge';
import MasteryBreakdown from '../components/MasteryBreakdown';

const StudentAssessmentPage = ({ assignment, onBack }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(assignment?.latest_submission || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const questions = assignment?.questions || [];
  const timeLimitSeconds = (assignment?.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  // Auto-countdown timer
  useEffect(() => {
    if (submitted || result || !assignment.can_attempt) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!submittedRef.current) {
            handleAutoSubmitOnTimeOut();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [submitted, result, assignment.can_attempt]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId, optionKey) => {
    if (submitted || !assignment.can_attempt || timeLeft <= 0) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleAutoSubmitOnTimeOut = async () => {
    submittedRef.current = true;
    showToast("⏰ Time's up! Auto-submitting your assessment answers...", "info", 5000);
    await submitToServer(answers);
  };

  const submitToServer = async (currentAnswers) => {
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/student/assignments/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assignment_id: assignment.assignment_id,
          answers: currentAnswers
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Submission failed');
      setResult(data);
      setSubmitted(true);
      submittedRef.current = true;
      showToast("Assessment submitted successfully! Mastery index computed.", "success");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const answeredCount = Object.keys(answers).length;
    if (answeredCount < questions.length) {
      showToast(`Please answer all questions. (${answeredCount}/${questions.length} completed)`, "error");
      return;
    }
    await submitToServer(answers);
  };

  const answeredCount = Object.keys(answers).length;
  const isTimeCritical = timeLeft < 120 && timeLeft > 0;
  const isTimeWarning = timeLeft < 300 && timeLeft >= 120;

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20 animate-in fade-in">
      
      {/* Sticky Header Bar with Live Countdown Timer */}
      <div className="sticky top-20 z-40 bg-dark-950/90 backdrop-blur-xl py-3 px-4 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 shadow-neon">
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded-xl bg-dark-850 hover:bg-dark-800 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition-all border border-slate-800"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Class
        </button>

        {/* Live Timer if not submitted */}
        {!submitted && !result && assignment.can_attempt && (
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs font-bold border transition-all ${
            isTimeCritical 
              ? 'bg-rose-950/80 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.4)] animate-pulse'
              : (isTimeWarning 
                ? 'bg-amber-950/70 border-amber-500 text-amber-300 shadow-sm'
                : 'bg-dark-900 border-neon-orange/40 text-neon-glow shadow-neon-sm')
          }`}>
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-400' : 'text-neon-orange'}`} />
            <span>Time Remaining: {formatTime(timeLeft)}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant="bloom">Full Set ({questions.length} Items)</Badge>
        </div>
      </div>

      {/* Assessment Info Banner */}
      <div className="rounded-2xl glass-panel-accent p-6 border border-neon-orange/30 shadow-neon">
        <div className="flex items-center justify-between gap-2 mb-1">
          <span className="text-[10px] font-mono uppercase text-neon-orange font-bold">
            {assignment.unit_title} · Objective Alignment
          </span>
          <span className="text-xs font-mono text-slate-400">
            {assignment.time_limit_minutes || 15} Mins Custom Limit
          </span>
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">{assignment.title}</h1>
        <p className="text-xs text-slate-300 mt-1">
          Complete all objective-aligned questions below. Your answers will be evaluated to calculate mastery signals across learning contracts.
        </p>

        {/* Progress bar */}
        {!submitted && !result && (
          <div className="mt-4 pt-3 border-t border-slate-800/80 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Progress:</span>
              <span className="font-mono font-semibold text-neon-glow">{answeredCount} of {questions.length} Answered</span>
            </div>
            <div className="w-full h-2 rounded-full bg-dark-900 border border-slate-800 overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-neon-orange to-neon-amber transition-all duration-300"
                style={{ width: `${(answeredCount / (questions.length || 1)) * 100}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Results View if Submitted */}
      {(submitted || result) && (
        <div className="space-y-6 animate-in fade-in">
          <MasteryBreakdown
            breakdown={result?.objective_breakdown || {}}
            overallScore={result?.score || 0}
            masterySignal={result?.mastery_signal || "Formative Feedback Computed"}
          />

          <div className="text-center pt-2">
            <button
              onClick={onBack}
              className="btn-royal text-xs px-8 py-3 shadow-neon"
            >
              Return to Student Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Full Set Question Form */}
      {!submitted && !result && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-950/70 border border-rose-500 text-rose-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {questions.map((q, idx) => {
            const isAnswered = !!answers[q.id];
            return (
              <div 
                key={q.id || idx} 
                className={`rounded-2xl glass-panel p-6 border transition-all space-y-4 ${
                  isAnswered ? 'border-slate-800' : 'border-neon-orange/20 shadow-sm'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-white leading-relaxed">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-lg bg-neon-orange/20 border border-neon-orange/40 text-neon-glow font-mono font-bold text-xs mr-2">
                      {idx + 1}
                    </span>
                    {q.question}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {q.objective_title && (
                      <span className="text-[10px] font-mono text-neon-amber px-2 py-0.5 rounded bg-dark-900 border border-slate-800">
                        {q.objective_title}
                      </span>
                    )}
                    {q.bloom_level && (
                      <Badge variant="bloom">{q.bloom_level}</Badge>
                    )}
                  </div>
                </div>

                {/* Options Cards */}
                <div className="space-y-2.5 pt-1">
                  {Object.entries(q.options || {}).map(([optKey, optVal]) => {
                    const isSelected = answers[q.id] === optKey;
                    return (
                      <div
                        key={optKey}
                        onClick={() => handleSelectOption(q.id, optKey)}
                        className={`p-4 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isSelected 
                            ? 'bg-neon-orange/20 border-neon-orange text-white shadow-neon-sm border font-semibold scale-[1.005]' 
                            : 'bg-dark-900/90 hover:bg-dark-850 text-slate-300 border border-slate-800/90 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3.5">
                          <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-mono font-bold text-xs transition-all ${
                            isSelected 
                              ? 'bg-neon-orange text-white shadow-neon-sm' 
                              : 'bg-dark-800 text-slate-400'
                          }`}>
                            {optKey}
                          </span>
                          <span className="leading-relaxed">{optVal}</span>
                        </div>

                        {isSelected && (
                          <CheckCircle2 className="w-4 h-4 text-neon-orange shrink-0 animate-in zoom-in-75" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Submit Action Bar */}
          <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl glass-panel border border-slate-800">
            <div className="text-xs text-slate-400 font-mono">
              Status: <b className="text-white">{answeredCount} of {questions.length}</b> questions answered
            </div>

            <button
              type="submit"
              disabled={submitting || answeredCount < questions.length}
              className={`btn-royal text-xs px-8 py-3 shadow-neon flex items-center gap-2 transition-all ${
                answeredCount < questions.length ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" /> Auto-Scoring Submission...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" /> Submit Full Assessment Set
                </>
              )}
            </button>
          </div>
        </form>
      )}

    </div>
  );
};

export default StudentAssessmentPage;
