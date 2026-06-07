"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  ArrowLeft, UploadCloud, Sparkles, Loader2, AlertCircle, 
  CheckCircle2, Trash2, Edit3, Save, Check
} from "lucide-react";

interface ExtractedQuestion {
  tempId: string;
  question: string;
  choices: string[];
  correctAnswer: number;
  explanation: string;
  selected: boolean;
}

export default function AdminAiPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, isOnline } = useAuth();

  // Assignment Meta
  const [gradeCategory, setGradeCategory] = useState<"grade_8" | "grade_12">("grade_8");
  const [specificGrade, setSpecificGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("1");
  const [chapterTitle, setChapterTitle] = useState("");
  const [aiModel, setAiModel] = useState<"gemini-2.0-flash" | "gemini-2.0-flash-lite" | "gemini-2.5-flash-preview-05-20" | "gemini-1.5-flash" | "gemini-1.5-pro">("gemini-2.0-flash");

  // Upload/AI processing states
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [extracting, setExtracting] = useState(false);
  
  // Extracted data state
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  
  // Status states
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [importing, setImporting] = useState(false);

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

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      validateAndSetFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndSetFile(e.target.files[0]);
    }
  };

  const validateAndSetFile = (selectedFile: File) => {
    setErrorMsg("");
    setSuccessMsg("");
    const fileType = selectedFile.name.split(".").pop()?.toLowerCase();
    
    if (!["pdf", "docx", "pptx", "txt"].includes(fileType || "")) {
      setErrorMsg("Unsupported file type. Please upload a PDF, DOCX, PPTX, or TXT file.");
      setFile(null);
      return;
    }
    
    setFile(selectedFile);
  };

  const handleStartExtraction = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");
    
    if (!file) {
      setErrorMsg("Please upload an educational document first.");
      return;
    }

    if (!subject.trim()) {
      setErrorMsg("Please enter a Subject name for question categorization.");
      return;
    }

    setExtracting(true);
    setExtractedQuestions([]);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", aiModel);

      const res = await fetch("/api/ai/extract", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to process document.");
      }

      const formatted = data.questions.map((q: any, idx: number) => ({
        tempId: `temp-${idx}`,
        question: q.question,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        selected: true, // Default checked
      }));

      setExtractedQuestions(formatted);
      setSuccessMsg(`Successfully parsed document and extracted ${formatted.length} questions! Review and edit them below.`);
    } catch (err: any) {
      console.error(err);
      setErrorMsg("AI Extraction failed: " + err.message);
    } finally {
      setExtracting(false);
    }
  };

  // Inline editor functions
  const handleEditField = (index: number, field: string, value: any) => {
    setExtractedQuestions(prev => {
      const list = [...prev];
      if (field.startsWith("choice-")) {
        const choiceIdx = parseInt(field.split("-")[1]);
        list[index].choices[choiceIdx] = value;
      } else {
        (list[index] as any)[field] = value;
      }
      return list;
    });
  };

  const handleToggleSelect = (index: number) => {
    setExtractedQuestions(prev => prev.map((q, i) => i === index ? { ...q, selected: !q.selected } : q));
  };

  const handleDeleteItem = (index: number) => {
    setExtractedQuestions(prev => prev.filter((_, i) => i !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
    }
  };

  const handleImportQuestions = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    
    const selectedList = extractedQuestions.filter(q => q.selected);
    if (selectedList.length === 0) {
      setErrorMsg("No questions selected. Please select at least one question to import.");
      return;
    }

    setImporting(true);

    try {
      // Use Firestore WriteBatch for atomic, faster bulk writes
      const batch = writeBatch(db);
      const questionsColRef = collection(db, "questions");

      selectedList.forEach((q) => {
        const docRef = doc(questionsColRef); // Auto ID
        batch.set(docRef, {
          gradeCategory,
          specificGrade: parseInt(specificGrade),
          subject: subject.trim(),
          unit: parseInt(unit) || 1,
          chapterTitle: chapterTitle.trim() || `Unit ${unit}`,
          question: q.question,
          choices: q.choices,
          correctAnswer: q.correctAnswer,
          explanation: q.explanation,
          createdAt: serverTimestamp(),
        });
      });

      await batch.commit();

      setSuccessMsg(`Bulk upload successful! Imported ${selectedList.length} questions into Grade ${specificGrade} ${subject}.`);
      setExtractedQuestions([]);
      setFile(null);
    } catch (err: any) {
      console.error("Bulk import failed:", err);
      setErrorMsg("Bulk import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin-ai-container animate-fade-in">
      <header className="ai-header glass-panel">
        <button onClick={() => router.push("/admin")} className="back-btn">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <h2>AI Question Generator Ingestion</h2>
      </header>

      <div className="ai-layout">
        {/* Document Ingest Config Card */}
        <div className="upload-config-card glass-panel">
          <h3>Upload Lecture Materials</h3>
          <p className="card-subtitle">AI reads the PDF/DOCX/PPTX, parses the concepts, and extracts multiple choice practice questions automatically.</p>

          <form onSubmit={handleStartExtraction} className="upload-form">
            {/* Drag & Drop File Upload */}
            <div 
              className={`drag-upload-box ${dragActive ? "drag-active" : ""} ${file ? "file-selected" : ""}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden-file-input"
                onChange={handleFileChange}
                accept=".pdf,.docx,.pptx,.txt"
              />
              <label htmlFor="file-upload" className="upload-label">
                <UploadCloud className="upload-icon" />
                {file ? (
                  <div className="file-info text-center">
                    <strong>{file.name}</strong>
                    <span>({(file.size / (1024 * 1024)).toFixed(2)} MB)</span>
                  </div>
                ) : (
                  <div className="upload-instructions text-center">
                    <strong>Drag and drop file here</strong>
                    <span>or click to browse from device (PDF, DOCX, PPTX, TXT)</span>
                  </div>
                )}
              </label>
            </div>

            {/* Ingestion Meta parameters */}
            <div className="form-grid-double">
              <div className="input-group">
                <label htmlFor="gradeCategory">Target Grade Category</label>
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
                <label htmlFor="specificGrade">Target Grade Level</label>
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
                  placeholder="E.g., Biology, Geography"
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
                placeholder="E.g., Ecosystem Dynamics"
                className="input-field"
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
              />
            </div>

            <div className="input-group">
              <label htmlFor="aiModel">AI Extraction Model</label>
              <select
                id="aiModel"
                className="select-field"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value as any)}
              >
                <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Recommended — Fast & Accurate)</option>
                <option value="gemini-2.0-flash-lite">🔋 Gemini 2.0 Flash Lite (Fastest & Cheapest)</option>
                <option value="gemini-2.5-flash-preview-05-20">🧠 Gemini 2.5 Flash Preview (Best Quality)</option>
                <option value="gemini-1.5-flash">Gemini 1.5 Flash (Legacy)</option>
                <option value="gemini-1.5-pro">Gemini 1.5 Pro (Legacy)</option>
              </select>
            </div>

            <button type="submit" className="btn-primary start-ai-btn" disabled={extracting || !file}>
              {extracting ? (
                <>
                  <Loader2 className="spinner" /> AI Extracting Questions...
                </>
              ) : (
                <>
                  <Sparkles size={16} /> Extract Questions via AI
                </>
              )}
            </button>
          </form>
        </div>

        {/* AI Preview and Approval List Panel */}
        <div className="preview-ingest-column">
          <div className="preview-card glass-panel">
            <div className="preview-header">
              <h3>AI Extraction Review & Edit</h3>
              {extractedQuestions.length > 0 && (
                <button
                  onClick={handleImportQuestions}
                  className="btn-primary approve-bulk-btn"
                  disabled={importing}
                >
                  {importing ? <Loader2 className="spinner" /> : <Check size={16} />}
                  Import Selected ({extractedQuestions.filter(q => q.selected).length})
                </button>
              )}
            </div>

            {errorMsg && (
              <div className="error-alert">
                <AlertCircle size={16} />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="success-alert">
                <CheckCircle2 size={16} />
                <span>{successMsg}</span>
              </div>
            )}

            <div className="extracted-questions-scroll-list">
              {extracting && (
                <div className="ai-thinking text-center">
                  <Sparkles size={32} className="sparkles-anim spinner" />
                  <h4>Gemini AI is Reading...</h4>
                  <p>Processing text content and designing multiple-choice questions with answers. This usually takes 10-25 seconds depending on document length.</p>
                </div>
              )}
              
              {extractedQuestions.map((q, index) => {
                const isEditing = editingIndex === index;
                
                return (
                  <div key={q.tempId} className={`extracted-item ${q.selected ? "selected" : ""} ${isEditing ? "editing" : ""}`}>
                    <div className="item-controls">
                      <div className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          id={`chk-${q.tempId}`}
                          checked={q.selected}
                          onChange={() => handleToggleSelect(index)}
                        />
                        <label htmlFor={`chk-${q.tempId}`}>Include Question</label>
                      </div>

                      <div className="item-actions">
                        <button
                          className="item-act-btn edit"
                          onClick={() => setEditingIndex(isEditing ? null : index)}
                        >
                          {isEditing ? <Save size={14} /> : <Edit3 size={14} />}
                        </button>
                        <button
                          className="item-act-btn delete"
                          onClick={() => handleDeleteItem(index)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {isEditing ? (
                      /* Editable Question Fields */
                      <div className="edit-form-wrapper animate-scale-in">
                        <div className="input-group">
                          <label>Question Text</label>
                          <textarea
                            className="input-field"
                            rows={2}
                            value={q.question}
                            onChange={(e) => handleEditField(index, "question", e.target.value)}
                          />
                        </div>
                        
                        <div className="edit-choices-grid">
                          {q.choices.map((choice, cIdx) => (
                            <div key={cIdx} className="choice-edit-row">
                              <span className="choice-letter">{String.fromCharCode(65 + cIdx)}</span>
                              <input
                                type="text"
                                className="input-field"
                                value={choice}
                                onChange={(e) => handleEditField(index, `choice-${cIdx}`, e.target.value)}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="input-group">
                          <label>Correct Answer Index</label>
                          <select
                            className="select-field"
                            value={q.correctAnswer}
                            onChange={(e) => handleEditField(index, "correctAnswer", parseInt(e.target.value))}
                          >
                            <option value={0}>A is Correct</option>
                            <option value={1}>B is Correct</option>
                            <option value={2}>C is Correct</option>
                            <option value={3}>D is Correct</option>
                          </select>
                        </div>

                        <div className="input-group">
                          <label>Explanation</label>
                          <textarea
                            className="input-field"
                            rows={2}
                            value={q.explanation}
                            onChange={(e) => handleEditField(index, "explanation", e.target.value)}
                          />
                        </div>
                      </div>
                    ) : (
                      /* Preview Question Output */
                      <div className="preview-wrapper">
                        <h4 className="preview-question-text">{index + 1}. {q.question}</h4>
                        <div className="preview-choices-grid">
                          {q.choices.map((choice, cIdx) => {
                            const isCorrect = q.correctAnswer === cIdx;
                            return (
                              <div key={cIdx} className={`preview-choice ${isCorrect ? "correct" : ""}`}>
                                <span>{String.fromCharCode(65 + cIdx)}:</span>
                                <p>{choice}</p>
                              </div>
                            );
                          })}
                        </div>
                        <div className="preview-explanation">
                          <strong>Explanation:</strong>
                          <p>{q.explanation}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {!extracting && extractedQuestions.length === 0 && (
                <div className="empty-preview text-center">
                  <Sparkles size={48} className="sparkles-anim" />
                  <h4>Ready for Extraction</h4>
                  <p>Upload a document and click "Extract Questions via AI" to populate this workspace.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        .admin-ai-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          max-width: 1300px;
          width: 100%;
          margin: 0 auto;
          gap: 32px;
        }
        .ai-header {
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
        .ai-header h2 {
          font-size: 1.6rem;
          color: #ffffff;
          font-weight: 800;
        }
        .ai-layout {
          display: grid;
          grid-template-columns: 1fr 1.3fr;
          gap: 32px;
          align-items: start;
        }
        .upload-config-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .upload-config-card h3 {
          font-size: 1.25rem;
          color: #ffffff;
        }
        .card-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin-bottom: 10px;
        }
        .upload-form {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .drag-upload-box {
          border: 2px dashed var(--border-color);
          background: rgba(255, 255, 255, 0.01);
          border-radius: var(--radius-md);
          padding: 36px 20px;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .drag-upload-box:hover, .drag-upload-box.drag-active {
          background: rgba(0, 82, 255, 0.04);
          border-color: var(--border-hover);
        }
        .drag-upload-box.file-selected {
          border-color: var(--primary);
          background: rgba(0, 82, 255, 0.02);
        }
        .hidden-file-input {
          display: none;
        }
        .upload-label {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 12px;
          width: 100%;
          cursor: pointer;
        }
        .upload-icon {
          width: 40px;
          height: 40px;
          color: var(--text-muted);
        }
        .drag-upload-box.file-selected .upload-icon {
          color: var(--primary);
        }
        .upload-instructions, .file-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .upload-instructions strong, .file-info strong {
          font-size: 0.95rem;
          color: #ffffff;
        }
        .upload-instructions span, .file-info span {
          font-size: 0.8rem;
          color: var(--text-muted);
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
        .start-ai-btn {
          width: 100%;
        }
        .preview-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .preview-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 16px;
        }
        .preview-header h3 {
          font-size: 1.2rem;
          color: #ffffff;
        }
        .approve-bulk-btn {
          font-size: 0.85rem;
          padding: 8px 16px;
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
        .extracted-questions-scroll-list {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-height: 800px;
          overflow-y: auto;
          padding-right: 8px;
        }
        .ai-thinking, .empty-preview {
          padding: 64px 20px;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .ai-thinking h4, .empty-preview h4 {
          font-size: 1.1rem;
          color: #ffffff;
        }
        .ai-thinking p, .empty-preview p {
          max-width: 320px;
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .sparkles-anim {
          color: var(--primary);
        }
        .extracted-item {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-md);
          padding: 20px;
          transition: border-color 0.2s, background 0.2s;
        }
        .extracted-item.selected {
          border-color: rgba(0, 82, 255, 0.15);
          background: rgba(0, 82, 255, 0.01);
        }
        .extracted-item.editing {
          border-color: var(--primary);
        }
        .item-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px dashed rgba(255, 255, 255, 0.04);
          padding-bottom: 10px;
          margin-bottom: 12px;
        }
        .checkbox-wrapper {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-muted);
        }
        .checkbox-wrapper input {
          cursor: pointer;
        }
        .item-actions {
          display: flex;
          gap: 8px;
        }
        .item-act-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color 0.2s, background 0.2s;
        }
        .item-act-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
        }
        .item-act-btn.delete:hover {
          color: var(--danger);
          background: rgba(255, 23, 68, 0.05);
        }
        .preview-wrapper {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .preview-question-text {
          font-size: 0.95rem;
          font-weight: 600;
          color: #ffffff;
          line-height: 1.4;
        }
        .preview-choices-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .preview-choice {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: var(--radius-sm);
          padding: 8px 12px;
          display: flex;
          gap: 8px;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .preview-choice.correct {
          background: rgba(0, 230, 118, 0.05);
          border-color: rgba(0, 230, 118, 0.2);
          color: var(--success);
        }
        .preview-choice span {
          font-weight: 700;
        }
        .preview-explanation {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-muted);
          border-top: 1px dashed rgba(255, 255, 255, 0.04);
          padding-top: 10px;
        }
        .preview-explanation strong {
          color: var(--primary);
        }
        .preview-explanation p {
          margin-top: 2px;
        }
        .edit-form-wrapper {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .edit-choices-grid {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .choice-edit-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .choice-edit-row .choice-letter {
          width: 20px;
          font-weight: 700;
          color: var(--primary);
          font-size: 0.85rem;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .ai-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
