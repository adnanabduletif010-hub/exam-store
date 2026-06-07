"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { collection, query, where, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  CreditCard, Smartphone, Check, ArrowLeft, Loader2, 
  Send, AlertCircle, Clock, CheckCircle2, XCircle, RefreshCw
} from "lucide-react";
import { MOCK_PAYMENTS, MOCK_METHODS } from "@/lib/mockData";

interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
  isActive: boolean;
}

interface PaymentRecord {
  id: string;
  method: string;
  transactionId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
}

export default function PaymentPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, isOnline } = useAuth();
  
  // Data lists
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loadingMethods, setLoadingMethods] = useState(true);
  const [previousPayments, setPreviousPayments] = useState<PaymentRecord[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(true);

  // Form inputs
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [transactionId, setTransactionId] = useState("");
  const [amount, setAmount] = useState("150"); // Default standard price
  const [phone, setPhone] = useState("");
  
  // Status states
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Redirect if logged out
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  // Set default phone
  useEffect(() => {
    if (profile?.phoneNumber) {
      setPhone(profile.phoneNumber);
    }
  }, [profile]);

  // Load Payment Methods from Firestore (with fallbacks if empty)
  const fetchPaymentMethods = async () => {
    if (!isOnline) {
      setLoadingMethods(false);
      return;
    }
    try {
      const querySnapshot = await getDocs(collection(db, "paymentMethods"));
      const list: PaymentMethod[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isActive) {
          list.push({ id: docSnap.id, ...data } as PaymentMethod);
        }
      });

      if (list.length === 0) {
        // Fallbacks for testing
        const fallbacks: PaymentMethod[] = [
          {
            id: "fallback-ebirr",
            name: "e-Birr",
            accountNumber: "*847*2*1*912345678*150#",
            accountHolder: "Exam Store Education",
            instructions: "Dial *847# on your mobile, select Merchant Payment, enter Merchant ID 912345678, specify the amount, or dial the quick code shown above.",
            isActive: true,
          },
          {
            id: "fallback-cbe",
            name: "Commercial Bank of Ethiopia (CBE)",
            accountNumber: "1000492837261",
            accountHolder: "Exam Store Corp.",
            instructions: "Transfer the amount via CBE Birr mobile app or bank transfer to the account number above. Keep the Transaction Reference ID.",
            isActive: true,
          }
        ];
        setMethods(fallbacks);
        setSelectedMethod(fallbacks[0]);
      } else {
        setMethods(list);
        setSelectedMethod(list[0]);
      }
    } catch (err) {
      console.error("Error loading payment methods:", err);
    } finally {
      setLoadingMethods(false);
    }
  };

  // Load Previous Payments submitted by this user
  const fetchPreviousPayments = async () => {
    if (!user) {
      setLoadingPayments(false);
      return;
    }
    
    if (user.uid.startsWith("mock-")) {
      const cached = localStorage.getItem("mock_payments");
      if (cached) {
        setPreviousPayments(JSON.parse(cached));
      } else {
        const filtered = MOCK_PAYMENTS.filter((p) => p.userId === user.uid) as PaymentRecord[];
        setPreviousPayments(filtered);
      }
      setLoadingPayments(false);
      return;
    }
    if (!isOnline) {
      setLoadingPayments(false);
      return;
    }

    try {
      const q = query(
        collection(db, "payments"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const list: PaymentRecord[] = [];
      querySnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as PaymentRecord);
      });
      // Sort newest first
      list.sort((a, b) => {
        const t1 = a.createdAt?.seconds || 0;
        const t2 = b.createdAt?.seconds || 0;
        return t2 - t1;
      });
      setPreviousPayments(list);
    } catch (err) {
      console.error("Error loading previous payments:", err);
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPaymentMethods();
      fetchPreviousPayments();
    }
  }, [user, isOnline]);

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    if (!isOnline) {
      setErrorMsg("An active internet connection is required to submit payment details.");
      return;
    }

    if (!selectedMethod) {
      setErrorMsg("Please select a payment method.");
      return;
    }

    if (!transactionId.trim()) {
      setErrorMsg("Please enter the Transaction Reference ID / Reference Number.");
      return;
    }

    if (!phone.trim()) {
      setErrorMsg("Please enter your contact phone number.");
      return;
    }

    setSubmitting(true);

    if (user && user.uid.startsWith("mock-")) {
      const newRecord = {
        id: `mock-pay-${Date.now()}`,
        userId: user.uid,
        userName: profile?.displayName || "Student",
        userPhone: phone.trim(),
        method: selectedMethod.name,
        transactionId: transactionId.trim(),
        amount: parseFloat(amount) || 150,
        status: "pending" as const,
        createdAt: { seconds: Math.floor(Date.now() / 1000) }
      };

      const updated = [newRecord, ...previousPayments];
      setPreviousPayments(updated);
      localStorage.setItem("mock_payments", JSON.stringify(updated));

      const globalPayments = localStorage.getItem("mock_global_payments");
      const parsedGlobal = globalPayments ? JSON.parse(globalPayments) : MOCK_PAYMENTS;
      localStorage.setItem("mock_global_payments", JSON.stringify([newRecord, ...parsedGlobal]));

      setSuccessMsg("Payment submission successful (Simulation)! The administration team will verify your transaction shortly.");
      setTransactionId("");
      setSubmitting(false);
      return;
    }

    try {
      await addDoc(collection(db, "payments"), {
        userId: user!.uid,
        userName: profile?.displayName || "Student",
        userPhone: phone.trim(),
        method: selectedMethod.name,
        transactionId: transactionId.trim(),
        amount: parseFloat(amount) || 150,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setSuccessMsg("Payment submission successful! The administration team will verify your transaction shortly.");
      setTransactionId("");
      await fetchPreviousPayments();
    } catch (err: any) {
      console.error("Error submitting payment proof:", err);
      setErrorMsg("Submission failed: " + (err.message || "Network error."));
    } finally {
      setSubmitting(false);
    }
  };

  if (authLoading || !profile) {
    return (
      <div className="payment-loading">
        <Loader2 className="spinner" />
        <p>Loading Billing Portal...</p>
        <style jsx>{`
          .payment-loading {
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
    <div className="payment-container animate-fade-in">
      <header className="payment-header">
        <button onClick={() => router.push("/practice")} className="back-btn">
          <ArrowLeft size={16} /> Back to Practice
        </button>
        <h2>Upgrade to Premium</h2>
      </header>

      <main className="payment-main">
        {profile.isPaid ? (
          /* Premium Already Unlocked UI */
          <div className="premium-active-card glass-panel text-center">
            <CheckCircle2 size={64} className="success-icon animate-scale-in" />
            <h1>Premium Access Unlocked!</h1>
            <p>Congratulations! You have complete access to all subjects, grades, units, and chapters offline. Happy studying!</p>
            <button onClick={() => router.push("/practice")} className="btn-primary">
              Start Studying Now
            </button>
          </div>
        ) : (
          <div className="payment-grid">
            {/* Payment submission form */}
            <div className="form-card-column">
              <form onSubmit={handleSubmitPayment} className="payment-form glass-panel">
                <h3>Submit Transaction Details</h3>
                <p className="form-subtitle">Make a transfer using your preferred method below, then paste the reference number here.</p>

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

                {/* Choose Method toggle cards */}
                <div className="method-cards-row">
                  {methods.map((method) => {
                    const isSelected = selectedMethod?.id === method.id;
                    return (
                      <div
                        key={method.id}
                        className={`method-toggle-card ${isSelected ? "active" : ""}`}
                        onClick={() => setSelectedMethod(method)}
                      >
                        <div className="radio-circle">
                          {isSelected && <div className="radio-dot" />}
                        </div>
                        <div className="method-info">
                          <h4>{method.name}</h4>
                          <span>{method.accountNumber.length > 20 ? "USSD Code" : "Acct: " + method.accountNumber}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Selected Method Details */}
                {selectedMethod && (
                  <div className="method-instruction-box">
                    <div className="inst-header">
                      {selectedMethod.name.toLowerCase().includes("birr") ? (
                        <Smartphone size={18} />
                      ) : (
                        <CreditCard size={18} />
                      )}
                      <strong>{selectedMethod.name} Instructions</strong>
                    </div>
                    <div className="inst-content">
                      <div className="data-row">
                        <span>Account Holder:</span>
                        <strong>{selectedMethod.accountHolder}</strong>
                      </div>
                      <div className="data-row">
                        <span>Account/Code:</span>
                        <strong className="text-glow">{selectedMethod.accountNumber}</strong>
                      </div>
                      <p className="description">{selectedMethod.instructions}</p>
                    </div>
                  </div>
                )}

                {/* Form Fields */}
                <div className="input-group">
                  <label htmlFor="transactionId">Transaction Reference ID / Number</label>
                  <input
                    id="transactionId"
                    type="text"
                    placeholder="E.g., FT26154H7G8 / Ref-98273"
                    className="input-field"
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    disabled={submitting}
                  />
                </div>

                <div className="form-row-double">
                  <div className="input-group">
                    <label htmlFor="amount">Amount Transferred (ETB)</label>
                    <input
                      id="amount"
                      type="number"
                      placeholder="150"
                      className="input-field"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                  
                  <div className="input-group">
                    <label htmlFor="phone">Contact Phone Number</label>
                    <input
                      id="phone"
                      type="tel"
                      placeholder="+251912345678"
                      className="input-field"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={submitting}
                    />
                  </div>
                </div>

                <button type="submit" className="btn-primary form-submit-btn" disabled={submitting}>
                  {submitting ? (
                    <>
                      <Loader2 className="spinner" /> Submitting...
                    </>
                  ) : (
                    <>
                      <Send size={16} /> Submit Transaction Proof
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Payment history list */}
            <div className="history-column">
              <div className="history-card glass-panel">
                <div className="history-header">
                  <h3>Payment Status Logs</h3>
                  <button onClick={fetchPreviousPayments} className="refresh-logs-btn" title="Refresh">
                    <RefreshCw size={14} />
                  </button>
                </div>
                
                <div className="logs-list">
                  {previousPayments.map((record) => {
                    let statusIcon = <Clock size={16} className="status-pending-icon" />;
                    let statusLabel = "Pending Verification";
                    let statusClass = "status-pending";
                    
                    if (record.status === "approved") {
                      statusIcon = <CheckCircle2 size={16} className="status-approved-icon" />;
                      statusLabel = "Approved & Unlocked";
                      statusClass = "status-approved";
                    } else if (record.status === "rejected") {
                      statusIcon = <XCircle size={16} className="status-rejected-icon" />;
                      statusLabel = "Rejected / Error";
                      statusClass = "status-rejected";
                    }

                    const date = record.createdAt 
                      ? new Date(record.createdAt.seconds * 1000).toLocaleDateString()
                      : "Today";

                    return (
                      <div key={record.id} className="log-item">
                        <div className="log-meta">
                          <div className="log-method-row">
                            <strong>{record.method}</strong>
                            <span>{date}</span>
                          </div>
                          <div className="log-ref-row">
                            <span>Ref: {record.transactionId}</span>
                            <strong>{record.amount} ETB</strong>
                          </div>
                        </div>
                        
                        <div className={`log-status ${statusClass}`}>
                          {statusIcon}
                          <span>{statusLabel}</span>
                        </div>
                      </div>
                    );
                  })}
                  
                  {previousPayments.length === 0 && (
                    <div className="empty-history text-center">
                      <Clock size={32} className="empty-history-icon" />
                      <p>No transactions submitted yet.</p>
                      <span>Transfers typically take 5-15 minutes to be verified by administrators.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <style jsx>{`
        .payment-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          max-width: 1200px;
          width: 100%;
          margin: 0 auto;
        }
        .payment-header {
          display: flex;
          align-items: center;
          gap: 24px;
          margin-bottom: 32px;
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
        .payment-header h2 {
          font-size: 1.8rem;
          color: #ffffff;
          font-weight: 800;
        }
        .payment-main {
          flex: 1;
          display: flex;
        }
        .payment-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 32px;
          width: 100%;
        }
        .form-card-column {
          display: flex;
          flex-direction: column;
        }
        .payment-form {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .payment-form h3 {
          font-size: 1.4rem;
          color: #ffffff;
          font-weight: 700;
        }
        .form-subtitle {
          font-size: 0.85rem;
          color: var(--text-muted);
          line-height: 1.4;
          margin-top: -8px;
        }
        .error-alert {
          background: rgba(255, 23, 68, 0.1);
          border: 1px solid rgba(255, 23, 68, 0.2);
          color: var(--danger);
          padding: 12px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
        }
        .success-alert {
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.2);
          color: var(--success);
          padding: 12px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.85rem;
        }
        .method-cards-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .method-toggle-card {
          border: 1px solid var(--border-color);
          background: rgba(255, 255, 255, 0.02);
          border-radius: var(--radius-md);
          padding: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 12px;
          transition: background 0.2s, border-color 0.2s;
        }
        .method-toggle-card:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: var(--border-hover);
        }
        .method-toggle-card.active {
          background: var(--primary-glow-subtle);
          border-color: var(--primary);
        }
        .radio-circle {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          border: 2px solid var(--border-color);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .method-toggle-card.active .radio-circle {
          border-color: var(--primary);
        }
        .radio-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--primary);
        }
        .method-info h4 {
          font-size: 0.95rem;
          color: #ffffff;
          font-weight: 600;
        }
        .method-info span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .method-instruction-box {
          background: rgba(0, 82, 255, 0.04);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-md);
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .inst-header {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--primary);
          font-size: 0.9rem;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
        }
        .inst-content {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .data-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.85rem;
        }
        .data-row span {
          color: var(--text-muted);
        }
        .data-row strong {
          color: #ffffff;
        }
        .text-glow {
          color: #4d88ff !important;
          text-shadow: 0 0 10px rgba(0, 82, 255, 0.3);
        }
        .description {
          font-size: 0.8rem;
          line-height: 1.4;
          color: var(--text-muted);
          margin-top: 4px;
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
        .form-row-double {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .form-submit-btn {
          width: 100%;
          margin-top: 10px;
        }
        .history-column {
          display: flex;
          flex-direction: column;
        }
        .history-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          height: 100%;
        }
        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .history-header h3 {
          font-size: 1.2rem;
          color: #ffffff;
          font-weight: 700;
        }
        .refresh-logs-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color 0.2s, background 0.2s;
        }
        .refresh-logs-btn:hover {
          color: #ffffff;
          background: rgba(255, 255, 255, 0.05);
        }
        .logs-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
          overflow-y: auto;
          max-height: 500px;
        }
        .log-item {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: var(--radius-md);
          padding: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
        }
        .log-meta {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .log-method-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
        }
        .log-method-row strong {
          color: #ffffff;
        }
        .log-method-row span {
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        .log-ref-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .log-ref-row strong {
          color: var(--primary);
        }
        .log-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 4px 10px;
          border-radius: 50px;
          border: 1px solid transparent;
        }
        .status-pending {
          background: var(--warning-glow);
          color: var(--warning);
          border-color: rgba(255, 214, 0, 0.2);
        }
        .status-approved {
          background: var(--success-glow);
          color: var(--success);
          border-color: rgba(0, 230, 118, 0.2);
        }
        .status-rejected {
          background: var(--danger-glow);
          color: var(--danger);
          border-color: rgba(255, 23, 68, 0.2);
        }
        .status-pending-icon {
          color: var(--warning);
        }
        .status-approved-icon {
          color: var(--success);
        }
        .status-rejected-icon {
          color: var(--danger);
        }
        .empty-history {
          padding: 48px 16px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }
        .empty-history-icon {
          color: rgba(255, 255, 255, 0.05);
        }
        .empty-history p {
          color: #ffffff;
          font-size: 0.95rem;
          font-weight: 600;
        }
        .empty-history span {
          font-size: 0.75rem;
          color: var(--text-muted);
          line-height: 1.4;
          max-width: 250px;
        }
        .premium-active-card {
          max-width: 500px;
          width: 100%;
          margin: 64px auto;
          padding: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }
        .premium-active-card h1 {
          font-size: 1.8rem;
          color: #ffffff;
          font-weight: 800;
        }
        .premium-active-card p {
          color: var(--text-muted);
          font-size: 0.95rem;
          line-height: 1.6;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 850px) {
          .payment-grid {
            grid-template-columns: 1fr;
          }
          .form-row-double {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
