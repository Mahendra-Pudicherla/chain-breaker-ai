import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const isConfigured = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let app: FirebaseApp | null = null;
let auth: Auth;
let db: Firestore;

if (isConfigured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} else {
  console.warn("[Chain Breaker AI] Firebase not configured — running in demo mode. Set VITE_FIREBASE_* env vars to enable.");
  // Create proxy objects that won't crash the app
  const handler: ProxyHandler<any> = {
    get: (_target, prop) => {
      if (prop === "currentUser") return null;
      if (prop === "onAuthStateChanged") return (_cb: any) => { _cb(null); return () => {}; };
      return () => {};
    },
  };
  auth = new Proxy({} as Auth, handler);
  db = new Proxy({} as Firestore, handler);
}

export { auth, db };
export default app;
