"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { User, onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { saveUserProfileOffline, getOfflineUserProfile, clearOfflineCache, UserProfile } from "@/lib/offlineDb";

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isOnline: boolean;
  logout: () => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  mockLogin: (role: "student" | "admin") => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  isOnline: true,
  logout: async () => {},
  updateProfile: async () => {},
  mockLogin: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // Listen to network status changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsOnline(navigator.onLine);
      const handleOnline = () => setIsOnline(true);
      const handleOffline = () => setIsOnline(false);
      
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
      
      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  // Listen to Firebase Auth state (runs once on mount - never re-subscribe on network changes)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Read online status at call-time rather than from closure to avoid stale values
        if (navigator.onLine) {
          try {
            // Get profile from Firestore
            const userDocRef = doc(db, "users", firebaseUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            
            let userProfile: UserProfile;
            
            if (userDocSnap.exists()) {
              const data = userDocSnap.data();
              userProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || data.email || null,
                phoneNumber: firebaseUser.phoneNumber || data.phoneNumber || null,
                displayName: firebaseUser.displayName || data.displayName || "Student",
                role: data.role || "student",
                isPaid: data.isPaid || false,
                gradeCategory: data.gradeCategory || undefined,
              };
            } else {
              // Create default profile for new user
              // If email matches admin pattern, set role as admin
              const isAdmin = firebaseUser.email?.toLowerCase().includes("admin") || false;
              
              userProfile = {
                uid: firebaseUser.uid,
                email: firebaseUser.email || null,
                phoneNumber: firebaseUser.phoneNumber || null,
                displayName: firebaseUser.displayName || "Student",
                role: isAdmin ? "admin" : "student",
                isPaid: false,
              };
              
              await setDoc(userDocRef, {
                ...userProfile,
                createdAt: serverTimestamp(),
                lastActive: serverTimestamp(),
              });
            }
            
            // Sync offline
            setProfile(userProfile);
            try {
              await saveUserProfileOffline(userProfile);
            } catch (offlineErr) {
              console.warn("Could not save profile offline:", offlineErr);
            }
          } catch (error) {
            console.error("Error syncing user profile with Firestore:", error);
            // Fallback to offline cache on Firestore error
            try {
              const cachedProfile = await getOfflineUserProfile();
              if (cachedProfile && cachedProfile.uid === firebaseUser.uid) {
                setProfile(cachedProfile);
              } else {
                const isAdmin = firebaseUser.email?.toLowerCase().includes("admin") || false;
                const fallbackProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email || null,
                  phoneNumber: firebaseUser.phoneNumber || null,
                  displayName: firebaseUser.displayName || "Student (Local)",
                  role: isAdmin ? "admin" : "student",
                  isPaid: false,
                };
                setProfile(fallbackProfile);
                try {
                  await saveUserProfileOffline(fallbackProfile);
                } catch (offlineErr) {
                  console.warn("Could not save fallback profile offline:", offlineErr);
                }
              }
            } catch (cacheError) {
              console.error("Failed to load cached profile:", cacheError);
              const isAdmin = firebaseUser.email?.toLowerCase().includes("admin") || false;
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email || null,
                phoneNumber: firebaseUser.phoneNumber || null,
                displayName: firebaseUser.displayName || "Student (Local)",
                role: isAdmin ? "admin" : "student",
                isPaid: false,
              });
            }
          }
        } else {
          // If offline, check local cache
          try {
            const cachedProfile = await getOfflineUserProfile();
            if (cachedProfile && cachedProfile.uid === firebaseUser.uid) {
              setProfile(cachedProfile);
            } else {
              // No offline profile matches logged in user ID
              setProfile({
                uid: firebaseUser.uid,
                email: firebaseUser.email,
                phoneNumber: firebaseUser.phoneNumber,
                displayName: firebaseUser.displayName || "Student (Offline)",
                role: "student",
                isPaid: false,
              });
            }
          } catch (offlineCacheError) {
            console.error("Error checking offline cache while offline:", offlineCacheError);
            setProfile({
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              phoneNumber: firebaseUser.phoneNumber,
              displayName: firebaseUser.displayName || "Student (Offline)",
              role: "student",
              isPaid: false,
            });
          }
        }
      } else {
        // If there's a cached offline profile, check it to maintain persistence on reload
        try {
          const cachedProfile = await getOfflineUserProfile();
          if (cachedProfile && cachedProfile.uid.startsWith("mock-")) {
            setUser({
              uid: cachedProfile.uid,
              email: cachedProfile.email,
              displayName: cachedProfile.displayName,
            } as any);
            setProfile(cachedProfile);
          } else {
            setUser(null);
            setProfile(null);
          }
        } catch (logoutCacheError) {
          console.error("Error loading cached profile on logout:", logoutCacheError);
          setUser(null);
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps: subscribe once. isOnline is read via navigator.onLine inside callback.

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.warn("Sign out of Firebase Auth error (expected if mock):", e);
    }
    await clearOfflineCache();
    setUser(null);
    setProfile(null);
  };

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    
    const updatedProfile = { ...profile, ...updates };
    setProfile(updatedProfile);
    await saveUserProfileOffline(updatedProfile);
    
    if (isOnline && user && !user.uid.startsWith("mock-")) {
      try {
        const userDocRef = doc(db, "users", user.uid);
        await setDoc(userDocRef, updates, { merge: true });
      } catch (error) {
        console.error("Error saving updated profile to Firestore:", error);
      }
    }
  };

  const mockLogin = async (role: "student" | "admin") => {
    setLoading(true);
    const mockUser = {
      uid: `mock-${role}-uid`,
      email: `demo-${role}@novaprep.com`,
      displayName: `Demo ${role === "admin" ? "Admin" : "Student"}`,
      phoneNumber: null,
    } as any;
    
    const mockProfile: UserProfile = {
      uid: mockUser.uid,
      email: mockUser.email,
      phoneNumber: null,
      displayName: mockUser.displayName,
      role: role,
      isPaid: role === "admin" ? true : false,
    };
    
    setUser(mockUser);
    setProfile(mockProfile);
    await saveUserProfileOffline(mockProfile);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, isOnline, logout, updateProfile, mockLogin }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
