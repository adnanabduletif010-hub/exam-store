"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { saveQuestionsOffline, Question } from "@/lib/offlineDb";
import { MOCK_QUESTIONS } from "@/lib/mockData";
import { GraduationCap, LogOut, ArrowRight, Loader2, RefreshCw, AlertCircle, Sparkles } from "lucide-react";

export default function RootPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, logout, updateProfile, isOnline } = useAuth();
  
  const [selectedCategory, setSelectedCategory] = useState<"grade_8" | "grade_12" | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [error, setError] = useState("");

  // Determine redirection or initialization
  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        router.push("/login");
      } else if (profile) {
        if (profile.role === "admin") {
          router.push("/admin");
        } else if (profile.role === "student" && (profile as any).gradeCategory) {
          router.push("/practice");
        }
      }
    }
  }, [user, profile, authLoading, router]);

  const handleSelectCategory = async (category: "grade_8" | "grade_12") => {
    setSelectedCategory(category);
    setError("");
    
    if (user && user.uid.startsWith("mock-")) {
      setSyncing(true);
      setSyncProgress(20);
      setTimeout(async () => {
        setSyncProgress(60);
        const mockList = MOCK_QUESTIONS.filter((q) => q.gradeCategory === category);
        await saveQuestionsOffline(mockList);
        setSyncProgress(90);
        await updateProfile({ gradeCategory: category } as any);
        setSyncProgress(100);
        setTimeout(() => {
          router.push("/practice");
        }, 500);
      }, 800);
      return;
    }
    
    if (!isOnline) {
      setError("An internet connection is required for the initial setup to download your practice questions.");
      return;
    }

    setSyncing(true);
    setSyncProgress(10); // Started

    try {
      // 1. Fetch questions matching the selected category
      const q = query(
        collection(db, "questions"),
        where("gradeCategory", "==", category)
      );
      
      setSyncProgress(30); // Querying
      const querySnapshot = await getDocs(q);
      
      setSyncProgress(60); // Fetched, preparing to cache
      const questionsList: Question[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        questionsList.push({
          id: docSnap.id,
          ...data,
        } as Question);
      });

      // 2. Cache offline
      await saveQuestionsOffline(questionsList);
      setSyncProgress(90); // Cached locally

      // 3. Update student profile in Firebase & offline
      await updateProfile({ gradeCategory: category } as any);
      
      setSyncProgress(100); // Fully finished
      setTimeout(() => {
        router.push("/practice");
      }, 500);
    } catch (err: any) {
      console.error("Error setting up student category and syncing questions:", err);
      setError("Setup failed: " + (err.message || "Failed to download materials."));
      setSyncing(false);
      setSyncProgress(0);
    }
  };

  // Show a loading spinner only while:
  // 1. Auth is still resolving
  // 2. User is logged in but profile hasn't arrived yet (brief Firestore fetch)
  // 3. A redirect is imminent (admin or student w/ gradeCategory already set) - unless syncing (has its own UI)
  const isRedirecting =
    profile &&
    !syncing &&
    (profile.role === "admin" ||
      (profile.role === "student" && (profile as any).gradeCategory));

  if (authLoading || (user && !profile) || isRedirecting) {
    return (
      <div className="fullscreen-loading">
        <Loader2 className="spinner" />
        <p>Verifying authentication...</p>
        <style jsx>{`
          .fullscreen-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 16px;
            color: var(--text-muted);
          }
          .spinner {
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            color: var(--primary);
          }
          @keyframes spin {
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Render Category Choice Screen
  return (
    <div className="choice-container animate-fade-in">
      <header className="choice-header">
        <div className="header-brand">
          <GraduationCap className="logo" />
          <span>Exam Store</span>
        </div>
        <button onClick={logout} className="logout-btn">
          <LogOut size={16} /> Sign Out
        </button>
      </header>

      <main className="choice-main">
        {syncing ? (
          /* Caching Questions progress UI */
          <div className="sync-card glass-panel animate-scale-in">
            <RefreshCw className="sync-icon spinner" />
            <h2>Downloading Materials</h2>
            <p>We are configuring your study portal and caching all questions for offline use. Do not close this page.</p>
            
            <div className="progress-bar-container">
              <div className="progress-bar-fill" style={{ width: `${syncProgress}%` }} />
            </div>
            <span className="progress-percent">{syncProgress}% Completed</span>
          </div>
        ) : (
          /* Class Choice Panel */
          <div className="choice-box">
            <div className="title-section">
              <h1>Select Your Grade Category</h1>
              <p>Choose the level of education you want to study. This loads all chapters, units, and offline mock exams for your category.</p>
            </div>

            {error && (
              <div className="error-box animate-scale-in">
                <AlertCircle size={20} />
                <span>{error}</span>
              </div>
            )}

            <div className="cards-grid">
              {/* Grade 8 Category */}
              <div 
                className="category-card glass-panel"
                onClick={() => handleSelectCategory("grade_8")}
              >
                <div className="card-badge">GRADES 7 - 8</div>
                <h3>Grade 8 Prep</h3>
                <p>Includes complete syllabus and practice questionnaires for Grade 7 and Grade 8 curriculum.</p>
                <div className="card-footer">
                  <span>Get Started</span>
                  <ArrowRight size={18} className="arrow" />
                </div>
              </div>

              {/* Grade 12 Category */}
              <div 
                className="category-card glass-panel"
                onClick={() => handleSelectCategory("grade_12")}
              >
                <div className="card-badge badge-blue">GRADES 9 - 12</div>
                <h3>Grade 12 Prep</h3>
                <p>Includes complete syllabus and university entrance exam questionnaires for Grades 9, 10, 11, and 12.</p>
                <div className="card-footer">
                  <span>Get Started</span>
                  <ArrowRight size={18} className="arrow" />
                </div>
              </div>
            </div>

            <div className="admin-shortcut">
              <Sparkles size={16} className="spark-icon" />
              <span>Logged in as <strong>{profile?.email || profile?.phoneNumber || "Student"}</strong>.</span>
              {profile?.role === "admin" && (
                <button onClick={() => router.push("/admin")} className="admin-btn">
                  Go to Admin Panel
                </button>
              )}
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .choice-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
        }
        .choice-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto 40px auto;
        }
        .header-brand {
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 800;
          font-size: 1.3rem;
          color: #ffffff;
        }
        .logo {
          width: 32px;
          height: 32px;
          color: var(--primary);
        }
        .logout-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(255, 23, 68, 0.05);
          border: 1px solid rgba(255, 23, 68, 0.15);
          color: var(--danger);
          padding: 8px 16px;
          border-radius: var(--radius-sm);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .logout-btn:hover {
          background: rgba(255, 23, 68, 0.15);
          border-color: var(--danger);
        }
        .choice-main {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
        }
        .choice-box {
          max-width: 800px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }
        .title-section {
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .title-section h1 {
          font-size: 2.6rem;
          font-weight: 800;
          color: #ffffff;
        }
        .title-section p {
          color: var(--text-muted);
          font-size: 1.05rem;
          line-height: 1.6;
        }
        .error-box {
          background: rgba(255, 23, 68, 0.1);
          border: 1px solid rgba(255, 23, 68, 0.2);
          color: var(--danger);
          padding: 16px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 0.9rem;
        }
        .cards-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }
        .category-card {
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 20px;
          cursor: pointer;
        }
        .card-badge {
          background: rgba(255, 214, 0, 0.15);
          color: #ffd600;
          border: 1px solid rgba(255, 214, 0, 0.25);
          padding: 4px 12px;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.05em;
        }
        .card-badge.badge-blue {
          background: rgba(0, 82, 255, 0.15);
          color: #4d88ff;
          border: 1px solid rgba(0, 82, 255, 0.25);
        }
        .category-card h3 {
          font-size: 1.6rem;
          font-weight: 700;
          color: #ffffff;
        }
        .category-card p {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.5;
          flex: 1;
        }
        .card-footer {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary);
          font-weight: 600;
          font-size: 0.95rem;
          transition: gap 0.2s;
        }
        .category-card:hover .card-footer {
          gap: 14px;
        }
        .admin-shortcut {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          color: var(--text-muted);
          font-size: 0.85rem;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 24px;
        }
        .spark-icon {
          color: var(--primary);
        }
        .admin-btn {
          background: var(--primary);
          color: #ffffff;
          border: none;
          border-radius: var(--radius-sm);
          padding: 4px 12px;
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          margin-left: 8px;
        }
        .admin-btn:hover {
          background: var(--primary-hover);
        }
        .sync-card {
          max-width: 450px;
          width: 100%;
          padding: 40px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          gap: 20px;
        }
        .sync-icon {
          width: 48px;
          height: 48px;
          color: var(--primary);
        }
        .sync-card h2 {
          font-size: 1.6rem;
          color: #ffffff;
        }
        .sync-card p {
          color: var(--text-muted);
          font-size: 0.9rem;
          line-height: 1.5;
        }
        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          overflow: hidden;
          margin-top: 10px;
        }
        .progress-bar-fill {
          height: 100%;
          background: var(--primary);
          box-shadow: 0 0 10px var(--primary);
          transition: width 0.3s ease;
        }
        .progress-percent {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--primary);
        }
        .spinner {
          animation: spin 2s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .cards-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
          .title-section h1 {
            font-size: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
