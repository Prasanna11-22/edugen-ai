import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Target, CheckCircle2, Award, Clock, ArrowLeft, ArrowRight, Send, Sparkles, 
  AlertCircle, RefreshCw, AlertTriangle, CheckSquare, HelpCircle, Maximize2, 
  Minimize2, LayoutGrid, X, Check, ChevronLeft, ChevronRight, RotateCcw, ListOrdered, Flame
} from 'lucide-react';
import Badge from '../components/Badge';
import MasteryBreakdown from '../components/MasteryBreakdown';

const StudentAssessmentPage = ({ assignment, onBack }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(assignment?.latest_submission || null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const questions = assignment?.questions || [];
  const currentQuestion = questions[currentIndex] || null;
  const timeLimitSeconds = (assignment?.time_limit_minutes || 15) * 60;
  const [timeLeft, setTimeLeft] = useState(timeLimitSeconds);
  const timerRef = useRef(null);
  const submittedRef = useRef(false);

  const answeredCount = Object.keys(answers).length;
  const remainingCount = Math.max(0, questions.length - answeredCount);
  const isTimeCritical = timeLeft < 120 && timeLeft > 0;
  const isTimeWarning = timeLeft < 300 && timeLeft >= 120;
  const progressPercent = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  // Auto enter browser fullscreen when starting assessment
  useEffect(() => {
    if (assignment?.can_attempt && !submitted && !result && !document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    }
  }, [assignment?.can_attempt, submitted, result]);

  // Fullscreen change listener
  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  // Auto-countdown timer
  useEffect(() => {
    if (submitted || result || !assignment?.can_attempt) return;

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
  }, [submitted, result, assignment?.can_attempt]);

  // Keyboard navigation & option selection
  useEffect(() => {
    if (submitted || result || !assignment?.can_attempt) return;

    const handleKeyDown = (e) => {
      if (['input', 'textarea'].includes(document.activeElement?.tagName?.toLowerCase())) return;

      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        if (currentIndex < questions.length - 1) {
          setCurrentIndex(prev => prev + 1);
        }
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        if (currentIndex > 0) {
          setCurrentIndex(prev => prev - 1);
        }
      } else if (['a', 'b', 'c', 'd', 'A', 'B', 'C', 'D'].includes(e.key) && currentQuestion) {
        handleSelectOption(currentQuestion.id, e.key.toUpperCase());
      } else if (['1', '2', '3', '4'].includes(e.key) && currentQuestion) {
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D' };
        handleSelectOption(currentQuestion.id, map[e.key]);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, questions.length, currentQuestion, submitted, result, assignment?.can_attempt]);

  const toggleBrowserFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
        setIsFullscreen(false);
      }
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remainingSecs).padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId, optionKey) => {
    if (submitted || !assignment?.can_attempt || timeLeft <= 0) return;
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleClearCurrentSelection = () => {
    if (!currentQuestion) return;
    setAnswers((prev) => {
      const copy = { ...prev };
      delete copy[currentQuestion.id];
      return copy;
    });
  };

  const handleAutoSubmitOnTimeOut = async () => {
    submittedRef.current = true;
    showToast("⏰ Time's up! Auto-submitting your assessment answers...", "info", 5000);
    await submitToServer(answers);
  };

  const submitToServer = async (currentAnswers) => {
    setSubmitting(true);
    setError('');
    setShowSubmitModal(false);
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
      showToast("Assessment submitted successfully! Mastery score calculated.", "success");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Results view upon completion
  if (submitted || result) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 text-slate-100 flex flex-col overflow-y-auto p-4 sm:p-8 animate-in fade-in">
        <div className="max-w-4xl w-full mx-auto space-y-6 my-auto">
          <div className="text-center space-y-2 pb-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              <CheckCircle2 className="w-4 h-4" /> Examination Completed & Scored
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white">{assignment.title}</h1>
            <p className="text-xs sm:text-sm text-slate-400">
              Your responses have been processed and mapped to verified curriculum learning objectives.
            </p>
          </div>

          <MasteryBreakdown
            breakdown={result?.objective_breakdown || {}}
            overallScore={result?.score || 0}
            masterySignal={result?.mastery_signal || "Formative Feedback Computed"}
          />

          {/* Detailed Question-by-Question Evaluation Review */}
          {result?.question_evaluations && result.question_evaluations.length > 0 && (
            <div className="space-y-4 pt-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-neon-orange" /> Question Evaluation & Solution Review
                </h3>
                <span className="text-xs font-mono text-slate-400">
                  <strong className="text-emerald-400">{result.correct_answers || 0}</strong> of <strong className="text-white">{result.total_questions || result.question_evaluations.length}</strong> Correct
                </span>
              </div>

              <div className="space-y-4">
                {result.question_evaluations.map((ev, qIdx) => (
                  <div
                    key={ev.id || qIdx}
                    className={`p-5 rounded-2xl border transition space-y-3 ${
                      ev.is_correct 
                        ? 'bg-emerald-950/20 border-emerald-500/40 shadow-sm' 
                        : 'bg-dark-900 border-rose-500/40'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <span className={`w-6 h-6 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 ${
                          ev.is_correct ? 'bg-emerald-500 text-black' : 'bg-rose-500 text-white'
                        }`}>
                          {qIdx + 1}
                        </span>
                        <h4 className="font-semibold text-xs sm:text-sm text-white leading-relaxed">
                          {ev.question}
                        </h4>
                      </div>

                      <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold shrink-0 ${
                        ev.is_correct 
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                          : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      }`}>
                        {ev.is_correct ? '✓ Correct' : '✗ Incorrect'}
                      </span>
                    </div>

                    {/* Options Breakdown */}
                    {ev.options && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pl-8 pt-1">
                        {Object.entries(ev.options).map(([optKey, optVal]) => {
                          const isCorrectKey = optKey.toUpperCase() === (ev.correct_option || '').toUpperCase();
                          const isStudentSelected = optKey.toUpperCase() === (ev.student_answer || '').toUpperCase();

                          let optClass = 'bg-dark-950 border-slate-800 text-slate-400';
                          if (isCorrectKey) {
                            optClass = 'bg-emerald-950/40 border-emerald-500/60 text-emerald-200 font-semibold';
                          } else if (isStudentSelected && !isCorrectKey) {
                            optClass = 'bg-rose-950/30 border-rose-500/50 text-rose-300 font-medium line-through';
                          }

                          return (
                            <div
                              key={optKey}
                              className={`p-2.5 rounded-xl border text-xs flex items-center justify-between gap-2 ${optClass}`}
                            >
                              <div className="flex items-center gap-2">
                                <span className={`font-mono font-bold text-xs ${isCorrectKey ? 'text-emerald-400' : (isStudentSelected ? 'text-rose-400' : 'text-slate-500')}`}>
                                  {optKey})
                                </span>
                                <span>{optVal}</span>
                              </div>
                              {isCorrectKey && (
                                <span className="text-[10px] font-mono font-bold text-emerald-400 shrink-0">
                                  ✓ Key
                                </span>
                              )}
                              {isStudentSelected && !isCorrectKey && (
                                <span className="text-[10px] font-mono font-bold text-rose-400 shrink-0">
                                  Your Choice
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Rationale */}
                    {ev.rationale && (
                      <div className="ml-8 p-3 rounded-xl bg-dark-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                        <strong className="text-neon-orange font-mono text-[11px] block">Explanation & Rationale:</strong>
                        <p className="leading-relaxed">{ev.rationale}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-center gap-4 pt-6 border-t border-slate-800">
            <button
              onClick={onBack}
              className="btn-royal text-xs px-8 py-3.5 shadow-neon flex items-center gap-2 font-bold"
            >
              <ArrowLeft className="w-4 h-4" /> Return to Student Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 2. No attempts remaining guard view
  if (!assignment?.can_attempt) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel text-center space-y-4 border border-rose-500/40 shadow-neon">
          <div className="w-14 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">No Attempts Remaining</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            You have already completed all {assignment?.max_attempts || 1} allowed attempt(s) for this assessment.
          </p>
          <button
            onClick={onBack}
            className="btn-royal text-xs px-6 py-3 w-full shadow-neon font-bold"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // 3. Full-Screen 1-by-1 Question Live Examination Experience
  return (
    <div className="fixed inset-0 z-50 bg-dark-950 text-slate-100 flex flex-col h-screen max-h-screen overflow-hidden select-none">
      
      {/* TOP EXAMINATION HEADER BAR */}
      <header className="h-16 px-4 sm:px-8 bg-dark-900 border-b border-slate-800 flex items-center justify-between gap-3 shrink-0 shadow-lg relative z-20">
        
        {/* Left: Exit & Title */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setShowExitModal(true)}
            className="p-2 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-400 hover:text-white border border-slate-700 transition shrink-0"
            title="Exit Assessment"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xs sm:text-sm font-bold text-white truncate max-w-xs sm:max-w-md">
                {assignment.title}
              </h2>
              <span className="hidden sm:inline-block px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neon-orange/15 text-neon-orange border border-neon-orange/30 uppercase">
                {assignment.subject || assignment.domain || 'Assessment'}
              </span>
            </div>
            <p className="text-[11px] font-mono text-slate-400 truncate">
              {assignment.unit_title} · 1-by-1 Focus Mode
            </p>
          </div>
        </div>

        {/* Center: Live Timer & Questions To Complete Pill */}
        <div className="flex items-center gap-3">
          {/* Prominent Questions to Complete Counter */}
          <div className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-xs font-bold border ${
            remainingCount > 0 
              ? 'bg-amber-950/50 border-amber-500/40 text-amber-300' 
              : 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
          }`}>
            {remainingCount > 0 ? (
              <>
                <Flame className="w-3.5 h-3.5 text-neon-amber animate-pulse" />
                <span><strong>{remainingCount}</strong> to Complete</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>All {questions.length} Completed!</span>
              </>
            )}
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-xs sm:text-sm font-black border transition-all ${
            isTimeCritical 
              ? 'bg-rose-950/90 border-rose-500 text-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.5)] animate-pulse'
              : (isTimeWarning 
                ? 'bg-amber-950/80 border-amber-500 text-amber-300 shadow-sm'
                : 'bg-dark-950 border-neon-orange/40 text-neon-glow shadow-neon-sm')
          }`}>
            <Clock className={`w-4 h-4 ${isTimeCritical ? 'text-rose-400' : 'text-neon-orange'}`} />
            <span>{formatTime(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Palette Toggle, Fullscreen & Submit Button */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowPalette(!showPalette)}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono font-semibold flex items-center gap-1.5 border transition ${
              showPalette 
                ? 'bg-neon-orange text-white border-neon-orange shadow-neon-sm' 
                : 'bg-dark-850 hover:bg-dark-800 text-slate-300 border-slate-700'
            }`}
            title="Question Navigator Grid"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Questions</span>
            <span className="font-bold">({answeredCount}/{questions.length})</span>
          </button>

          <button
            type="button"
            onClick={toggleBrowserFullscreen}
            className="p-2 rounded-xl bg-dark-850 hover:bg-dark-800 text-slate-300 hover:text-white border border-slate-700 transition"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen (F11)"}
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4 text-neon-orange" /> : <Maximize2 className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-bold shadow-neon-sm flex items-center gap-1.5 transition active:scale-95"
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Finish & Submit</span>
            <span className="sm:hidden">Submit</span>
          </button>
        </div>
      </header>

      {/* OVERALL PROGRESS BAR */}
      <div className="h-1 bg-dark-900 w-full overflow-hidden shrink-0">
        <div 
          className="h-full bg-gradient-to-r from-neon-orange via-neon-amber to-emerald-400 transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* MAIN BODY: 1-BY-1 QUESTION VIEW + COLLAPSIBLE QUESTION PALETTE */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* CENTER QUESTION CARD CONTAINER */}
        <main className="flex-1 overflow-y-auto px-4 py-4 sm:px-8 sm:py-6 flex flex-col justify-between max-w-4xl mx-auto w-full">
          
          {currentQuestion ? (
            <div className="w-full space-y-4 sm:space-y-5 my-auto animate-in fade-in duration-150">
              
              {/* Question Header Meta */}
              <div className="flex items-center justify-between gap-3 border-b border-slate-800/90 pb-3">
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 rounded-xl bg-neon-orange text-white font-mono font-black text-xs sm:text-sm shadow-neon-sm">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  {answers[currentQuestion.id] ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-950/90 text-emerald-400 border border-emerald-500/50 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Answered [{answers[currentQuestion.id]}]
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-dark-900 text-amber-300 border border-amber-500/30">
                      Pending Answer
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {currentQuestion.objective_title && (
                    <span className="hidden sm:inline-block text-[11px] font-mono text-neon-amber px-2.5 py-1 rounded-lg bg-dark-900 border border-slate-800 truncate max-w-xs">
                      {currentQuestion.objective_title}
                    </span>
                  )}
                  {currentQuestion.bloom_level && (
                    <Badge variant="bloom">{currentQuestion.bloom_level}</Badge>
                  )}
                </div>
              </div>

              {/* Question Stem Text */}
              <div className="p-5 sm:p-6 rounded-2xl bg-dark-900/90 border border-slate-800 shadow-xl space-y-2">
                <h3 className="text-sm sm:text-base font-bold text-white leading-relaxed font-sans">
                  {currentQuestion.question}
                </h3>
              </div>

              {/* Options Grid (A, B, C, D) */}
              <div className="space-y-2.5">
                {Object.entries(currentQuestion.options || {}).map(([optKey, optVal]) => {
                  const isSelected = answers[currentQuestion.id] === optKey;
                  return (
                    <button
                      key={optKey}
                      type="button"
                      onClick={() => handleSelectOption(currentQuestion.id, optKey)}
                      className={`w-full p-3.5 sm:p-4 rounded-xl text-left text-xs sm:text-sm flex items-center justify-between transition-all duration-150 border cursor-pointer active:scale-[0.995] ${
                        isSelected 
                          ? 'bg-neon-orange/20 border-neon-orange text-white shadow-neon-sm font-semibold ring-1 ring-neon-orange/60' 
                          : 'bg-dark-900/80 hover:bg-dark-850 text-slate-200 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3.5">
                        <span className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center transition-all shrink-0 ${
                          isSelected 
                            ? 'bg-neon-orange text-white shadow-md' 
                            : 'bg-dark-800 text-slate-400 border border-slate-700'
                        }`}>
                          {optKey}
                        </span>
                        <span className="leading-relaxed">{optVal}</span>
                      </div>

                      {isSelected && (
                        <CheckCircle2 className="w-5 h-5 text-neon-orange shrink-0 animate-in zoom-in-75" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Keyboard Helper & Clear Selection */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5">
                <span className="text-[11px] font-mono hidden sm:inline">
                  Keyboard: <kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">A</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">B</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">C</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">D</kbd> or <kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">←</kbd>/<kbd className="px-1.5 py-0.5 rounded bg-dark-900 border border-slate-800 text-slate-300">→</kbd>
                </span>

                {answers[currentQuestion.id] && (
                  <button
                    type="button"
                    onClick={handleClearCurrentSelection}
                    className="text-[11px] text-slate-400 hover:text-rose-400 font-semibold flex items-center gap-1 transition"
                  >
                    <RotateCcw className="w-3 h-3" /> Clear Choice
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="text-center py-20 text-slate-400 text-xs">
              No questions found for this assessment.
            </div>
          )}
        </main>

        {/* SIDEBAR QUESTION PALETTE (COLLAPSIBLE) */}
        {showPalette && (
          <aside className="w-80 bg-dark-900/95 border-l border-slate-800 p-5 flex flex-col justify-between shrink-0 overflow-y-auto animate-in slide-in-from-right duration-200 z-30">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-xs font-bold text-white flex items-center gap-2">
                    <LayoutGrid className="w-4 h-4 text-neon-orange" /> Question Palette
                  </h3>
                  <p className="text-[11px] text-slate-400 font-mono">
                    <strong className="text-emerald-400">{answeredCount}</strong> answered · <strong className="text-amber-400">{remainingCount}</strong> to complete
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPalette(false)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-dark-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Palette Grid */}
              <div className="grid grid-cols-5 gap-2 max-h-[60vh] overflow-y-auto pr-1">
                {questions.map((q, idx) => {
                  const isCurrent = idx === currentIndex;
                  const isAnswered = !!answers[q.id];

                  return (
                    <button
                      key={q.id || idx}
                      type="button"
                      onClick={() => {
                        setCurrentIndex(idx);
                        if (window.innerWidth < 768) setShowPalette(false);
                      }}
                      className={`h-11 rounded-xl font-mono text-xs font-bold flex flex-col items-center justify-center transition-all ${
                        isCurrent 
                          ? 'bg-neon-orange text-white ring-2 ring-white shadow-neon-sm scale-105' 
                          : isAnswered 
                            ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-900' 
                            : 'bg-dark-950 text-slate-400 border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <span>{idx + 1}</span>
                      {isAnswered && (
                        <span className="text-[9px] font-black leading-none uppercase text-emerald-400">
                          {answers[q.id]}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="space-y-1.5 pt-3 border-t border-slate-800 text-[11px] font-mono text-slate-400">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-neon-orange" />
                  <span>Current Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-emerald-600" />
                  <span>Answered Question</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded bg-dark-950 border border-slate-700" />
                  <span>Unanswered ({remainingCount})</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="w-full py-2.5 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-bold shadow-neon-sm flex items-center justify-center gap-2"
              >
                <Send className="w-3.5 h-3.5" /> Finish & Submit Assessment
              </button>
            </div>
          </aside>
        )}

      </div>

      {/* FIXED BOTTOM EXAMINATION BAR */}
      <footer className="h-16 px-4 sm:px-8 bg-dark-900 border-t border-slate-800 flex items-center justify-between shrink-0 z-20">
        <button
          type="button"
          onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          disabled={currentIndex === 0}
          className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl bg-dark-800 hover:bg-dark-750 text-slate-200 hover:text-white border border-slate-700 text-xs font-bold flex items-center gap-2 transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-4 h-4" /> <span className="hidden sm:inline">Previous Question</span>
        </button>

        {/* Center: Live Remaining Counter */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-white font-bold">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-slate-600">•</span>
          <span className={remainingCount > 0 ? "text-neon-amber font-bold" : "text-emerald-400 font-bold"}>
            {remainingCount > 0 ? `${remainingCount} to Complete` : 'All Answered ✓'}
          </span>
        </div>

        {currentIndex < questions.length - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex(prev => Math.min(questions.length - 1, prev + 1))}
            className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-neon-orange hover:bg-neon-amber text-white text-xs font-bold flex items-center gap-2 shadow-neon-sm transition"
          >
            <span className="hidden sm:inline">Next Question</span> <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-5 py-2 sm:px-6 sm:py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-2 shadow-neon-sm transition animate-pulse"
          >
            <span>Finish & Submit</span> <Send className="w-3.5 h-3.5" />
          </button>
        )}
      </footer>

      {/* CONFIRM SUBMIT MODAL */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl glass-panel-accent border border-neon-orange/40 shadow-neon space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-neon-orange/20 border border-neon-orange/40 flex items-center justify-center text-neon-orange">
              <CheckSquare className="w-6 h-6" />
            </div>
            
            <div>
              <h3 className="text-lg font-bold text-white">Submit Your Assessment?</h3>
              <p className="text-xs text-slate-300 mt-1">
                You have answered <strong className="text-emerald-400 font-mono">{answeredCount}</strong> of <strong className="font-mono text-white">{questions.length}</strong> questions ({remainingCount} remaining to complete).
              </p>
            </div>

            {remainingCount > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/60 border border-amber-500/40 text-xs text-amber-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  You still have {remainingCount} unanswered question(s). Unanswered questions will be scored as 0.
                </span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowSubmitModal(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs bg-dark-800 hover:bg-dark-750 text-slate-300 font-semibold"
              >
                Keep Answering
              </button>
              <button
                type="button"
                onClick={() => submitToServer(answers)}
                disabled={submitting}
                className="btn-royal text-xs py-2 px-5 flex items-center gap-1.5 shadow-neon font-bold"
              >
                {submitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Scoring...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Yes, Finish & Submit
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CONFIRM EXIT MODAL */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="max-w-md w-full p-6 sm:p-8 rounded-3xl glass-panel border border-rose-500/40 shadow-neon space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Leave Examination?</h3>
              <p className="text-xs text-slate-300 mt-1">
                Your progress is not saved until you submit. If you leave now, you will need to re-attempt this assessment.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowExitModal(false)}
                className="px-4 py-2 rounded-xl text-xs bg-dark-800 hover:bg-dark-750 text-slate-300 font-semibold"
              >
                Resume Exam
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowExitModal(false);
                  onBack();
                }}
                className="px-4 py-2 rounded-xl text-xs bg-rose-600 hover:bg-rose-500 text-white font-bold transition"
              >
                Exit to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentAssessmentPage;
