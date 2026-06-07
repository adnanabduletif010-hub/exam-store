"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, doc, writeBatch, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  ArrowLeft, Sparkles, Loader2, AlertCircle,
  CheckCircle2, Trash2, Edit3, Save, Check, FileText
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
  const { user, profile, loading: authLoading } = useAuth();

  const [gradeCategory, setGradeCategory] = useState<"grade_8" | "grade_12">("grade_8");
  const [specificGrade, setSpecificGrade] = useState("8");
  const [subject, setSubject] = useState("");
  const [unit, setUnit] = useState("1");
  const [chapterTitle, setChapterTitle] = useState("");
  const [aiModel, setAiModel] = useState("gemini-2.0-flash");
  const [textContent, setTextContent] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const [extracting, setExtracting] = useState(false);
  const [extractedQuestions, setExtractedQuestions] = useState<ExtractedQuestion[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!user) router.push("/login");
      else if (profile && profile.role !== "admin") router.push("/practice");
    }
  }, [user, profile, authLoading, router]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "txt") {
      setErrorMsg("Only .txt files are supported. For PDF/DOCX, please copy-paste the text below.");
      return;
    }
    setFile(f);
    setErrorMsg("");
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!textContent.trim() && !file) {
      setErrorMsg("Please paste your lecture text or upload a .txt file.");
      return;
    }
    if (!subject.trim()) {
      setErrorMsg("Please enter a subject name.");
      return;
    }

    setExtracting(true);
    setExtractedQuestions([]);

    try {
      const formData = new FormData();
      if (textContent.trim()) {
        formData.append("text", textContent.trim());
      } else if (file) {
        formData.append("file", file);
      }
      formData.append("model", aiModel);

      const res = await fetch("/api/ai/extract", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to process.");

      const formatted: ExtractedQuestion[] = data.questions.map((q: any, idx: number) => ({
        tempId: `temp-${idx}`,
        question: q.question,
        choices: q.choices,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        selected: true,
      }));

      setExtractedQuestions(formatted);
      setSuccessMsg(`✅ Extracted ${formatted.length} questions! Review and edit below, then import.`);
    } catch (err: any) {
      setErrorMsg("AI Extraction failed: " + err.message);
    } finally {
      setExtracting(false);
    }
  };

  const handleEditField = (index: number, field: string, value: any) => {
    setExtractedQuestions(prev => {
      const list = [...prev];
      if (field.startsWith("choice-")) {
        list[index].choices[parseInt(field.split("-")[1])] = value;
      } else {
        (list[index] as any)[field] = value;
      }
      return list;
    });
  };

  const handleImport = async () => {
    setErrorMsg("");
    setSuccessMsg("");
    const selected = extractedQuestions.filter(q => q.selected);
    if (selected.length === 0) {
      setErrorMsg("Select at least one question to import.");
      return;
    }

    setImporting(true);
    try {
      const batch = writeBatch(db);
      const colRef = collection(db, "questions");
      selected.forEach(q => {
        const ref = doc(colRef);
        batch.set(ref, {
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
      setSuccessMsg(`✅ Imported ${selected.length} questions into Grade ${specificGrade} ${subject}!`);
      setExtractedQuestions([]);
      setTextContent("");
      setFile(null);
    } catch (err: any) {
      setErrorMsg("Import failed: " + err.message);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="ai-page animate-fade-in">
      <header className="ai-header glass-panel">
        <button onClick={() => router.push("/admin")} className="back-btn">
          <ArrowLeft size={16} /> Back to Dashboard
        </button>
        <div className="header-title">
          <Sparkles size={20} className="spark" />
          <h2>AI Question Generator</h2>
          <span className="badge-vercel">Powered by Vercel + Gemini</span>
        </div>
      </header>

      <div className="ai-layout">
        {/* LEFT: Config + Input */}
        <div className="config-card glass-panel">
          <h3>Input & Settings</h3>
          <p className="subtitle">Paste lecture text or upload a .txt file. Gemini AI will extract practice questions automatically.</p>

          <form onSubmit={handleExtract} className="ai-form">
            {/* Grade & Subject */}
            <div className="grid-2">
              <div className="input-group">
                <label>Grade Category</label>
                <select className="select-field" value={gradeCategory}
                  onChange={e => { const c = e.target.value as any; setGradeCategory(c); setSpecificGrade(c === "grade_8" ? "8" : "12"); }}>
                  <option value="grade_8">Grade 8 (7–8)</option>
                  <option value="grade_12">Grade 12 (9–12)</option>
                </select>
              </div>
              <div className="input-group">
                <label>Grade Level</label>
                <select className="select-field" value={specificGrade} onChange={e => setSpecificGrade(e.target.value)}>
                  {gradeCategory === "grade_8"
                    ? (<><option value="7">Grade 7</option><option value="8">Grade 8</option></>)
                    : (<><option value="9">Grade 9</option><option value="10">Grade 10</option><option value="11">Grade 11</option><option value="12">Grade 12</option></>)
                  }
                </select>
              </div>
            </div>

            <div className="grid-2">
              <div className="input-group">
                <label>Subject</label>
                <input className="input-field" type="text" placeholder="e.g. Biology, Physics"
                  value={subject} onChange={e => setSubject(e.target.value)} />
              </div>
              <div className="input-group">
                <label>Unit / Chapter</label>
                <input className="input-field" type="number" placeholder="1"
                  value={unit} onChange={e => setUnit(e.target.value)} />
              </div>
            </div>

            <div className="input-group">
              <label>Chapter Title (optional)</label>
              <input className="input-field" type="text" placeholder="e.g. Cell Biology"
                value={chapterTitle} onChange={e => setChapterTitle(e.target.value)} />
            </div>

            <div className="input-group">
              <label>AI Model</label>
              <select className="select-field" value={aiModel} onChange={e => setAiModel(e.target.value)}>
                <option value="gemini-2.0-flash">⚡ Gemini 2.0 Flash (Recommended)</option>
                <option value="gemini-2.0-flash-lite">🔋 Gemini 2.0 Flash Lite (Fastest)</option>
                <option value="gemini-2.5-flash-preview-05-20">🧠 Gemini 2.5 Flash Preview (Best)</option>
              </select>
            </div>

            {/* Text Input */}
            <div className="input-group">
              <label>Paste Lecture Text</label>
              <textarea className="textarea-field" rows={8}
                placeholder="Paste your lecture notes, textbook content, or any educational text here..."
                value={textContent} onChange={e => setTextContent(e.target.value)} />
            </div>

            <div className="divider"><span>OR UPLOAD .TXT FILE</span></div>

            <div className="input-group">
              <label htmlFor="txt-file" className="file-label">
                <FileText size={16} />
                {file ? file.name : "Click to upload .txt file"}
              </label>
              <input id="txt-file" type="file" accept=".txt" className="hidden" onChange={handleFileChange} />
            </div>

            <button type="submit" className="btn-primary submit-btn" disabled={extracting}>
              {extracting ? <><Loader2 className="spinner" size={16} /> Gemini is thinking...</> : <><Sparkles size={16} /> Extract Questions via AI</>}
            </button>
          </form>
        </div>

        {/* RIGHT: Results */}
        <div className="results-card glass-panel">
          <div className="results-header">
            <h3>Extracted Questions</h3>
            {extractedQuestions.length > 0 && (
              <button className="btn-primary import-btn" onClick={handleImport} disabled={importing}>
                {importing ? <Loader2 className="spinner" size={14} /> : <Check size={14} />}
                Import ({extractedQuestions.filter(q => q.selected).length})
              </button>
            )}
          </div>

          {errorMsg && <div className="alert alert-error"><AlertCircle size={15} />{errorMsg}</div>}
          {successMsg && <div className="alert alert-success"><CheckCircle2 size={15} />{successMsg}</div>}

          {extracting && (
            <div className="thinking-state">
              <Sparkles size={36} className="spinner spark-big" />
              <h4>Gemini AI is reading...</h4>
              <p>Designing multiple-choice questions from your content. Usually takes 5–15 seconds.</p>
            </div>
          )}

          {extractedQuestions.length === 0 && !extracting && !errorMsg && (
            <div className="empty-state">
              <Sparkles size={40} className="empty-icon" />
              <p>Paste your content on the left and click Extract. Questions will appear here for review.</p>
            </div>
          )}

          <div className="questions-list">
            {extractedQuestions.map((q, i) => (
              <div key={q.tempId} className={`q-card ${q.selected ? "selected" : "unselected"}`}>
                <div className="q-card-top">
                  <input type="checkbox" checked={q.selected}
                    onChange={() => setExtractedQuestions(prev => prev.map((x, xi) => xi === i ? { ...x, selected: !x.selected } : x))} />
                  <span className="q-num">Q{i + 1}</span>
                  <div className="q-actions">
                    <button className="icon-btn" onClick={() => setEditingIndex(editingIndex === i ? null : i)}>
                      {editingIndex === i ? <Save size={14} /> : <Edit3 size={14} />}
                    </button>
                    <button className="icon-btn danger" onClick={() => setExtractedQuestions(prev => prev.filter((_, xi) => xi !== i))}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {editingIndex === i ? (
                  <div className="edit-form">
                    <textarea className="textarea-field" rows={3} value={q.question}
                      onChange={e => handleEditField(i, "question", e.target.value)} />
                    {q.choices.map((c, ci) => (
                      <div key={ci} className="choice-edit">
                        <span className={`choice-letter ${q.correctAnswer === ci ? "correct" : ""}`}>{["A","B","C","D"][ci]}</span>
                        <input className="input-field" value={c} onChange={e => handleEditField(i, `choice-${ci}`, e.target.value)} />
                        <button className="icon-btn small" onClick={() => handleEditField(i, "correctAnswer", ci)}
                          title="Mark correct">{q.correctAnswer === ci ? "✅" : "○"}</button>
                      </div>
                    ))}
                    <textarea className="textarea-field" rows={2} placeholder="Explanation"
                      value={q.explanation} onChange={e => handleEditField(i, "explanation", e.target.value)} />
                  </div>
                ) : (
                  <div className="q-preview">
                    <p className="q-text">{q.question}</p>
                    <div className="choices-preview">
                      {q.choices.map((c, ci) => (
                        <div key={ci} className={`choice-row ${q.correctAnswer === ci ? "correct-choice" : ""}`}>
                          <span>{["A","B","C","D"][ci]}.</span> {c}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .ai-page { min-height: 100vh; padding: 24px; display: flex; flex-direction: column; gap: 24px; }
        .ai-header { display: flex; align-items: center; gap: 20px; padding: 16px 24px; border-radius: var(--radius-md); flex-wrap: wrap; }
        .header-title { display: flex; align-items: center; gap: 10px; margin-left: auto; }
        .header-title h2 { font-size: 1.2rem; font-weight: 700; color: #fff; margin: 0; }
        .spark { color: var(--primary); }
        .badge-vercel { background: rgba(0,82,255,0.15); border: 1px solid rgba(0,82,255,0.3); color: #4d88ff; font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 50px; letter-spacing: 0.05em; }
        .back-btn { display: flex; align-items: center; gap: 6px; background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); color: var(--text-muted); padding: 8px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .back-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .ai-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; flex: 1; }
        .config-card, .results-card { padding: 28px; border-radius: var(--radius-lg); display: flex; flex-direction: column; gap: 20px; }
        .config-card h3, .results-card h3 { font-size: 1.1rem; font-weight: 700; color: #fff; margin: 0; }
        .subtitle { color: var(--text-muted); font-size: 0.85rem; line-height: 1.5; margin: -12px 0 0 0; }
        .ai-form { display: flex; flex-direction: column; gap: 16px; }
        .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); }
        .textarea-field { background: rgba(255,255,255,0.03); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 12px; color: var(--text-main); font-size: 0.9rem; resize: vertical; font-family: inherit; }
        .textarea-field:focus { outline: none; border-color: var(--primary); }
        .file-label { display: flex; align-items: center; gap: 8px; background: rgba(255,255,255,0.03); border: 1px dashed var(--glass-border); border-radius: var(--radius-sm); padding: 12px 16px; color: var(--text-muted); font-size: 0.85rem; cursor: pointer; transition: all 0.2s; }
        .file-label:hover { border-color: var(--primary); color: var(--primary); }
        .hidden { display: none; }
        .submit-btn { display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 4px; }
        .divider { display: flex; align-items: center; text-align: center; color: rgba(255,255,255,0.12); font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; }
        .divider::before, .divider::after { content: ''; flex: 1; border-bottom: 1px solid rgba(255,255,255,0.06); }
        .divider span { padding: 0 10px; }
        .results-header { display: flex; align-items: center; justify-content: space-between; }
        .import-btn { display: flex; align-items: center; gap: 6px; font-size: 0.85rem; padding: 8px 16px; }
        .alert { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: var(--radius-sm); font-size: 0.85rem; }
        .alert-error { background: rgba(255,23,68,0.08); border: 1px solid rgba(255,23,68,0.2); color: var(--danger); }
        .alert-success { background: rgba(0,200,83,0.08); border: 1px solid rgba(0,200,83,0.2); color: #00c853; }
        .thinking-state, .empty-state { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; padding: 40px 20px; color: var(--text-muted); }
        .thinking-state h4 { color: #fff; font-size: 1.1rem; }
        .spark-big { color: var(--primary); }
        .empty-icon { color: rgba(255,255,255,0.1); }
        .questions-list { display: flex; flex-direction: column; gap: 12px; max-height: 65vh; overflow-y: auto; padding-right: 4px; }
        .q-card { border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 16px; display: flex; flex-direction: column; gap: 12px; transition: border-color 0.2s; }
        .q-card.selected { border-color: rgba(0,82,255,0.3); background: rgba(0,82,255,0.04); }
        .q-card.unselected { opacity: 0.5; }
        .q-card-top { display: flex; align-items: center; gap: 10px; }
        .q-num { font-size: 0.75rem; font-weight: 700; color: var(--primary); background: rgba(0,82,255,0.1); padding: 2px 8px; border-radius: 50px; }
        .q-actions { margin-left: auto; display: flex; gap: 6px; }
        .icon-btn { background: rgba(255,255,255,0.04); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 5px 8px; cursor: pointer; color: var(--text-muted); transition: all 0.2s; }
        .icon-btn:hover { background: rgba(255,255,255,0.1); color: #fff; }
        .icon-btn.danger:hover { background: rgba(255,23,68,0.1); color: var(--danger); border-color: var(--danger); }
        .q-text { color: var(--text-main); font-size: 0.9rem; line-height: 1.5; }
        .choices-preview { display: flex; flex-direction: column; gap: 4px; }
        .choice-row { font-size: 0.82rem; color: var(--text-muted); padding: 4px 8px; border-radius: 4px; display: flex; gap: 6px; }
        .correct-choice { color: #00c853; background: rgba(0,200,83,0.08); }
        .edit-form { display: flex; flex-direction: column; gap: 8px; }
        .choice-edit { display: flex; align-items: center; gap: 8px; }
        .choice-letter { width: 22px; height: 22px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; font-size: 0.72rem; font-weight: 700; flex-shrink: 0; }
        .choice-letter.correct { background: rgba(0,200,83,0.2); color: #00c853; }
        .icon-btn.small { padding: 3px 6px; font-size: 0.75rem; }
        .spinner { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @media (max-width: 900px) {
          .ai-layout { grid-template-columns: 1fr; }
          .header-title { margin-left: 0; }
        }
      `}</style>
    </div>
  );
}
