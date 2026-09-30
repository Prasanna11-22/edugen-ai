import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { 
  Target, CheckCircle2, Award, Clock, ArrowLeft, ArrowRight, Send, Sparkles, 
  AlertCircle, RefreshCw, AlertTriangle, CheckSquare, HelpCircle, Maximize2, 
  Minimize2, LayoutGrid, X, Check, ChevronLeft, ChevronRight, RotateCcw, ListOrdered, Flame,
  Camera, Video, VideoOff, Users, ShieldAlert, ShieldCheck, Eye, EyeOff,
  Smartphone, Laptop, AppWindow, UserX
} from 'lucide-react';
import Badge from '../components/Badge';
import MasteryBreakdown from '../components/MasteryBreakdown';

const StudentAssessmentPage = ({ assignment, onBack }) => {
  const { token } = useAuth();
  const { showToast } = useToast();
  
  const isNewAttempt = assignment?.isNewAttempt ?? assignment?.can_attempt;
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const [result, setResult] = useState(isNewAttempt ? null : (assignment?.latest_submission || null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showPalette, setShowPalette] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Live AI Video Proctoring State (YOLOv8 Multi-Object + Tab Switching)
  const MAX_PROCTOR_FLAGS = 50;
  const WEIGHT_PHONE = 4;              // Mobile = 4
  const WEIGHT_LAPTOP = 3;             // Laptop = 3
  const WEIGHT_MULTIPLE_PERSONS = 2;   // Person = 2
  const WEIGHT_TAB_SWITCH = 5;         // Tab Switch = 5
  const WEIGHT_NO_PERSON = 0;          // No person = 0 (Blinking warning only, no flag increase)

  const [proctorFlags, setProctorFlags] = useState(0);
  const [detectedPersons, setDetectedPersons] = useState(1);
  const [detectedPhones, setDetectedPhones] = useState(0);
  const [detectedLaptops, setDetectedLaptops] = useState(0);
  const [isNoPersonDetected, setIsNoPersonDetected] = useState(false);
  const [isVerifyingFrame, setIsVerifyingFrame] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const [proctorWarning, setProctorWarning] = useState(null);
  const [isDisqualified, setIsDisqualified] = useState(false);
  const [isPipCollapsed, setIsPipCollapsed] = useState(false);
  const [violationStats, setViolationStats] = useState({
    multiple_persons: 0,
    cell_phone: 0,
    laptop: 0,
    tab_switch: 0,
    no_person: 0
  });

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const proctorIntervalRef = useRef(null);
  const isVerifyingRef = useRef(false);
  const flagsRef = useRef(0);
  flagsRef.current = proctorFlags;

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

  // Cleanup helper to stop camera streams and interval
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (proctorIntervalRef.current) {
      clearInterval(proctorIntervalRef.current);
      proctorIntervalRef.current = null;
    }
    setCameraActive(false);
  };

  // Centralized Violation Register with Weighted Flags
  const registerViolation = (type, weight, reason) => {
    if (submittedRef.current || isDisqualified) return;

    const nextFlags = Math.min(MAX_PROCTOR_FLAGS, flagsRef.current + weight);
    flagsRef.current = nextFlags;
    setProctorFlags(nextFlags);

    setViolationStats(prev => ({
      ...prev,
      [type]: (prev[type] || 0) + 1
    }));

    setProctorWarning(`⚠️ ${reason} (+${weight} Flags · Total: ${nextFlags}/${MAX_PROCTOR_FLAGS})`);
    showToast(`⚠️ Proctor Violation: ${reason} (+${weight} flags! Current: ${nextFlags}/${MAX_PROCTOR_FLAGS})`, "warning", 3500);

    if (nextFlags >= MAX_PROCTOR_FLAGS) {
      handleDisqualification();
    }
  };

  // Disqualification handler when cumulative flags reach 50
  const handleDisqualification = async () => {
    setIsDisqualified(true);
    stopCameraStream();
    showToast(`🚫 Assessment Terminated: Flag limit exceeded (${MAX_PROCTOR_FLAGS}/${MAX_PROCTOR_FLAGS}). Attempt has been voided.`, "error", 8000);

    try {
      await fetch('/api/student/proctor/void-attempt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          assignment_id: assignment.assignment_id,
          reason: `Violations exceeded threshold (${MAX_PROCTOR_FLAGS} flags).`
        })
      });
    } catch (err) {
      console.error("Failed to void attempt on server:", err);
    }
  };

  // Tab Switching & Window Blur Detection
  useEffect(() => {
    if (!assignment?.can_attempt || submitted || result || isDisqualified) return;

    let blurTimer = null;
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        registerViolation('tab_switch', WEIGHT_TAB_SWITCH, 'Tab Switch / Window Minimized Detected');
      }
    };

    const handleWindowBlur = () => {
      blurTimer = setTimeout(() => {
        if (!submittedRef.current && !document.hasFocus()) {
          registerViolation('tab_switch', WEIGHT_TAB_SWITCH, 'Window Focus Lost / App Switch');
        }
      }, 500);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      clearTimeout(blurTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [assignment?.can_attempt, submitted, result, isDisqualified]);

  // Initialize Webcam Stream for Live Proctoring
  useEffect(() => {
    if (!assignment?.can_attempt || submitted || result || isDisqualified) {
      stopCameraStream();
      return;
    }

    let isMounted = true;
    navigator.mediaDevices?.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
      audio: false
    })
      .then((stream) => {
        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
        setCameraActive(true);
        setCameraError(null);
      })
      .catch((err) => {
        console.warn("Webcam access error:", err);
        setCameraActive(false);
        setCameraError("Camera permission denied. Live proctoring requires webcam access.");
      });

    return () => {
      isMounted = false;
      stopCameraStream();
    };
  }, [assignment?.can_attempt, submitted, result, isDisqualified]);

  // High-Speed Frame Capture & YOLOv8 Verification Loop (every 1100ms)
  useEffect(() => {
    if (!cameraActive || submitted || result || isDisqualified) {
      if (proctorIntervalRef.current) clearInterval(proctorIntervalRef.current);
      return;
    }

    const captureAndVerify = async () => {
      if (!videoRef.current || !canvasRef.current || isVerifyingRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState < 2) return;

      try {
        isVerifyingRef.current = true;
        setIsVerifyingFrame(true);

        const ctx = canvas.getContext('2d');
        // Scaled to 384x288 with JPEG 0.65 for crisp edge details and sub-25ms YOLO inference
        canvas.width = 384;
        canvas.height = 288;
        ctx.drawImage(video, 0, 0, 384, 288);
        const imageB64 = canvas.toDataURL('image/jpeg', 0.65);

        const res = await fetch('/api/student/proctor/verify-frame', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            image_b64: imageB64,
            assignment_id: assignment.assignment_id
          })
        });

        if (res.ok) {
          const data = await res.json();
          setDetectedPersons(data.person_count ?? 1);
          setDetectedPhones(data.phone_count ?? 0);
          setDetectedLaptops(data.laptop_count ?? 0);

          let hasViolation = false;

          // 1. Mobile Phone detection (Weight: 4)
          if (data.is_phone_detected) {
            hasViolation = true;
            registerViolation('cell_phone', WEIGHT_PHONE, 'Unauthorized Mobile Phone Detected');
          }

          // 2. Unauthorized Laptop / Secondary Display detection (Weight: 3)
          if (data.is_laptop_detected) {
            hasViolation = true;
            registerViolation('laptop', WEIGHT_LAPTOP, 'Unauthorized Laptop / Display Detected');
          }

          // 3. Multiple persons detection (Weight: 2)
          if (data.is_multiple_persons) {
            hasViolation = true;
            registerViolation('multiple_persons', WEIGHT_MULTIPLE_PERSONS, `Multiple Persons Detected (${data.person_count} persons)`);
          }

          // 4. No person in screen: Blinking warning only, NO flag increase!
          if (data.is_no_person || (data.person_count === 0)) {
            setIsNoPersonDetected(true);
          } else {
            setIsNoPersonDetected(false);
          }

          if (!hasViolation && !data.is_no_person) {
            // Clear transient warnings if no violation present
            setProctorWarning(null);
          }
        }
      } catch (err) {
        console.warn("Proctor frame verification error:", err);
      } finally {
        isVerifyingRef.current = false;
        setIsVerifyingFrame(false);
      }
    };

    // Ultra-fast 750ms verification rate for immediate responsive detection
    proctorIntervalRef.current = setInterval(captureAndVerify, 750);

    return () => {
      if (proctorIntervalRef.current) clearInterval(proctorIntervalRef.current);
    };
  }, [cameraActive, submitted, result, isDisqualified, token]);

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
      stopCameraStream();
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

  // Disqualified / Proctoring Violation Guard View
  if (isDisqualified) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full p-8 rounded-3xl glass-panel text-center space-y-5 border border-rose-500/50 shadow-neon animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center mx-auto text-rose-400">
            <ShieldAlert className="w-10 h-10 animate-pulse" />
          </div>
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 mb-2">
              Attempt Voided · Not Considered
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white">Assessment Terminated</h2>
            <p className="text-xs text-slate-300 mt-2 leading-relaxed">
              Proctoring violations exceeded the maximum permitted threshold (<strong>{proctorFlags}/{MAX_PROCTOR_FLAGS} flags</strong>). In accordance with academic integrity rules, this attempt has been voided.
            </p>
          </div>

          {/* Itemized Violation Audit Breakdown */}
          <div className="p-4 rounded-2xl bg-dark-900 border border-slate-800 text-left space-y-2.5 text-xs">
            <h4 className="font-bold text-white text-xs border-b border-slate-800 pb-1.5 flex items-center justify-between">
              <span>Proctoring Audit Log (YOLOv8 Engine)</span>
              <span className="font-mono text-rose-400">{proctorFlags} / {MAX_PROCTOR_FLAGS} Flags</span>
            </h4>

            <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
              <div className="p-2 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Users className="w-3.5 h-3.5 text-neon-orange" /> Multi-Person:
                </span>
                <span className="font-bold text-white">{violationStats.multiple_persons} (×{WEIGHT_MULTIPLE_PERSONS})</span>
              </div>

              <div className="p-2 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Smartphone className="w-3.5 h-3.5 text-rose-400" /> Mobile Phone:
                </span>
                <span className="font-bold text-white">{violationStats.cell_phone} (×{WEIGHT_PHONE})</span>
              </div>

              <div className="p-2 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <Laptop className="w-3.5 h-3.5 text-amber-400" /> Ext. Laptop:
                </span>
                <span className="font-bold text-white">{violationStats.laptop} (×{WEIGHT_LAPTOP})</span>
              </div>

              <div className="p-2 rounded-xl bg-dark-950 border border-slate-800 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <AppWindow className="w-3.5 h-3.5 text-sky-400" /> Tab Switch:
                </span>
                <span className="font-bold text-white">{violationStats.tab_switch} (×{WEIGHT_TAB_SWITCH})</span>
              </div>
            </div>

            <div className="flex items-center justify-between text-slate-400 pt-2 border-t border-slate-800/80">
              <span>Attempt Status:</span>
              <span className="font-mono text-emerald-400 font-bold">Restored for Clean Reattempt</span>
            </div>
            <p className="text-[11px] text-slate-500">
              No score was recorded. Please ensure a private, distraction-free environment without secondary devices or tab changes before attempting again.
            </p>
          </div>

          <button
            onClick={() => {
              stopCameraStream();
              if (document.fullscreenElement) {
                document.exitFullscreen?.().catch(() => {});
              }
              onBack();
            }}
            className="btn-royal text-xs px-6 py-3.5 w-full shadow-neon font-bold flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Return to Dashboard & Reattempt
          </button>
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

  // Guard if no questions in assessment
  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-50 bg-dark-950 text-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full p-8 rounded-3xl glass-panel text-center space-y-4 border border-amber-500/40 shadow-neon">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-white">No Questions Available</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            This assessment currently has no active questions assigned. Please check back later or notify your instructor.
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

      {/* PROCTORING ALERT BANNER IF VIOLATION DETECTED */}
      {proctorWarning && (
        <div className="mx-4 sm:mx-8 mt-3 p-3.5 rounded-2xl bg-rose-950/90 border-2 border-rose-500 shadow-neon flex items-center justify-between gap-3 text-xs text-rose-200 animate-pulse z-30 shrink-0">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 animate-bounce" />
            <div>
              <strong className="text-white font-bold flex items-center gap-1.5">
                AI Live Proctoring Violation Warning
              </strong>
              <p className="text-[11px] text-rose-300">
                {proctorWarning}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-xl bg-rose-600 text-white font-mono font-black text-xs shadow">
              Flags {proctorFlags}/{MAX_PROCTOR_FLAGS}
            </span>
          </div>
        </div>
      )}

      {/* BLINKING WARNING: NO PERSON IN SCREEN (NO FLAG INCREMENT) */}
      {isNoPersonDetected && !proctorWarning && (
        <div className="mx-4 sm:mx-8 mt-3 p-3.5 rounded-2xl bg-amber-950/90 border-2 border-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.5)] flex items-center justify-between gap-3 text-xs text-amber-200 animate-pulse z-30 shrink-0">
          <div className="flex items-center gap-3">
            <UserX className="w-5 h-5 text-amber-400 shrink-0 animate-bounce" />
            <div>
              <strong className="text-white font-bold flex items-center gap-1.5 text-xs sm:text-sm">
                ⚠️ Camera Alert: No Person Detected in Screen!
              </strong>
              <p className="text-[11px] text-amber-300">
                Please position yourself directly in front of the webcam. (No penalty flags added).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1 rounded-xl bg-amber-500 text-black font-mono font-black text-xs shadow animate-pulse">
              0 FLAGS ADDED
            </span>
          </div>
        </div>
      )}

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

      {/* FLOATING LIVE AI PROCTOR PIP WIDGET (YOLOv8 MULTI-OBJECT) */}
      <aside 
        aria-label="Live Video Proctoring Feed"
        className={`fixed bottom-20 right-4 sm:right-8 z-40 rounded-2xl overflow-hidden shadow-2xl border transition-all duration-300 ${
          proctorFlags >= 40 
            ? 'border-rose-500 bg-rose-950/95 shadow-[0_0_30px_rgba(244,63,94,0.5)] ring-2 ring-rose-500/50' 
            : (isNoPersonDetected 
              ? 'border-amber-400 bg-amber-950/90 shadow-[0_0_25px_rgba(245,158,11,0.6)] animate-pulse'
              : (proctorFlags >= 20 
                ? 'border-amber-500/80 bg-amber-950/90 shadow-[0_0_20px_rgba(245,158,11,0.3)]' 
                : 'border-slate-700/80 bg-dark-900/95 shadow-xl'))
        } backdrop-blur-md`}
      >
        {/* PIP Header */}
        <div className="px-3 py-1.5 bg-dark-950/90 border-b border-slate-800 flex items-center justify-between gap-2.5 text-[11px] font-mono">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            <span className="font-bold text-white flex items-center gap-1">
              <Camera className="w-3 h-3 text-neon-orange" /> YOLOv8 Proctor
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Flags Counter & Color Indicator */}
            <span className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold ${
              proctorFlags >= 40 
                ? 'bg-rose-500 text-white animate-pulse' 
                : (proctorFlags >= 20 
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                  : 'bg-dark-800 text-slate-300 border border-slate-700')
            }`}>
              Flags: {proctorFlags}/{MAX_PROCTOR_FLAGS}
            </span>

            <button
              type="button"
              onClick={() => setIsPipCollapsed(prev => !prev)}
              className="text-slate-400 hover:text-white p-0.5 rounded hover:bg-dark-800 transition"
              title={isPipCollapsed ? "Expand Camera" : "Minimize Camera"}
            >
              {isPipCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minimize2 className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Linear Danger Gauge Bar */}
        <div className="h-1 bg-dark-950 w-full overflow-hidden">
          <div 
            className={`h-full transition-all duration-300 ${
              proctorFlags >= 40 ? 'bg-rose-500' : (proctorFlags >= 20 ? 'bg-amber-400' : 'bg-emerald-400')
            }`}
            style={{ width: `${Math.min(100, (proctorFlags / MAX_PROCTOR_FLAGS) * 100)}%` }}
          />
        </div>

        {/* Video Canvas & Feed */}
        {!isPipCollapsed && (
          <div className="relative w-48 sm:w-56 h-36 sm:h-40 bg-black flex items-center justify-center overflow-hidden">
            {/* Hidden canvas for YOLOv8 frame captures */}
            <canvas ref={canvasRef} className="hidden" />

            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover transform -scale-x-100"
            />

            {cameraError && (
              <div className="absolute inset-0 bg-dark-950/95 p-3 flex flex-col items-center justify-center text-center text-[10px] text-rose-300">
                <AlertCircle className="w-5 h-5 text-rose-400 mb-1" />
                <span>{cameraError}</span>
              </div>
            )}

            {/* Blinking Overlay when No Person is in Screen */}
            {isNoPersonDetected && !cameraError && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center text-center p-2 z-10 animate-pulse">
                <UserX className="w-8 h-8 text-amber-400 mb-1 animate-bounce" />
                <span className="px-2 py-0.5 rounded-full bg-amber-500/30 border border-amber-400 text-amber-200 font-mono font-black text-[10px] uppercase tracking-wider animate-pulse">
                  No Person Detected
                </span>
                <span className="text-[9px] text-amber-300 mt-1 font-medium">
                  Please face the webcam
                </span>
              </div>
            )}

            {/* Top Multi-Object Live Badges Overlay */}
            <div className="absolute top-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 pointer-events-none z-20">
              <div className="flex items-center gap-1 flex-wrap">
                {detectedPhones > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-rose-600/90 text-white font-mono font-black text-[9px] flex items-center gap-0.5 shadow animate-pulse">
                    <Smartphone className="w-2.5 h-2.5" /> Phone!
                  </span>
                )}
                {detectedLaptops > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-600/90 text-white font-mono font-black text-[9px] flex items-center gap-0.5 shadow animate-pulse">
                    <Laptop className="w-2.5 h-2.5" /> Ext. Laptop!
                  </span>
                )}
                {violationStats.tab_switch > 0 && (
                  <span className="px-1.5 py-0.5 rounded bg-sky-900/90 text-sky-200 border border-sky-400/50 font-mono font-bold text-[9px] flex items-center gap-0.5 shadow">
                    <AppWindow className="w-2.5 h-2.5" /> Tabs: {violationStats.tab_switch}
                  </span>
                )}
              </div>

              {isVerifyingFrame && (
                <span className="w-2 h-2 rounded-full bg-neon-orange animate-ping shrink-0" title="YOLOv8 frame verification active" />
              )}
            </div>

            {/* Bottom Status Overlay */}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none z-20">
              {detectedPersons > 1 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 backdrop-blur-md shadow bg-rose-600 text-white animate-bounce">
                  <Users className="w-3 h-3" />
                  <span>{detectedPersons} Persons</span>
                </span>
              ) : isNoPersonDetected ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 backdrop-blur-md shadow bg-amber-500/20 text-amber-300 border border-amber-400 animate-pulse">
                  <UserX className="w-3 h-3 text-amber-400" />
                  <span>0 Persons (Face Camera)</span>
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold flex items-center gap-1 backdrop-blur-md shadow bg-dark-950/80 text-emerald-300 border border-emerald-500/40">
                  <Users className="w-3 h-3" />
                  <span>1 Person</span>
                </span>
              )}

              <span className="text-[9px] font-mono text-slate-400 bg-dark-950/80 px-1.5 py-0.5 rounded border border-slate-800">
                Limit: {MAX_PROCTOR_FLAGS}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Violation Notice Banner inside PIP */}
        {proctorWarning && !isPipCollapsed && (
          <div className="p-1.5 bg-rose-950/95 border-t border-rose-500/50 text-[10px] text-rose-200 font-semibold text-center leading-tight">
            {proctorWarning}
          </div>
        )}

        {/* Blinking Notice Banner inside PIP when No Person is in Screen (0 flags added) */}
        {isNoPersonDetected && !proctorWarning && !isPipCollapsed && (
          <div className="p-1.5 bg-amber-950/95 border-t border-amber-500/50 text-[10px] text-amber-200 font-semibold text-center leading-tight animate-pulse flex items-center justify-center gap-1.5">
            <UserX className="w-3 h-3 text-amber-400 shrink-0" />
            <span>⚠️ No person in screen · Please face camera (0 flags)</span>
          </div>
        )}
      </aside>

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
                  stopCameraStream();
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
