"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getOfflineQuestions, Question } from "@/lib/offlineDb";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveQuestionsOffline } from "@/lib/offlineDb";
import { MOCK_QUESTIONS } from "@/lib/mockData";
import { 
  BookOpen, Sparkles, AlertCircle, CheckCircle2, XCircle, 
  Lock, RefreshCw, LogOut, Award, ChevronRight, Menu, X, WifiOff, Wifi,
  Loader2
} from "lucide-react";

export default function PracticePage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, logout, isOnline, updateProfile } = useAuth();
  
  // Navigation states
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Filters
  const [availableGrades, setAvailableGrades] = useState<number[]>([]);
  const [selectedGrade, setSelectedGrade] = useState<number | null>(null);
  
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);

  const [availableUnits, setAvailableUnits] = useState<number[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<number | null>(null);

  // Quiz state
  const [filteredQuestions, setFilteredQuestions] = useState<Question[]>([]);
  const [answeredState, setAnsweredState] = useState<{ [qId: string]: number }>({}); // qId -> selectedIndex
  
  // Paywall states
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [lockedUnitAttempted, setLockedUnitAttempted] = useState<number | null>(null);

  // Auth & Grade check
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (profile && profile.role === "student" && !(profile as any).gradeCategory) {
        router.push("/");
      }
    }
  }, [user, profile, authLoading, router]);

  // Load questions from Offline DB
  const loadCachedQuestions = async () => {
    if (!profile) return;
    setLoadingQuestions(true);
    try {
      const category = (profile as any).gradeCategory;
      const cached = await getOfflineQuestions(category);
      setQuestions(cached);
      
      // Parse available grades
      const grades = Array.from(new Set(cached.map((q) => q.specificGrade))).sort((a, b) => a - b);
      setAvailableGrades(grades);
      
      // Default to first grade if available
      if (grades.length > 0 && !selectedGrade) {
        setSelectedGrade(grades[0]);
      }
    } catch (err) {
      console.error("Failed to load cached questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (profile) {
      loadCachedQuestions();
    }
  }, [profile]);

  // Build subject list when grade changes
  useEffect(() => {
    if (selectedGrade !== null) {
      const subjects = Array.from(
        new Set(
          questions
            .filter((q) => q.specificGrade === selectedGrade)
            .map((q) => q.subject)
        )
      ).sort();
      setAvailableSubjects(subjects);
      
      if (subjects.length > 0) {
        setSelectedSubject(subjects[0]);
      } else {
        setSelectedSubject(null);
        setSelectedUnit(null);
      }
    }
  }, [selectedGrade, questions]);

  // Build units list when subject changes
  useEffect(() => {
    if (selectedGrade !== null && selectedSubject !== null) {
      const units = Array.from(
        new Set(
          questions
            .filter((q) => q.specificGrade === selectedGrade && q.subject === selectedSubject)
            .map((q) => q.unit)
        )
      ).sort((a, b) => a - b);
      setAvailableUnits(units);
      
      if (units.length > 0) {
        setSelectedUnit(units[0]);
      } else {
        setSelectedUnit(null);
      }
    }
  }, [selectedGrade, selectedSubject, questions]);

  // Build quiz questions when unit changes
  useEffect(() => {
    if (selectedGrade !== null && selectedSubject !== null && selectedUnit !== null) {
      // Check Paywall
      const isLocked = selectedUnit > 1 && !profile?.isPaid;
      
      if (isLocked) {
        setLockedUnitAttempted(selectedUnit);
        setShowPaywallModal(true);
        // Reset selected unit to unit 1 to prevent seeing locked questions in background
        const firstUnit = availableUnits.length > 0 ? availableUnits[0] : null;
        setSelectedUnit(firstUnit);
      } else {
        const unitQuestions = questions.filter(
          (q) =>
            q.specificGrade === selectedGrade &&
            q.subject === selectedSubject &&
            q.unit === selectedUnit
        );
        setFilteredQuestions(unitQuestions);
        // Keep previous answers or clear? Let's keep them so they don't lose progress, or clear if moving units.
        // Let's clear choices for these questions when entering
      }
    } else {
      setFilteredQuestions([]);
    }
  }, [selectedGrade, selectedSubject, selectedUnit, questions, profile]);

  // Trigger sync manually
  const handleForceSync = async () => {
    if (!profile) return;
    setSyncing(true);
    setSyncError("");
    try {
      const category = (profile as any).gradeCategory;
      
      if (user && user.uid.startsWith("mock-")) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        const mockList = MOCK_QUESTIONS.filter((q) => q.gradeCategory === category);
        await saveQuestionsOffline(mockList);
        setQuestions(mockList);
        setAnsweredState({});
        await loadCachedQuestions();
        setSyncing(false);
        return;
      }
      
      if (!isOnline) {
        setSyncError("You are offline. Syncing from cloud requires internet connection.");
        setSyncing(false);
        return;
      }
      
      const q = query(
        collection(db, "questions"),
        where("gradeCategory", "==", category)
      );
      const querySnapshot = await getDocs(q);
      const list: Question[] = [];
      querySnapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Question);
      });
      await saveQuestionsOffline(list);
      
      // Also fetch profile update (just in case they made a payment that got approved)
      await updateProfile({}); 
      
      setQuestions(list);
      await loadCachedQuestions();
    } catch (err: any) {
      console.error(err);
      setSyncError("Sync failed: " + (err.message || "Network error."));
    } finally {
      setSyncing(false);
    }
  };

  const handleSelectChoice = (questionId: string, choiceIndex: number) => {
    // Only allow selecting once
    if (answeredState[questionId] !== undefined) return;
    
    setAnsweredState({
      ...answeredState,
      [questionId]: choiceIndex,
    });
  };

  const scoreCount = () => {
    let correct = 0;
    filteredQuestions.forEach((q) => {
      if (answeredState[q.id] === q.correctAnswer) {
        correct++;
      }
    });
    return correct;
  };

  const answeredCount = () => {
    let answered = 0;
    filteredQuestions.forEach((q) => {
      if (answeredState[q.id] !== undefined) {
        answered++;
      }
    });
    return answered;
  };

  if (authLoading || !profile) {
    return (
      <div className="practice-loading">
        <Loader2 className="spinner" />
        <p>Loading Quiz Engine...</p>
        <style jsx>{`
          .practice-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            color: var(--text-muted);
          }
          .spinner {
            animation: spin 1s linear infinite;
            color: var(--primary);
          }
          @keyframes spin { 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="practice-container">
      {/* Top Banner Status Bar */}
      <div className="status-bar">
        <div className="status-indicator">
          {isOnline ? (
            <div className="status-online">
              <Wifi size={14} />
              <span>Online - Synced</span>
            </div>
          ) : (
            <div className="status-offline">
              <WifiOff size={14} />
              <span>Offline Mode (Device Storage)</span>
            </div>
          )}
        </div>
        <div className="status-actions">
          {isOnline && (
            <button onClick={handleForceSync} className="sync-btn" disabled={syncing}>
              <RefreshCw size={14} className={syncing ? "spinner" : ""} />
              {syncing ? "Syncing..." : "Sync Database"}
            </button>
          )}
          <span className="user-email">{profile.displayName || profile.email}</span>
          <button onClick={logout} className="logout-icon-btn" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>

      <div className="practice-layout">
        {/* Mobile menu trigger */}
        <button className="mobile-menu-trigger" onClick={() => setSidebarOpen(true)}>
          <Menu size={24} /> Navigation
        </button>

        {/* Sidebar Navigation */}
        <aside className={`sidebar glass-panel ${sidebarOpen ? "open" : ""}`}>
          <div className="sidebar-header">
            <div className="brand">
              <BookOpen className="brand-logo" />
              <span>Exam Store</span>
            </div>
            <button className="close-sidebar-btn" onClick={() => setSidebarOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <div className="sidebar-content">
            {/* Grade Category Indicator */}
            <div className="category-indicator">
              <span>Selected Category</span>
              <strong>{(profile as any).gradeCategory === "grade_8" ? "Grade 8 Prep (7-8)" : "Grade 12 Prep (9-12)"}</strong>
              <button className="change-category-btn" onClick={() => router.push("/")}>
                Change Category
              </button>
            </div>

            {/* Grades Switcher */}
            <div className="nav-group">
              <span className="group-label">Select Grade</span>
              <div className="grade-selector-nav">
                {availableGrades.map((grade) => (
                  <button
                    key={grade}
                    className={`grade-nav-btn ${selectedGrade === grade ? "active" : ""}`}
                    onClick={() => {
                      setSelectedGrade(grade);
                      setSidebarOpen(false);
                    }}
                  >
                    Grade {grade}
                  </button>
                ))}
              </div>
            </div>

            {/* Subjects List */}
            {selectedGrade && (
              <div className="nav-group">
                <span className="group-label">Subjects</span>
                <div className="list-nav">
                  {availableSubjects.map((sub) => (
                    <button
                      key={sub}
                      className={`list-nav-item ${selectedSubject === sub ? "active" : ""}`}
                      onClick={() => {
                        setSelectedSubject(sub);
                        setSidebarOpen(false);
                      }}
                    >
                      <ChevronRight size={14} className="chevron" />
                      <span>{sub}</span>
                    </button>
                  ))}
                  {availableSubjects.length === 0 && (
                    <p className="empty-nav-msg">No subjects cached. Tap Sync Database.</p>
                  )}
                </div>
              </div>
            )}

            {/* Units list */}
            {selectedGrade && selectedSubject && (
              <div className="nav-group">
                <span className="group-label">Chapters / Units</span>
                <div className="unit-grid-nav">
                  {availableUnits.map((unit) => {
                    const isLocked = unit > 1 && !profile.isPaid;
                    return (
                      <button
                        key={unit}
                        className={`unit-nav-btn ${selectedUnit === unit ? "active" : ""} ${isLocked ? "locked" : ""}`}
                        onClick={() => {
                          if (isLocked) {
                            setLockedUnitAttempted(unit);
                            setShowPaywallModal(true);
                          } else {
                            setSelectedUnit(unit);
                            setSidebarOpen(false);
                          }
                        }}
                      >
                        <span>Unit {unit}</span>
                        {isLocked && <Lock size={12} className="lock-icon" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* Backdrop for mobile sidebar */}
        {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

        {/* Main Quiz Area */}
        <main className="quiz-main">
          {/* Unit header */}
          {selectedGrade && selectedSubject && selectedUnit ? (
            <div className="quiz-header glass-panel">
              <div className="quiz-title-info">
                <span className="quiz-path">
                  Grade {selectedGrade} / {selectedSubject}
                </span>
                <h2>Unit {selectedUnit}: {filteredQuestions[0]?.chapterTitle || "Practice Questions"}</h2>
              </div>
              
              {/* Progress and Score */}
              <div className="score-summary">
                <div className="score-stat">
                  <span>Completed</span>
                  <strong>{answeredCount()} / {filteredQuestions.length}</strong>
                </div>
                <div className="score-stat">
                  <span>Score</span>
                  <strong className="correct-score">{scoreCount()} Correct</strong>
                </div>
              </div>
            </div>
          ) : (
            <div className="quiz-empty glass-panel animate-scale-in">
              <AlertCircle size={48} className="empty-icon" />
              <h3>No Questions Loaded</h3>
              <p>Select a grade, subject, and unit from the menu to start studying. If you see no questions, click "Sync Database" to fetch materials.</p>
              {syncError && <div className="error-alert">{syncError}</div>}
            </div>
          )}

          {/* Questions list */}
          <div className="questions-feed">
            {filteredQuestions.map((q, qIndex) => {
              const selectedIdx = answeredState[q.id];
              const isAnswered = selectedIdx !== undefined;
              const isCorrect = selectedIdx === q.correctAnswer;
              
              return (
                <div key={q.id} className={`question-card glass-panel animate-scale-in ${isAnswered ? (isCorrect ? "answered-correct" : "answered-incorrect") : ""}`} style={{ animationDelay: `${qIndex * 0.05}s` }}>
                  <div className="question-number">
                    <span>QUESTION {qIndex + 1}</span>
                  </div>
                  
                  <p className="question-text">{q.question}</p>
                  
                  <div className="choices-list">
                    {q.choices.map((choice, cIndex) => {
                      const isSelected = selectedIdx === cIndex;
                      const isCorrectChoice = q.correctAnswer === cIndex;
                      
                      let choiceClass = "choice-option";
                      if (isAnswered) {
                        if (isCorrectChoice) {
                          choiceClass += " correct";
                        } else if (isSelected) {
                          choiceClass += " incorrect";
                        } else {
                          choiceClass += " disabled";
                        }
                      } else if (isSelected) {
                        choiceClass += " selected";
                      }
                      
                      return (
                        <button
                          key={cIndex}
                          className={choiceClass}
                          onClick={() => handleSelectChoice(q.id, cIndex)}
                          disabled={isAnswered}
                        >
                          <span className="choice-letter">
                            {String.fromCharCode(65 + cIndex)}
                          </span>
                          <span className="choice-text">{choice}</span>
                          
                          {isAnswered && isCorrectChoice && (
                            <CheckCircle2 className="choice-status-icon success-icon" size={18} />
                          )}
                          {isAnswered && isSelected && !isCorrectChoice && (
                            <XCircle className="choice-status-icon danger-icon" size={18} />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation card */}
                  {isAnswered && (
                    <div className="explanation-box animate-scale-in">
                      <div className="explanation-header">
                        <Award size={16} />
                        <h4>{isCorrect ? "Correct!" : "Incorrect"} - Explanation</h4>
                      </div>
                      <p>{q.explanation}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>
      </div>

      {/* Paywall Overlay Modal */}
      {showPaywallModal && (
        <div className="modal-overlay">
          <div className="paywall-modal glass-panel animate-scale-in">
            <div className="paywall-icon-container">
              <Lock size={32} className="modal-lock" />
            </div>
            
            <h2>Unlock All Questions</h2>
            <p className="paywall-desc">
              Unit 1 is free for all grades. Unlock Unit {lockedUnitAttempted || 2} and all remaining chapters for all subjects with our Premium subscription.
            </p>

            <div className="pricing-box">
              <div className="price-label">ONE-TIME LIFE-TIME ACCESS</div>
              <div className="price">150 ETB</div>
            </div>

            <div className="features-checklist">
              <div className="checklist-item">
                <CheckCircle2 size={16} className="check-icon" />
                <span>Unlock all units/chapters (Units 1 - 10+)</span>
              </div>
              <div className="checklist-item">
                <CheckCircle2 size={16} className="check-icon" />
                <span>Grades 7, 8, 9, 10, 11, and 12 complete databases</span>
              </div>
              <div className="checklist-item">
                <CheckCircle2 size={16} className="check-icon" />
                <span>100% offline access to all questions</span>
              </div>
            </div>

            <div className="paywall-actions">
              <button 
                onClick={() => {
                  setShowPaywallModal(false);
                  setLockedUnitAttempted(null);
                }} 
                className="btn-secondary"
              >
                Continue Free
              </button>
              <button 
                onClick={() => {
                  router.push("/payment");
                }} 
                className="btn-primary"
              >
                Proceed to Payment
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .practice-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
        }
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(16, 22, 42, 0.9);
          border-bottom: 1px solid var(--border-color);
          padding: 12px 24px;
          position: sticky;
          top: 0;
          z-index: 100;
          backdrop-filter: blur(10px);
        }
        .status-indicator {
          font-size: 0.85rem;
          font-weight: 600;
        }
        .status-online {
          color: var(--success);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-offline {
          color: var(--warning);
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .status-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .sync-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          background: var(--primary-glow-subtle);
          border: 1px solid var(--border-color);
          color: #4d88ff;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .sync-btn:hover:not(:disabled) {
          background: rgba(0, 82, 255, 0.2);
          border-color: var(--border-hover);
        }
        .sync-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .user-email {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .logout-icon-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: color 0.2s, background 0.2s;
        }
        .logout-icon-btn:hover {
          color: var(--danger);
          background: rgba(255, 23, 68, 0.05);
        }
        .practice-layout {
          display: grid;
          grid-template-columns: 280px 1fr;
          flex: 1;
          position: relative;
        }
        .sidebar {
          background: rgba(16, 22, 42, 0.4);
          border-radius: 0;
          border-top: none;
          border-bottom: none;
          border-left: none;
          height: calc(100vh - 53px);
          position: sticky;
          top: 53px;
          display: flex;
          flex-direction: column;
          z-index: 10;
        }
        .sidebar-header {
          padding: 20px 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .brand {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 1.1rem;
          color: #ffffff;
        }
        .brand-logo {
          color: var(--primary);
        }
        .close-sidebar-btn {
          display: none;
          background: none;
          border: none;
          cursor: pointer;
        }
        .sidebar-content {
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          overflow-y: auto;
        }
        .category-indicator {
          background: rgba(0, 82, 255, 0.06);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .category-indicator span {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .category-indicator strong {
          font-size: 0.95rem;
          color: #ffffff;
        }
        .change-category-btn {
          background: none;
          border: none;
          color: var(--primary);
          font-size: 0.75rem;
          font-weight: 600;
          text-align: left;
          cursor: pointer;
          padding: 0;
          margin-top: 4px;
          width: fit-content;
        }
        .change-category-btn:hover {
          text-decoration: underline;
        }
        .nav-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .group-label {
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.1em;
          color: var(--text-muted);
        }
        .grade-selector-nav {
          display: flex;
          gap: 8px;
        }
        .grade-nav-btn {
          flex: 1;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          color: var(--text-muted);
          padding: 8px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, color 0.2s, border-color 0.2s;
        }
        .grade-nav-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-main);
        }
        .grade-nav-btn.active {
          background: var(--primary-glow-subtle);
          border-color: var(--primary);
          color: #ffffff;
        }
        .list-nav {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .list-nav-item {
          display: flex;
          align-items: center;
          gap: 6px;
          background: none;
          border: none;
          color: var(--text-muted);
          text-align: left;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          padding: 8px 12px;
          border-radius: var(--radius-sm);
          transition: background 0.2s, color 0.2s;
        }
        .list-nav-item:hover {
          background: rgba(255, 255, 255, 0.02);
          color: var(--text-main);
        }
        .list-nav-item.active {
          background: rgba(0, 82, 255, 0.1);
          color: #ffffff;
          font-weight: 600;
        }
        .list-nav-item.active .chevron {
          color: var(--primary);
        }
        .list-nav-item .chevron {
          color: rgba(255, 255, 255, 0.15);
          transition: color 0.2s;
        }
        .empty-nav-msg {
          font-size: 0.75rem;
          color: var(--text-muted);
          padding: 8px 12px;
        }
        .unit-grid-nav {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        .unit-nav-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-sm);
          padding: 8px 10px;
          font-size: 0.8rem;
          color: var(--text-muted);
          cursor: pointer;
          font-weight: 500;
          transition: background 0.2s, border-color 0.2s, color 0.2s;
        }
        .unit-nav-btn:hover {
          background: rgba(255, 255, 255, 0.04);
          color: var(--text-main);
        }
        .unit-nav-btn.active {
          background: var(--primary-glow-subtle);
          border-color: var(--primary);
          color: #ffffff;
          font-weight: 600;
        }
        .unit-nav-btn.locked {
          opacity: 0.7;
          border-color: rgba(255, 255, 255, 0.05);
        }
        .lock-icon {
          color: var(--warning);
        }
        .mobile-menu-trigger {
          display: none;
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          color: var(--text-main);
          padding: 10px 16px;
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          align-items: center;
          gap: 8px;
          margin: 16px;
          border-radius: var(--radius-sm);
        }
        .quiz-main {
          padding: 32px;
          overflow-y: auto;
          height: calc(100vh - 53px);
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .quiz-header {
          padding: 24px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .quiz-title-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .quiz-path {
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-muted);
        }
        .quiz-header h2 {
          font-size: 1.4rem;
          color: #ffffff;
          font-weight: 700;
        }
        .score-summary {
          display: flex;
          gap: 20px;
        }
        .score-stat {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 2px;
        }
        .score-stat span {
          font-size: 0.7rem;
          color: var(--text-muted);
          text-transform: uppercase;
        }
        .score-stat strong {
          font-size: 1.1rem;
          color: #ffffff;
        }
        .correct-score {
          color: var(--success) !important;
        }
        .quiz-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 64px 32px;
          gap: 16px;
        }
        .empty-icon {
          color: var(--primary);
        }
        .quiz-empty h3 {
          font-size: 1.4rem;
          color: #ffffff;
        }
        .quiz-empty p {
          color: var(--text-muted);
          max-width: 480px;
          line-height: 1.5;
          font-size: 0.9rem;
        }
        .questions-feed {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 800px;
          width: 100%;
          margin: 0 auto;
        }
        .question-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .question-number {
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: var(--primary);
        }
        .question-text {
          font-size: 1.1rem;
          line-height: 1.6;
          color: #ffffff;
          font-weight: 500;
        }
        .choices-list {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .choice-option {
          display: flex;
          align-items: center;
          width: 100%;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 14px 20px;
          cursor: pointer;
          text-align: left;
          transition: background 0.2s, border-color 0.2s, transform 0.1s;
          position: relative;
        }
        .choice-option:hover:not(:disabled) {
          background: rgba(0, 82, 255, 0.04);
          border-color: var(--border-hover);
        }
        .choice-option:active:not(:disabled) {
          transform: scale(0.995);
        }
        .choice-letter {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.04);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          font-weight: 700;
          margin-right: 14px;
          color: var(--text-muted);
        }
        .choice-option:hover .choice-letter {
          color: #ffffff;
          border-color: var(--border-hover);
        }
        .choice-text {
          font-size: 0.95rem;
          color: var(--text-main);
          flex: 1;
        }
        .choice-status-icon {
          margin-left: 12px;
        }
        .success-icon {
          color: var(--success);
        }
        .danger-icon {
          color: var(--danger);
        }

        /* Answered Card States */
        .choice-option.correct {
          background: rgba(0, 230, 118, 0.06);
          border-color: var(--success);
        }
        .choice-option.correct .choice-letter {
          background: rgba(0, 230, 118, 0.15);
          color: var(--success);
          border-color: var(--success);
        }
        .choice-option.incorrect {
          background: rgba(255, 23, 68, 0.06);
          border-color: var(--danger);
        }
        .choice-option.incorrect .choice-letter {
          background: rgba(255, 23, 68, 0.15);
          color: var(--danger);
          border-color: var(--danger);
        }
        .choice-option.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .question-card.answered-correct {
          border-color: rgba(0, 230, 118, 0.25);
        }
        .question-card.answered-incorrect {
          border-color: rgba(255, 23, 68, 0.25);
        }

        .explanation-box {
          background: rgba(255, 255, 255, 0.02);
          border: 1px dashed var(--border-color);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
          margin-top: 10px;
        }
        .explanation-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary);
        }
        .explanation-header h4 {
          font-size: 0.9rem;
          font-weight: 700;
        }
        .explanation-box p {
          font-size: 0.9rem;
          line-height: 1.5;
          color: var(--text-muted);
        }

        /* Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(6, 8, 19, 0.85);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .paywall-modal {
          max-width: 480px;
          width: 100%;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
          margin: 16px;
        }
        .paywall-icon-container {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: rgba(0, 82, 255, 0.1);
          border: 1px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 8px;
        }
        .modal-lock {
          color: var(--primary);
        }
        .paywall-modal h2 {
          font-size: 1.8rem;
          color: #ffffff;
          font-weight: 800;
        }
        .paywall-desc {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
        }
        .pricing-box {
          background: rgba(0, 82, 255, 0.05);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 16px 32px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          align-items: center;
          margin: 8px 0;
        }
        .price-label {
          font-size: 0.65rem;
          font-weight: 700;
          color: var(--primary);
          letter-spacing: 0.1em;
        }
        .price {
          font-size: 1.8rem;
          font-weight: 800;
          color: #ffffff;
        }
        .features-checklist {
          display: flex;
          flex-direction: column;
          gap: 12px;
          text-align: left;
          width: 100%;
          background: rgba(255, 255, 255, 0.01);
          padding: 20px;
          border-radius: var(--radius-md);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .checklist-item {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.85rem;
          color: var(--text-main);
        }
        .check-icon {
          color: var(--success);
        }
        .paywall-actions {
          display: flex;
          gap: 12px;
          width: 100%;
          margin-top: 10px;
        }
        .paywall-actions :global(button) {
          flex: 1;
        }

        /* Mobile specific styles */
        @media (max-width: 960px) {
          .practice-layout {
            grid-template-columns: 1fr;
          }
          .sidebar {
            position: fixed;
            top: 0;
            left: -290px;
            width: 280px;
            height: 100vh;
            transition: left 0.3s ease;
            z-index: 2000;
            background: var(--bg-surface);
          }
          .sidebar.open {
            left: 0;
          }
          .close-sidebar-btn {
            display: block;
          }
          .sidebar-backdrop {
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
            z-index: 1500;
          }
          .mobile-menu-trigger {
            display: flex;
          }
          .quiz-main {
            height: calc(100vh - 120px);
            padding: 16px;
          }
          .quiz-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .score-summary {
            width: 100%;
            justify-content: space-between;
          }
          .score-stat {
            align-items: flex-start;
          }
        }
      `}</style>
    </div>
  );
}
