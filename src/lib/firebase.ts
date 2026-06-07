import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

let app: any;
let db: any;
let auth: any;
let googleProvider: any;
let isFirebaseConfigured = false;

try {
  if (firebaseConfig.apiKey) {
    // Safe for hot-reload: reuse existing app if already initialized
    const isNewApp = getApps().length === 0;
    app = isNewApp ? initializeApp(firebaseConfig) : getApp();

    // Use persistent offline cache only in the browser.
    // During Vercel SSR/SSG (server-side), browser APIs don't exist — use basic Firestore.
    db =
      isNewApp && typeof window !== "undefined"
        ? initializeFirestore(app, {
            localCache: persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            }),
          })
        : getFirestore(app);

    auth = getAuth(app);
    googleProvider = new GoogleAuthProvider();
    isFirebaseConfigured = true;
  } else {
    throw new Error("Firebase API key is missing from environment variables.");
  }
} catch (error) {
  console.warn("Firebase initialization failed during build or load:", error);
  // Fallbacks to avoid crashing the build when environment variables are missing
  app = {} as any;
  db = {} as any;
  auth = {} as any;
  googleProvider = {} as any;
  isFirebaseConfigured = false;
}

export { app, db, auth, googleProvider, isFirebaseConfigured };
export default app;
