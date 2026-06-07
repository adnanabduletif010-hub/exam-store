"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { 
  collection, query, getDocs, doc, updateDoc, 
  addDoc, deleteDoc, serverTimestamp, setDoc 
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { 
  Users, CreditCard, BookOpen, Clock, ShieldCheck, 
  Plus, Trash2, ArrowLeft, Loader2, Sparkles, Check, X, FileText
} from "lucide-react";
import { MOCK_USERS, MOCK_PAYMENTS, MOCK_METHODS } from "@/lib/mockData";

interface AppUser {
  uid: string;
  email: string | null;
  phoneNumber: string | null;
  displayName: string | null;
  role: string;
  isPaid: boolean;
}

interface PaymentRecord {
  id: string;
  userId: string;
  userName: string;
  userPhone: string;
  method: string;
  transactionId: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: any;
}

interface PaymentMethod {
  id: string;
  name: string;
  accountNumber: string;
  accountHolder: string;
  instructions: string;
  isActive: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const { user, profile, loading: authLoading, isOnline } = useAuth();
  
  // Tabs
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "methods">("overview");

  // Data states
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [paymentsList, setPaymentsList] = useState<PaymentRecord[]>([]);
  const [methodsList, setMethodsList] = useState<PaymentMethod[]>([]);
  const [questionsCount, setQuestionsCount] = useState(0);
  
  const [loadingData, setLoadingData] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // New method form inputs
  const [methodName, setMethodName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [instructions, setInstructions] = useState("");
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

  const loadAdminData = async () => {
    if (user && user.uid.startsWith("mock-")) {
      setLoadingData(true);
      const cachedUsers = localStorage.getItem("mock_users_list");
      setUsersList(cachedUsers ? JSON.parse(cachedUsers) : MOCK_USERS);
      
      const cachedPayments = localStorage.getItem("mock_global_payments");
      setPaymentsList(cachedPayments ? JSON.parse(cachedPayments) : MOCK_PAYMENTS);
      
      const cachedMethods = localStorage.getItem("mock_methods_list");
      setMethodsList(cachedMethods ? JSON.parse(cachedMethods) : MOCK_METHODS);
      
      setQuestionsCount(9); 
      setLoadingData(false);
      return;
    }

    if (!isOnline) {
      setLoadingData(false);
      return;
    }
    setLoadingData(true);
    try {
      // 1. Fetch Users
      const usersSnap = await getDocs(collection(db, "users"));
      const uList: AppUser[] = [];
      usersSnap.forEach((docSnap) => {
        uList.push({ uid: docSnap.id, ...docSnap.data() } as AppUser);
      });
      setUsersList(uList);

      // 2. Fetch Payments
      const paymentsSnap = await getDocs(collection(db, "payments"));
      const pList: PaymentRecord[] = [];
      paymentsSnap.forEach((docSnap) => {
        pList.push({ id: docSnap.id, ...docSnap.data() } as PaymentRecord);
      });
      // Sort: pending first, then newest
      pList.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        const t1 = a.createdAt?.seconds || 0;
        const t2 = b.createdAt?.seconds || 0;
        return t2 - t1;
      });
      setPaymentsList(pList);

      // 3. Fetch Payment Methods
      const methodsSnap = await getDocs(collection(db, "paymentMethods"));
      const mList: PaymentMethod[] = [];
      methodsSnap.forEach((docSnap) => {
        mList.push({ id: docSnap.id, ...docSnap.data() } as PaymentMethod);
      });
      setMethodsList(mList);

      // 4. Fetch Questions count
      const questionsSnap = await getDocs(collection(db, "questions"));
      setQuestionsCount(questionsSnap.size);
    } catch (err) {
      console.error("Error loading admin dashboard data:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (profile && profile.role === "admin") {
      loadAdminData();
    }
  }, [profile, isOnline]);

  // Approve Payment Action
  const handleApprovePayment = async (record: PaymentRecord) => {
    if (user && user.uid.startsWith("mock-")) {
      setProcessingId(record.id);
      setTimeout(() => {
        const cachedPayments = localStorage.getItem("mock_global_payments");
        const list: PaymentRecord[] = cachedPayments ? JSON.parse(cachedPayments) : MOCK_PAYMENTS;
        const updatedPayments = list.map(p => p.id === record.id ? { ...p, status: "approved" as const } : p);
        localStorage.setItem("mock_global_payments", JSON.stringify(updatedPayments));
        setPaymentsList(updatedPayments);

        if (record.userId === "mock-student-uid") {
          const cachedStudentPayments = localStorage.getItem("mock_payments");
          const sList = cachedStudentPayments ? JSON.parse(cachedStudentPayments) : [];
          const updatedSList = sList.map((p: any) => p.id === record.id ? { ...p, status: "approved" } : p);
          localStorage.setItem("mock_payments", JSON.stringify(updatedSList));

          const cachedProfile = localStorage.getItem("user_profile");
          if (cachedProfile) {
            const parsed = JSON.parse(cachedProfile);
            parsed.isPaid = true;
            localStorage.setItem("user_profile", JSON.stringify(parsed));
          }
        }

        const cachedUsers = localStorage.getItem("mock_users_list");
        const uList = cachedUsers ? JSON.parse(cachedUsers) : MOCK_USERS;
        const updatedUsers = uList.map((u: any) => u.uid === record.userId ? { ...u, isPaid: true } : u);
        localStorage.setItem("mock_users_list", JSON.stringify(updatedUsers));
        setUsersList(updatedUsers);

        setProcessingId(null);
      }, 500);
      return;
    }

    setProcessingId(record.id);
    try {
      // 1. Update Payment Status to approved
      const paymentRef = doc(db, "payments", record.id);
      await updateDoc(paymentRef, { status: "approved" });

      // 2. Update Student User isPaid to true
      const userRef = doc(db, "users", record.userId);
      await updateDoc(userRef, { isPaid: true });

      // 3. Update local state
      setPaymentsList(prev => prev.map(p => p.id === record.id ? { ...p, status: "approved" as const } : p));
      setUsersList(prev => prev.map(u => u.uid === record.userId ? { ...u, isPaid: true } : u));
    } catch (err) {
      console.error("Error approving payment:", err);
    } finally {
      setProcessingId(null);
    }
  };

  // Reject Payment Action
  const handleRejectPayment = async (paymentId: string) => {
    if (user && user.uid.startsWith("mock-")) {
      setProcessingId(paymentId);
      setTimeout(() => {
        const cachedPayments = localStorage.getItem("mock_global_payments");
        const list: PaymentRecord[] = cachedPayments ? JSON.parse(cachedPayments) : MOCK_PAYMENTS;
        const updatedPayments = list.map(p => p.id === paymentId ? { ...p, status: "rejected" as const } : p);
        localStorage.setItem("mock_global_payments", JSON.stringify(updatedPayments));
        setPaymentsList(updatedPayments);

        const cachedStudentPayments = localStorage.getItem("mock_payments");
        const sList = cachedStudentPayments ? JSON.parse(cachedStudentPayments) : [];
        const updatedSList = sList.map((p: any) => p.id === paymentId ? { ...p, status: "rejected" } : p);
        localStorage.setItem("mock_payments", JSON.stringify(updatedSList));

        setProcessingId(null);
      }, 500);
      return;
    }

    setProcessingId(paymentId);
    try {
      const paymentRef = doc(db, "payments", paymentId);
      await updateDoc(paymentRef, { status: "rejected" });
      setPaymentsList(prev => prev.map(p => p.id === paymentId ? { ...p, status: "rejected" as const } : p));
    } catch (err) {
      console.error("Error rejecting payment:", err);
    } finally {
      setProcessingId(null);
    }
  };

  // Add Payment Method Action
  const handleAddMethod = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!methodName || !accountNumber || !accountHolder) {
      setFormError("Please fill in all mandatory fields.");
      return;
    }

    if (user && user.uid.startsWith("mock-")) {
      const newMethod = {
        id: `mock-m-${Date.now()}`,
        name: methodName,
        accountNumber,
        accountHolder,
        instructions,
        isActive: true
      };
      const updated = [...methodsList, newMethod];
      setMethodsList(updated);
      localStorage.setItem("mock_methods_list", JSON.stringify(updated));
      
      setFormSuccess(`Successfully added payment method: ${methodName}`);
      setMethodName("");
      setAccountNumber("");
      setAccountHolder("");
      setInstructions("");
      return;
    }

    try {
      const newMethod = {
        name: methodName,
        accountNumber,
        accountHolder,
        instructions,
        isActive: true,
        createdAt: serverTimestamp(),
      };
      
      const docRef = await addDoc(collection(db, "paymentMethods"), newMethod);
      setMethodsList(prev => [...prev, { id: docRef.id, ...newMethod } as PaymentMethod]);
      
      setFormSuccess(`Successfully added payment method: ${methodName}`);
      setMethodName("");
      setAccountNumber("");
      setAccountHolder("");
      setInstructions("");
    } catch (err: any) {
      console.error("Error adding payment method:", err);
      setFormError("Failed to add: " + err.message);
    }
  };

  // Delete Payment Method Action
  const handleDeleteMethod = async (methodId: string) => {
    if (!confirm("Are you sure you want to delete this payment method?")) return;
    
    if (user && user.uid.startsWith("mock-")) {
      const updated = methodsList.filter(m => m.id !== methodId);
      setMethodsList(updated);
      localStorage.setItem("mock_methods_list", JSON.stringify(updated));
      return;
    }

    try {
      await deleteDoc(doc(db, "paymentMethods", methodId));
      setMethodsList(prev => prev.filter(m => m.id !== methodId));
    } catch (err) {
      console.error("Error deleting payment method:", err);
    }
  };

  // Toggle active user role
  const handleToggleUserPaid = async (userId: string, currentPaidStatus: boolean) => {
    if (user && user.uid.startsWith("mock-")) {
      const cachedUsers = localStorage.getItem("mock_users_list");
      const list = cachedUsers ? JSON.parse(cachedUsers) : MOCK_USERS;
      const updated = list.map((u: any) => u.uid === userId ? { ...u, isPaid: !currentPaidStatus } : u);
      localStorage.setItem("mock_users_list", JSON.stringify(updated));
      setUsersList(updated);

      if (userId === "mock-student-uid") {
        const cachedProfile = localStorage.getItem("user_profile");
        if (cachedProfile) {
          const parsed = JSON.parse(cachedProfile);
          parsed.isPaid = !currentPaidStatus;
          localStorage.setItem("user_profile", JSON.stringify(parsed));
        }
      }
      return;
    }

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { isPaid: !currentPaidStatus });
      setUsersList(prev => prev.map(u => u.uid === userId ? { ...u, isPaid: !currentPaidStatus } : u));
    } catch (err) {
      console.error("Error toggling user paid status:", err);
    }
  };

  if (authLoading || (user && !profile) || (profile && profile.role !== "admin")) {
    return (
      <div className="admin-loading">
        <Loader2 className="spinner" />
        <p>Verifying Admin Privileges...</p>
        <style jsx>{`
          .admin-loading {
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

  const pendingPayments = paymentsList.filter(p => p.status === "pending");

  return (
    <div className="admin-container animate-fade-in">
      {/* Top Banner Menu */}
      <header className="admin-header glass-panel">
        <div className="header-info">
          <div className="admin-badge">ADMIN PORTAL</div>
          <h2>Control & Analytics Center</h2>
        </div>
        
        <div className="header-actions">
          <button onClick={() => router.push("/practice")} className="btn-secondary">
            <ArrowLeft size={16} /> Student Practice View
          </button>
          <button onClick={() => router.push("/admin/questions")} className="btn-primary">
            <BookOpen size={16} /> Manage Questions
          </button>
          <button onClick={() => router.push("/admin/ai")} className="btn-primary glow-btn">
            <Sparkles size={16} /> AI Ingest Materials
          </button>
        </div>
      </header>

      {/* Statistics Cards Row */}
      <div className="stats-row">
        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper blue">
            <Users size={24} />
          </div>
          <div className="stat-text">
            <span>Total Students</span>
            <strong>{usersList.filter(u => u.role === "student").length}</strong>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper green">
            <ShieldCheck size={24} />
          </div>
          <div className="stat-text">
            <span>Premium Active</span>
            <strong>{usersList.filter(u => u.isPaid).length}</strong>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper yellow">
            <Clock size={24} />
          </div>
          <div className="stat-text">
            <span>Pending Verifications</span>
            <strong>{pendingPayments.length}</strong>
          </div>
        </div>

        <div className="stat-card glass-panel">
          <div className="stat-icon-wrapper purple">
            <FileText size={24} />
          </div>
          <div className="stat-text">
            <span>Total Questions</span>
            <strong>{questionsCount}</strong>
          </div>
        </div>
      </div>

      {/* Main admin panels */}
      <div className="admin-panels">
        {/* Navigation Tabs */}
        <div className="admin-tabs">
          <button 
            className={`tab-btn ${activeTab === "overview" ? "active" : ""}`}
            onClick={() => setActiveTab("overview")}
          >
            Payments & Requests {pendingPayments.length > 0 && <span className="tab-badge">{pendingPayments.length}</span>}
          </button>
          <button 
            className={`tab-btn ${activeTab === "users" ? "active" : ""}`}
            onClick={() => setActiveTab("users")}
          >
            Students Directory
          </button>
          <button 
            className={`tab-btn ${activeTab === "methods" ? "active" : ""}`}
            onClick={() => setActiveTab("methods")}
          >
            Configure Payment Methods
          </button>
        </div>

        <div className="tab-content">
          {loadingData ? (
            <div className="tab-loading text-center">
              <Loader2 className="spinner" />
              <p>Fetching latest data...</p>
            </div>
          ) : (
            <>
              {/* Tab 1: Overview & Pending Payments */}
              {activeTab === "overview" && (
                <div className="overview-tab-content">
                  <div className="table-header">
                    <h3>Pending Transactions ({pendingPayments.length})</h3>
                  </div>

                  <div className="payments-table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Phone / Email</th>
                          <th>Method</th>
                          <th>Reference ID</th>
                          <th>Amount</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentsList.map((payment) => {
                          const isPending = payment.status === "pending";
                          const date = payment.createdAt 
                            ? new Date(payment.createdAt.seconds * 1000).toLocaleDateString()
                            : "Today";

                          return (
                            <tr key={payment.id} className={isPending ? "row-pending" : ""}>
                              <td><strong>{payment.userName}</strong></td>
                              <td>
                                <div className="contact-details">
                                  <span>{payment.userPhone}</span>
                                </div>
                              </td>
                              <td><span className="badge badge-blue">{payment.method}</span></td>
                              <td><code className="ref-code">{payment.transactionId}</code></td>
                              <td><strong>{payment.amount} ETB</strong></td>
                              <td>{date}</td>
                              <td>
                                {isPending ? (
                                  <div className="table-actions">
                                    <button 
                                      className="btn-action btn-approve"
                                      onClick={() => handleApprovePayment(payment)}
                                      disabled={processingId === payment.id}
                                    >
                                      {processingId === payment.id ? <Loader2 className="spinner" size={14} /> : <Check size={14} />} Approve
                                    </button>
                                    <button 
                                      className="btn-action btn-reject"
                                      onClick={() => handleRejectPayment(payment.id)}
                                      disabled={processingId === payment.id}
                                    >
                                      {processingId === payment.id ? <Loader2 className="spinner" size={14} /> : <X size={14} />} Reject
                                    </button>
                                  </div>
                                ) : (
                                  <span className={`status-text ${payment.status}`}>
                                    {payment.status === "approved" ? "Verified" : "Rejected"}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                        {paymentsList.length === 0 && (
                          <tr>
                            <td colSpan={7} className="no-records">No payment logs found.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 2: User list */}
              {activeTab === "users" && (
                <div className="users-tab-content">
                  <div className="table-header">
                    <h3>Registered Students ({usersList.filter(u => u.role === "student").length})</h3>
                  </div>

                  <div className="table-container">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Student Name</th>
                          <th>Email Address</th>
                          <th>Phone Number</th>
                          <th>Role</th>
                          <th>Premium State</th>
                          <th>Bypass Access</th>
                        </tr>
                      </thead>
                      <tbody>
                        {usersList.map((usr) => (
                          <tr key={usr.uid}>
                            <td><strong>{usr.displayName || "Unspecified"}</strong></td>
                            <td>{usr.email || "-"}</td>
                            <td>{usr.phoneNumber || "-"}</td>
                            <td><span className="user-role-badge">{usr.role}</span></td>
                            <td>
                              <span className={`badge ${usr.isPaid ? "badge-green" : "badge-orange"}`}>
                                {usr.isPaid ? "PREMIUM" : "FREE TIER"}
                              </span>
                            </td>
                            <td>
                              {usr.role === "student" && (
                                <button
                                  className="toggle-paid-btn"
                                  onClick={() => handleToggleUserPaid(usr.uid, usr.isPaid)}
                                >
                                  {usr.isPaid ? "Lock Accounts" : "Grant Access"}
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Configure payment methods */}
              {activeTab === "methods" && (
                <div className="methods-tab-content">
                  <div className="methods-grid">
                    {/* Add method form */}
                    <form onSubmit={handleAddMethod} className="add-method-form glass-panel">
                      <h3>Add New Payment Merchant</h3>
                      
                      {formError && <div className="error-alert">{formError}</div>}
                      {formSuccess && <div className="success-alert">{formSuccess}</div>}

                      <div className="input-group">
                        <label htmlFor="methodName">Merchant/Bank Name</label>
                        <input
                          id="methodName"
                          type="text"
                          placeholder="E.g., e-Birr, Commercial Bank of Ethiopia (CBE)"
                          className="input-field"
                          value={methodName}
                          onChange={(e) => setMethodName(e.target.value)}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="accountNumber">Account/USSD Code Number</label>
                        <input
                          id="accountNumber"
                          type="text"
                          placeholder="E.g., 100084736271 or USSD string"
                          className="input-field"
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="accountHolder">Account Owner / Merchant Name</label>
                        <input
                          id="accountHolder"
                          type="text"
                          placeholder="E.g., Exam Store Corp."
                          className="input-field"
                          value={accountHolder}
                          onChange={(e) => setAccountHolder(e.target.value)}
                        />
                      </div>

                      <div className="input-group">
                        <label htmlFor="instructions">Step-by-Step Student Instructions</label>
                        <textarea
                          id="instructions"
                          placeholder="Specify the exact instructions students need to follow to transfer money."
                          className="input-field instructions-textarea"
                          rows={4}
                          value={instructions}
                          onChange={(e) => setInstructions(e.target.value)}
                        />
                      </div>

                      <button type="submit" className="btn-primary">
                        <Plus size={16} /> Save Payment Method
                      </button>
                    </form>

                    {/* Active payment methods list */}
                    <div className="methods-list-column">
                      <h3>Active Payment Methods ({methodsList.length})</h3>
                      <div className="methods-grid-list">
                        {methodsList.map((m) => (
                          <div key={m.id} className="method-admin-card glass-panel">
                            <div className="card-header">
                              <h4>{m.name}</h4>
                              <button 
                                onClick={() => handleDeleteMethod(m.id)}
                                className="delete-method-btn"
                                title="Delete Method"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                            <div className="card-body">
                              <p><strong>Account:</strong> {m.accountNumber}</p>
                              <p><strong>Name:</strong> {m.accountHolder}</p>
                              <p className="card-instructions">{m.instructions}</p>
                            </div>
                          </div>
                        ))}
                        {methodsList.length === 0 && (
                          <p className="no-records text-center">No payment methods configured. Add one on the left.</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .admin-container {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 24px;
          max-width: 1300px;
          width: 100%;
          margin: 0 auto;
          gap: 32px;
        }
        .admin-header {
          padding: 24px 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .header-info {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .admin-badge {
          background: rgba(0, 82, 255, 0.15);
          color: #4d88ff;
          border: 1px solid rgba(0, 82, 255, 0.25);
          padding: 4px 10px;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.05em;
          width: fit-content;
        }
        .admin-header h2 {
          font-size: 1.6rem;
          color: #ffffff;
          font-weight: 800;
        }
        .header-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .glow-btn {
          box-shadow: 0 0 15px var(--primary);
        }
        .stats-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 20px;
        }
        .stat-card {
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 20px;
        }
        .stat-icon-wrapper {
          width: 54px;
          height: 54px;
          border-radius: var(--radius-md);
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid transparent;
        }
        .stat-icon-wrapper.blue {
          background: rgba(0, 82, 255, 0.1);
          border-color: rgba(0, 82, 255, 0.25);
          color: #4d88ff;
        }
        .stat-icon-wrapper.green {
          background: rgba(0, 230, 118, 0.1);
          border-color: rgba(0, 230, 118, 0.2);
          color: var(--success);
        }
        .stat-icon-wrapper.yellow {
          background: rgba(255, 214, 0, 0.1);
          border-color: rgba(255, 214, 0, 0.2);
          color: var(--warning);
        }
        .stat-icon-wrapper.purple {
          background: rgba(156, 39, 176, 0.1);
          border-color: rgba(156, 39, 176, 0.2);
          color: #e040fb;
        }
        .stat-text {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .stat-text span {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .stat-text strong {
          font-size: 1.6rem;
          color: #ffffff;
          font-weight: 800;
        }
        .admin-panels {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .admin-tabs {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          gap: 8px;
        }
        .tab-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          padding: 16px 20px;
          position: relative;
          transition: color 0.2s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tab-btn:hover {
          color: #ffffff;
        }
        .tab-btn.active {
          color: #ffffff;
        }
        .tab-btn.active::after {
          content: '';
          position: absolute;
          bottom: -1px;
          left: 0;
          width: 100%;
          height: 2px;
          background: var(--primary);
        }
        .tab-badge {
          background: var(--danger);
          color: #ffffff;
          font-size: 0.7rem;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 50px;
        }
        .tab-content {
          min-height: 300px;
        }
        .tab-loading {
          padding: 64px;
          color: var(--text-muted);
        }
        .table-header {
          margin-bottom: 20px;
        }
        .table-header h3 {
          font-size: 1.2rem;
          color: #ffffff;
        }
        .table-container, .payments-table-container {
          background: var(--bg-card);
          border: 1px solid var(--border-color);
          border-radius: var(--radius-lg);
          overflow-x: auto;
        }
        .admin-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }
        .admin-table th {
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding: 16px 24px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.05em;
        }
        .admin-table td {
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding: 16px 24px;
          color: var(--text-main);
        }
        .row-pending {
          background: rgba(255, 214, 0, 0.01);
        }
        .contact-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .contact-details span {
          font-weight: 500;
        }
        .ref-code {
          background: rgba(255, 255, 255, 0.05);
          padding: 4px 8px;
          border-radius: 4px;
          font-family: monospace;
          color: #e040fb;
        }
        .table-actions {
          display: flex;
          gap: 8px;
        }
        .btn-action {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          border: none;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-approve {
          background: var(--success-glow);
          color: var(--success);
          border: 1px solid rgba(0, 230, 118, 0.2);
        }
        .btn-approve:hover:not(:disabled) {
          background: rgba(0, 230, 118, 0.25);
        }
        .btn-reject {
          background: var(--danger-glow);
          color: var(--danger);
          border: 1px solid rgba(255, 23, 68, 0.2);
        }
        .btn-reject:hover:not(:disabled) {
          background: rgba(255, 23, 68, 0.25);
        }
        .status-text {
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-text.approved {
          color: var(--success);
        }
        .status-text.rejected {
          color: var(--danger);
        }
        .no-records {
          text-align: center;
          color: var(--text-muted);
          padding: 32px !important;
        }
        .user-role-badge {
          background: rgba(255, 255, 255, 0.05);
          color: var(--text-muted);
          padding: 2px 8px;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .toggle-paid-btn {
          background: rgba(0, 82, 255, 0.1);
          border: 1px solid var(--border-color);
          color: #4d88ff;
          padding: 6px 12px;
          border-radius: var(--radius-sm);
          font-size: 0.75rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s, border-color 0.2s;
        }
        .toggle-paid-btn:hover {
          background: rgba(0, 82, 255, 0.2);
          border-color: var(--border-hover);
        }
        .methods-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          align-items: start;
        }
        .add-method-form {
          padding: 32px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .add-method-form h3 {
          font-size: 1.2rem;
          color: #ffffff;
          margin-bottom: 10px;
        }
        .error-alert {
          background: rgba(255, 23, 68, 0.1);
          border: 1px solid rgba(255, 23, 68, 0.2);
          color: var(--danger);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
        }
        .success-alert {
          background: rgba(0, 230, 118, 0.1);
          border: 1px solid rgba(0, 230, 118, 0.2);
          color: var(--success);
          padding: 10px 14px;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
        }
        .instructions-textarea {
          resize: vertical;
        }
        .methods-list-column {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .methods-list-column h3 {
          font-size: 1.2rem;
          color: #ffffff;
        }
        .methods-grid-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .method-admin-card {
          padding: 20px;
        }
        .method-admin-card .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 8px;
        }
        .method-admin-card .card-header h4 {
          font-size: 1rem;
          color: #ffffff;
        }
        .delete-method-btn {
          background: none;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          padding: 4px;
          border-radius: var(--radius-sm);
          transition: color 0.2s, background 0.2s;
        }
        .delete-method-btn:hover {
          color: var(--danger);
          background: rgba(255, 23, 68, 0.05);
        }
        .method-admin-card .card-body {
          display: flex;
          flex-direction: column;
          gap: 6px;
          font-size: 0.85rem;
        }
        .method-admin-card .card-body p {
          color: var(--text-muted);
        }
        .method-admin-card .card-body strong {
          color: #ffffff;
        }
        .card-instructions {
          font-size: 0.8rem;
          line-height: 1.4;
          margin-top: 8px;
          background: rgba(255, 255, 255, 0.01);
          padding: 10px;
          border-radius: var(--radius-sm);
          border: 1px solid rgba(255, 255, 255, 0.02);
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 900px) {
          .admin-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 20px;
          }
          .header-actions {
            width: 100%;
            flex-direction: column;
          }
          .header-actions :global(button) {
            width: 100%;
          }
          .methods-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
