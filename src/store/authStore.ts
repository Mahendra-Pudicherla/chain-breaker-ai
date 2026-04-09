import { create } from "zustand";
import type { User as FirebaseUser } from "firebase/auth";

interface AuthState {
  user: FirebaseUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,

  signIn: async (email, password) => {
    const { signInWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase");
    await signInWithEmailAndPassword(auth, email, password);
  },

  signUp: async (email, password) => {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase");
    await createUserWithEmailAndPassword(auth, email, password);
  },

  signOut: async () => {
    const { signOut: firebaseSignOut } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase");
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore if not configured
    }
    set({ user: null });
  },

  initialize: () => {
    try {
      const { auth } = require("@/lib/firebase");
      const { onAuthStateChanged } = require("firebase/auth");
      const unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
        set({ user, isLoading: false });
      });
      return unsubscribe;
    } catch {
      set({ isLoading: false });
      return () => {};
    }
  },
}));
