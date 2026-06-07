"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, getDocs, doc, addDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ArrowLeft, BookOpen, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, Search
} from "lucide-react";

interface Question {
  id: string;
  gradeCategory: "grade_8" | "grade_12";
  specificGrade: number;
  subject: string;
  unit: number;
  chapterTitle?: string;
  question: string;
  choices: string[];
  correctAnswer: number;
  explanation: string;
}

export default function AdminQuestionsPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, isOnline } = useAuth();

  // Questions state
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGrade, setFilterGrade] = useState<string>("all");
  const [filterSubject, setFilterSubject] = useState<string>("all");

  // Form state
  const [gradeCategory, setGradeCategory] = useState<"grade_8" | "grade_12">("grade_8");
  const [specificGrade, setSpecificGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("1");
  const [chapterTitle, setChapterTitle] = useState("");
  const [questionText, setQuestionText] = useState("");
  const [choiceA, setChoiceA] = useState("");
  const [choiceB, setChoiceB] = useState("");
  const [choiceC, setChoiceC] = useState("");
  const [choiceD, setChoiceD] = useState("");
  const [correctAnswer, setCorrectAnswer] = useState("0");
  const [explanation, setExplanation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");

  // Role verification redirect
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (profile && profile.role !== "admin") {
        router.push("/practice");
      }
    }
  }, [user, profile, authLoading, router]);

  const loadQuestions = async () => {
    if (!isOnline) {
      setLoadingQuestions(false);
      return;
    }
    setLoadingQuestions(true);
    try {
      const querySnapshot = await getDocs(collection(db, "questions"));
      const list: Question[] = [];
      querySnapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as Question);
      });
      // Sort: Grade, Subject, Unit
      list.sort((a, b) => {
        if (a.specificGrade !== b.specificGrade) return a.specificGrade - b.specificGrade;
        if (a.subject !== b.subject) return a.subject.localeCompare(b.subject);
        return a.unit - b.unit;
      });
      setQuestions(list);
    } catch (err) {
      console.error("Error loading questions:", err);
    } finally {
      setLoadingQuestions(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role === "admin") {
      loadQuestions();
    }
  }, [profile, isOnline]);

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!subject.trim()) {
      setFormError("Please enter a subject (e.g. Biology, Mathematics).");
      return;
    }
    if (!questionText.trim()) {
      setFormError("Please enter the question text.");
      return;
    }
    if (!choiceA.trim() || !choiceB.trim() || !choiceC.trim() || !choiceD.trim()) {
      setFormError("Please provide all 4 choices.");
      return;
    }
    if (!explanation.trim()) {
      setFormError("Please provide a simple explanation.");
      return;
    }

    setSubmitting(true);

    try {
      const newQuestion = {
        gradeCategory,
        specificGrade: parseInt(specificGrade),
        subject: subject.trim(),
        unit: parseInt(unit) || 1,
        chapterTitle: chapterTitle.trim() || `Unit ${unit}`,
        question: questionText.trim(),
        choices: [choiceA.trim(), choiceB.trim(), choiceC.trim(), choiceD.trim()],
        correctAnswer: parseInt(correctAnswer),
        explanation: explanation.trim(),
        createdAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, "questions"), newQuestion);
      
      setQuestions(prev => [
        ...prev, 
        { id: docRef.id, ...newQuestion } as Question
      ]);

      setFormSuccess("Question added successfully!");
      // Reset form text fields, keep grade, subject, unit, and chapter for faster batch entry
      setQuestionText("");
      setChoiceA("");
      setChoiceB("");
      setChoiceC("");
      setChoiceD("");
      setCorrectAnswer("0");
      setExplanation("");
    } catch (err: any) {
      console.error("Error adding question:", err);
      setFormError("Failed to add question: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteQuestion = async (questionId: string) => {
    if (!confirm("Are you sure you want to delete this question?")) return;
    try {
      await deleteDoc(doc(db, "questions", questionId));
      setQuestions(prev => prev.filter(q => q.id !== questionId));
    } catch (err) {
      console.error("Error deleting question:", err);
    }
  };

  // Dynamically filter questions list
  const filteredQuestions = questions.filter((q) => {
    const matchesSearch = 
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (q.chapterTitle && q.chapterTitle.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesGrade = 
      filterGrade === "all" || 
      q.specificGrade.toString() === filterGrade;
      
    const matchesSubject = 
      filterSubject === "all" || 
      q.subject.toLowerCase() === filterSubject.toLowerCase();

    return matchesSearch && matchesGrade && matchesSubject;
  });

  // Extract unique subjects for filtering list
  const filterSubjectsList = Array.from(new Set(questions.map(q => q.subject))).sort();

  return (
    <div className="admin-questions-container animate-fade-in">
      <header className="questions-header glass-panel">
        <button onClick={() => router.push("/admin")} className="back-btn">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <h2>Question Database Manager</h2>
      </header>

      <div className="questions-layout">
        {/* Left column: Add question form */}
        <div className="form-column">
          <form onSubmit={handleAddQuestion} className="question-form glass-panel">
            <h3>Add Question Manually</h3>

            {formError && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="success-alert">
                <CheckCircle2 size={16} />
                <span>{formSuccess}</span>
              </div>
            )}

            <div className="form-grid-double">
              <div className="input-group">
                <label htmlFor="gradeCategory">Grade Category</label>
                <select
                  id="gradeCategory"
                  className="select-field"
                  value={gradeCategory}
                  onChange={(e) => {
                    const cat = e.target.value as "grade_8" | "grade_12";
                    setGradeCategory(cat);
                    setSpecificGrade(cat === "grade_8" ? "8" : "12");
                  }}
                >
                  <option value="grade_8">Grade 8 Category (7-8)</option>
                  <option value="grade_12">Grade 12 Category (9-12)</option>
                </select>
              </div>

              <div className="input-group">
                <label htmlFor="specificGrade">Specific Grade</label>
                <select
                  id="specificGrade"
                  className="select-field"
                  value={specificGrade}
                  onChange={(e) => setSpecificGrade(e.target.value)}
                >
                  {gradeCategory === "grade_8" ? (
                    <>
                      <option value="7">Grade 7</option>
                      <option value="8">Grade 8</option>
                    </>
                  ) : (
                    <>
                      <option value="9">Grade 9</option>
                      <option value="10">Grade 10</option>
                      <option value="11">Grade 11</option>
                      <option value="12">Grade 12</option>
                    </>
                  )}
                </select>
              </div>
            </div>

            <div className="form-grid-double">
              <div className="input-group">
                <label htmlFor="subject">Subject</label>
                <input
                  id="subject"
                  type="text"
                  placeholder="E.g., Biology, Chemistry"
                  className="input-field"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </div>

              <div className="input-group">
                <label htmlFor="unit">Unit / Chapter Number</label>
                <input
                  id="unit"
                  type="number"
                  placeholder="1"
                  className="input-field"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value)}
                />
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="chapterTitle">Chapter Title (Optional)</label>
              <input
                id="chapterTitle"
                type="text"
                placeholder="E.g., Cell Biology & Genetics"
                className="input-field"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="questionText">Question Text</label>
              <textarea
                id="questionText"
                placeholder="Type the exam question here..."
                className="input-field question-textarea"
                rows={3}
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
              />
            </div>

            {/* Choices inputs */}
            <div className="choices-form-group">
              <label>Provide Choices</label>
              <div className="choices-inputs-grid">
                <div className="choice-input-item">
                  <span className="choice-lbl">A</span>
                  <input
                    type="text"
                    placeholder="Choice A"
                    className="input-field"
                    value={choiceA}
                    onChange={(e) => setChoiceA(e.target.value)}
                  />
                </div>
                <div className="choice-input-item">
                  <span className="choice-lbl">B</span>
                  <input
                    type="text"
                    placeholder="Choice B"
                    className="input-field"
                    value={choiceB}
                    onChange={(e) => setChoiceB(e.target.value)}
                  />
                </div>
                <div className="choice-input-item">
                  <span className="choice-lbl">C</span>
                  <input
                    type="text"
                    placeholder="Choice C"
                    className="input-field"
                    value={choiceC}
                    onChange={(e) => setChoiceC(e.target.value)}
                  />
                </div>
                <div className="choice-input-item">
                  <span className="choice-lbl">D</span>
                  <input
                    type="text"
                    placeholder="Choice D"
                    className="input-field"
                    value={choiceD}
                    onChange={(e) => setChoiceD(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="input-group">
              <label htmlFor="correctAnswer">Select Correct Answer</label>
              <select
                id="correctAnswer"
                className="select-field"
                value={correctAnswer}
                onChange={(e) => setCorrectAnswer(e.target.value)}
              >
                <option value="0">Choice A is Correct</option>
                <option value="1">Choice B is Correct</option>
                <option value="2">Choice C is Correct</option>
                <option value="3">Choice D is Correct</option>
              </select>
            </div>

            <div className="input-group">
              <label htmlFor="explanation">Simple Explanation</label>
              <textarea
                id="explanation"
                placeholder="Provide a clear, simple explanation of why the selected answer is correct..."
                className="input-field explanation-textarea"
                rows={3}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="spinner" /> Saving...
                </>
              ) : (
                <>
                  <Plus size={16} /> Save Question to DB
                </>
              )}
            </button>
          </form>
        </div>

        {/* Right column: Questions list with search/filters */}
        <div className="list-column">
          <div className="list-card glass-panel">
            <div className="search-filters-header">
              <h3>Database Questions ({filteredQuestions.length})</h3>
              
              <div className="search-bar-wrapper">
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  placeholder="Search questions or subject..."
                  className="input-field search-input"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="filters-row">
                <select
                  className="select-field filter-select"
                  value={filterGrade}
                  onChange={(e) => setFilterGrade(e.target.value)}
                >
                  <option value="all">All Grades</option>
                  <option value="7">Grade 7</option>
                  <option value="8">Grade 8</option>
                  <option value="9">Grade 9</option>
                  <option value="10">Grade 10</option>
                  <option value="11">Grade 11</option>
                  <option value="12">Grade 12</option>
                </select>

                <select
                  className="select-field filter-select"
                  value={filterSubject}
                  onChange={(e) => setFilterSubject(e.target.value)}
                >
                  <option value="all">All Subjects</option>
                  {filterSubjectsList.map((subj) => (
                    <option key={subj} value={subj}>{subj}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="questions-scroll-list">
              {loadingQuestions ? (
                <div className="loading-state text-center">
                  <Loader2 className="spinner" />
                  <p>Loading question bank...</p>
                </div>
              ) : (
                <>
                  {filteredQuestions.map((q) => (
                    <div key={q.id} className="db-question-item">
                      <div className="item-meta-row">
                        <span className="badge badge-blue">Grade {q.specificGrade}</span>
                        <span className="badge badge-orange">{q.subject}</span>
                        <span className="badge-unit">Unit {q.unit}</span>
                        
                        <button 
                          onClick={() => handleDeleteQuestion(q.id)}
                          className="delete-q-btn"
                          title="Delete Question"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      
                      <p className="item-question-text">{q.question}</p>
                      
                      <div className="item-choices-grid">
                        {q.choices.map((choice, index) => {
                          const isCorrect = q.correctAnswer === index;
                          return (
                            <div key={index} className={`item-choice ${isCorrect ? "correct" : ""}`}>
                              <span>{String.fromCharCode(65 + index)}:</span>
                              <p>{choice}</p>
                            </div>
                          );
                        })}
                      </div>

                      <div className="item-explanation">
                        <strong>Explanation:</strong>
                        <p>{q.explanation}</p>
                      </div>
                    </div>
                  ))}
                  
                  {filteredQuestions.length === 0 && (
                    <div className="empty-results text-center">
                      <AlertCircle size={32} className="empty-icon" />
                      <p>No questions match your filter options.</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-questions-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          max-width: 1300px;
          width: 100%;
          margin: 0 auto;
          gap: 32px;
        }
        .questions-header {
          padding: 24px 32px;
          display: flex;
          align-items: center;
          gap: 24px;
        }
        .back-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid var(--border-color);
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .back-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--border-hover);
        }
        .questions-header h2 {
          font-size: 1.6rem;
          color: #ffffff;
          font-weight: 800;
        }
        .questions-layout {
          display: grid;
          grid-template-columns: 1.1fr 1.3fr;
          gap: 32px;
          align-items: start;
        }
        .form-column, .list-column {
          display: flex;
          flex-direction: column;
        }
        .question-form {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .question-form h3 {
          font-size: 1.3rem;
          color: #ffffff;
          margin-bottom: 8px;
        }
        .error-alert {
          background: rgba(255, 23, 68, 0.1);
          border: 1px solid rgba(255, 23, 68, 0.2);
          color: var(--danger);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .success-alert {
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.2);
          color: var(--success);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .form-grid-double {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .input-group {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .input-group label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .question-textarea, .explanation-textarea {
          resize: vertical;
        }
        .choices-form-group {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .choices-form-group label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .choices-inputs-grid {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .choice-input-item {
          display: flex;
          align-items: center;
          position: relative;
        }
        .choice-lbl {
          position: absolute;
          left: 16px;
          font-weight: 700;
          font-size: 0.85rem;
          color: var(--primary);
        }
        .choice-input-item :global(input) {
          padding-left: 36px;
        }
        .list-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .search-filters-header {
          display: flex;
          flex-direction: column;
          gap: 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 20px;
        }
        .search-filters-header h3 {
          font-size: 1.2rem;
          color: #ffffff;
        }
        .search-bar-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .search-icon {
          position: absolute;
          left: 14px;
          color: var(--text-muted);
        }
        .search-input {
          padding-left: 40px;
        }
        .filters-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .filter-select {
          font-size: 0.85rem;
        }
        .questions-scroll-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          overflow-y: auto;
          max-height: 800px;
          padding-right: 8px;
        }
        .loading-state, .empty-results {
          padding: 64px 16px;
          color: var(--text-muted);
        }
        .empty-icon {
          color: rgba(255, 255, 255, 0.05);
          margin-bottom: 12px;
        }
        .db-question-item {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .item-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .badge-unit {
          font-size: 0.75rem;
          font-weight: 600;
          color: var(--text-muted);
          margin-left: 4px;
        }
        .delete-q-btn {
          margin-left: auto;
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color 0.2s, background 0.2s;
        }
        .delete-q-btn:hover {
          color: var(--danger);
          background: rgba(255, 23, 68, 0.05);
        }
        .item-question-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.5;
        }
        .item-choices-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .item-choice {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-sm);
          padding: 10px 14px;
          display: flex;
          gap: 8px;
          font-size: 0.85rem;
        }
        .item-choice.correct {
          background: rgba(0, 230, 118, 0.05);
          border-color: rgba(0, 230, 118, 0.25);
          color: var(--success);
        }
        .item-choice span {
          font-weight: 700;
        }
        .item-choice p {
          color: inherit;
        }
        .item-explanation {
          border-top: 1px dashed rgba(255, 255, 255, 0.05);
          padding-top: 12px;
          font-size: 0.8rem;
          line-height: 1.4;
        }
        .item-explanation strong {
          color: var(--primary);
        }
        .item-explanation p {
          color: var(--text-muted);
          margin-top: 4px;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .questions-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
