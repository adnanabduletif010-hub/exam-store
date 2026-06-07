"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { signInWithPopup, signInWithPhoneNumber, RecaptchaVerifier, ConfirmationResult } from "firebase/auth";
import { auth, googleProvider } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { LogIn, Phone, ShieldCheck, Mail, ArrowRight, Loader2, BookOpen, Sparkles, User, ShieldAlert } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, isOnline, mockLogin } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  
  const confirmationResultRef = useRef<ConfirmationResult | null>(null);
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Redirect if user is already logged in
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/");
    }
  }, [user, authLoading, router]);

  // Clean up recaptcha container
  useEffect(() => {
    return () => {
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
        } catch (e) {
          console.error("Error clearing recaptcha", e);
        }
      }
    };
  }, []);

  const setupRecaptcha = () => {
    try {
      if (recaptchaVerifierRef.current) {
        return recaptchaVerifierRef.current;
      }
      
      const verifier = new RecaptchaVerifier(auth, "recaptcha-container", {
        size: "invisible",
        callback: () => {
          console.log("reCAPTCHA resolved");
        },
        "expired-callback": () => {
          setError("reCAPTCHA expired. Please try again.");
          setLoading(false);
        }
      });
      recaptchaVerifierRef.current = verifier;
      return verifier;
    } catch (err: any) {
      console.error("Recaptcha error:", err);
      setError("Failed to initialize safety verifier: " + err.message);
      return null;
    }
  };

  const handleGoogleLogin = async () => {
    if (!isOnline) {
      setError("You are offline. Google Authentication requires an internet connection.");
      return;
    }
    
    setLoading(true);
    setError("");
    try {
      await signInWithPopup(auth, googleProvider);
      // Don't manually push - the useEffect watching `user` will redirect to "/" once auth state fires
    } catch (err: any) {
      console.error(err);
      setError(
        err.message || 
        "Failed to log in with Google. Ensure Google Sign-In is enabled in the Firebase console."
      );
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOnline) {
      setError("You are offline. Phone Authentication requires an internet connection.");
      return;
    }
    
    if (!phoneNumber) {
      setError("Please enter your phone number.");
      return;
    }

    // Format phone number to international E.164 (Ethiopian format +251xxxxxxxxx or generic)
    let formattedPhone = phoneNumber.trim();
    if (formattedPhone.startsWith("0")) {
      formattedPhone = "+251" + formattedPhone.substring(1);
    } else if (!formattedPhone.startsWith("+")) {
      // Default to Ethiopia if no country code provided
      formattedPhone = "+251" + formattedPhone;
    }

    setLoading(true);
    setError("");
    
    const appVerifier = setupRecaptcha();
    if (!appVerifier) {
      setLoading(false);
      return;
    }

    try {
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      confirmationResultRef.current = confirmation;
      setOtpSent(true);
      setLoading(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to send verification code. " + (err.message || "Check format (e.g., +251912345678)"));
      setLoading(false);
      
      // Reset recaptcha
      if (recaptchaVerifierRef.current) {
        try {
          recaptchaVerifierRef.current.clear();
          recaptchaVerifierRef.current = null;
        } catch (e) {
          console.error(e);
        }
      }
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otp) {
      setError("Please enter the 6-digit OTP code.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      if (!confirmationResultRef.current) {
        throw new Error("No verification session found. Please request code again.");
      }
      await confirmationResultRef.current.confirm(otp);
      // Don't manually push - the useEffect watching `user` will redirect to "/" once auth state fires
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Invalid verification code. Please check and try again.");
      setLoading(false);
    }
  };

  const handleBypassLogin = async (role: "student" | "admin") => {
    setLoading(true);
    setError("");
    try {
      await mockLogin(role);
      router.push("/");
    } catch (err: any) {
      setError("Simulation failed: " + err.message);
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="login-loading">
        <Loader2 className="spinner" />
        <p>Loading Exam Store...</p>
        <style jsx>{`
          .login-loading {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            gap: 16px;
            color: var(--text-muted);
          }
          .spinner {
            width: 48px;
            height: 48px;
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

  return (
    <div className="login-container">
      {/* Background glass decorative circles */}
      <div className="bg-glass-circle-1" />
      <div className="bg-glass-circle-2" />

      {/* Invisible Recaptcha Element */}
      <div id="recaptcha-container"></div>
      
      <div className="login-grid">
        <div className="brand-section animate-fade-in">
          <div className="brand-badge badge-blue">
            <BookOpen className="brand-icon" />
            <span>EXAM STORE</span>
          </div>
          <h1 className="brand-title">
            Explore <br />
            <span className="text-glow">Crystalline Studying</span>
          </h1>
          <p className="brand-tagline">
            A premium, offline-first learning system designed for Grade 8 and Grade 12 students. Seamless exam practice, explanations, and AI curation.
          </p>
          <div className="feature-list">
            <div className="feature-item">
              <div className="feature-bullet" />
              <span>Full offline database download</span>
            </div>
            <div className="feature-item">
              <div className="feature-bullet" />
              <span>Grade 7 - 12 national exam structure</span>
            </div>
            <div className="feature-item">
              <div className="feature-bullet" />
              <span>AI ingestion from lecture notes</span>
            </div>
          </div>
        </div>

        <div className="form-section animate-scale-in">
          <div className="form-card glass-panel">
            <div className="form-header">
              <h2>Sign In</h2>
              <p>Choose Google Login, Phone Login, or use our Demo Bypass mode to inspect the app instantly.</p>
            </div>

            {error && (
              <div className="error-alert animate-scale-in">
                <ShieldAlert size={18} />
                <span>{error}</span>
              </div>
            )}

            {!otpSent ? (
              <div className="login-flows">
                {/* Google Authentication */}
                <button
                  type="button"
                  className="social-btn"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                >
                  {loading ? <Loader2 className="spinner" /> : <Mail className="btn-icon" />}
                  <span>Continue with Google</span>
                </button>

                <div className="divider">
                  <span>OR PHONE NUMBER</span>
                </div>

                {/* Phone Number Authentication Form */}
                <form onSubmit={handleSendOtp} className="phone-form">
                  <div className="input-group">
                    <label htmlFor="phoneNumber">Phone Number</label>
                    <div className="input-wrapper">
                      <Phone className="input-icon" />
                      <input
                        id="phoneNumber"
                        type="tel"
                        placeholder="E.g., +251912345678"
                        className="input-field"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        disabled={loading}
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn-primary form-submit" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="spinner" /> Verification sending...
                      </>
                    ) : (
                      <>
                        Request OTP SMS <ArrowRight size={18} />
                      </>
                    )}
                  </button>
                </form>

                {/* Bypasses Demo Logins */}
                <div className="divider">
                  <span>TEST SIMULATION MODE</span>
                </div>

                <div className="demo-actions">
                  <button
                    type="button"
                    onClick={() => handleBypassLogin("student")}
                    className="btn-secondary btn-demo"
                    disabled={loading}
                  >
                    <User size={16} /> Bypassing as Student
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBypassLogin("admin")}
                    className="btn-secondary btn-demo"
                    disabled={loading}
                  >
                    <Sparkles size={16} /> Bypassing as Admin
                  </button>
                </div>
              </div>
            ) : (
              /* OTP Verification Form */
              <form onSubmit={handleVerifyOtp} className="otp-form animate-scale-in">
                <div className="input-group">
                  <label htmlFor="otp">Enter OTP Code</label>
                  <p className="otp-instructions">
                    We sent a 6-digit verification code to <strong>{phoneNumber}</strong>.
                  </p>
                  <div className="input-wrapper">
                    <ShieldCheck className="input-icon" />
                    <input
                      id="otp"
                      type="text"
                      maxLength={6}
                      placeholder="E.g. 123456"
                      className="input-field otp-input"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      disabled={loading}
                    />
                  </div>
                </div>
                
                <div className="otp-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => {
                      setOtpSent(false);
                      setOtp("");
                      setError("");
                    }}
                    disabled={loading}
                  >
                    Back
                  </button>
                  <button type="submit" className="btn-primary" disabled={loading}>
                    {loading ? (
                      <>
                        <Loader2 className="spinner" /> Verifying...
                      </>
                    ) : (
                      <>
                        Verify Code <LogIn size={18} />
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .login-container {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
          position: relative;
        }
        
        /* Crystalline blur spheres in background */
        .bg-glass-circle-1 {
          position: absolute;
          width: 350px;
          height: 350px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(0, 82, 255, 0.15) 0%, transparent 70%);
          top: 15%;
          right: 15%;
          z-index: -1;
          filter: blur(50px);
        }
        
        .bg-glass-circle-2 {
          position: absolute;
          width: 400px;
          height: 400px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(147, 51, 234, 0.08) 0%, transparent 70%);
          bottom: 10%;
          left: 10%;
          z-index: -1;
          filter: blur(60px);
        }

        .login-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 64px;
          max-width: 1100px;
          width: 100%;
          align-items: center;
        }
        .brand-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .brand-badge {
          display: flex;
          align-items: center;
          gap: 8px;
          font-weight: 800;
          font-size: 0.8rem;
          letter-spacing: 0.15em;
          width: fit-content;
        }
        .brand-icon {
          width: 18px;
          height: 18px;
        }
        .brand-title {
          font-size: 3.2rem;
          font-weight: 800;
          line-height: 1.15;
          color: #ffffff;
        }
        .text-glow {
          background: linear-gradient(135deg, #4d88ff 0%, #0052ff 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          text-shadow: 0 0 35px rgba(0, 82, 255, 0.25);
        }
        .brand-tagline {
          font-size: 1.1rem;
          line-height: 1.6;
          color: var(--text-muted);
        }
        .feature-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 8px;
        }
        .feature-item {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text-main);
          font-size: 0.95rem;
          font-weight: 500;
        }
        .feature-bullet {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--primary);
          box-shadow: 0 0 8px var(--primary);
        }
        .form-section {
          display: flex;
          justify-content: center;
        }
        .form-card {
          width: 100%;
          max-width: 450px;
          padding: 40px;
          border-radius: var(--radius-lg);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .form-header {
          margin-bottom: 24px;
        }
        .form-header h2 {
          font-size: 1.7rem;
          font-weight: 800;
          margin-bottom: 8px;
          color: #ffffff;
        }
        .form-header p {
          color: var(--text-muted);
          font-size: 0.85rem;
          line-height: 1.5;
        }
        .error-alert {
          background: rgba(255, 23, 68, 0.08);
          border: 1px solid rgba(255, 23, 68, 0.2);
          color: var(--danger);
          padding: 12px 16px;
          border-radius: var(--radius-md);
          font-size: 0.85rem;
          margin-bottom: 20px;
          display: flex;
          align-items: center;
          gap: 8px;
          line-height: 1.4;
        }
        .login-flows {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .social-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-md);
          padding: 12px;
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--text-main);
          cursor: pointer;
          transition: background var(--transition-fast), border-color var(--transition-fast), transform var(--transition-fast);
        }
        .social-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.15);
          transform: translateY(-1px);
        }
        .social-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-icon {
          width: 18px;
          height: 18px;
        }
        .divider {
          display: flex;
          align-items: center;
          text-align: center;
          color: rgba(255, 255, 255, 0.12);
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.15em;
          margin: 4px 0;
        }
        .divider::before,
        .divider::after {
          content: '';
          flex: 1;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }
        .divider span {
          padding: 0 10px;
        }
        .phone-form, .otp-form {
          display: flex;
          flex-direction: column;
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
        .input-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }
        .input-icon {
          position: absolute;
          left: 16px;
          width: 16px;
          height: 16px;
          color: var(--text-muted);
          pointer-events: none;
        }
        .input-field {
          padding-left: 44px;
        }
        .form-submit {
          width: 100%;
        }
        .demo-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .otp-instructions {
          font-size: 0.8rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin-bottom: 4px;
        }
        .otp-input {
          text-align: center;
          letter-spacing: 0.35em;
          font-weight: 700;
          font-size: 1.25rem;
          padding-left: 16px; /* Reset icon padding center offset */
        }
        .otp-input::placeholder {
          letter-spacing: normal;
          font-weight: 400;
        }
        .otp-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 10px;
        }
        .otp-actions :global(button) {
          flex: 1;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 900px) {
          .login-grid {
            grid-template-columns: 1fr;
            gap: 48px;
            max-width: 500px;
          }
          .brand-section {
            text-align: center;
            align-items: center;
          }
          .brand-title {
            font-size: 2.4rem;
          }
          .feature-list {
            align-items: center;
          }
        }
      `}</style>
    </div>
  );
}
