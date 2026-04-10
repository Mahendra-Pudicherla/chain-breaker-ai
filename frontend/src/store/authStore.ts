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
    const cred = await signInWithEmailAndPassword(auth, email, password);
    set({ user: cred.user });
  },

  signUp: async (email, password) => {
    const { createUserWithEmailAndPassword } = await import("firebase/auth");
    const { auth } = await import("@/lib/firebase");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    set({ user: cred.user });
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
    let unsubscribe: (() => void) | undefined;

    (async () => {
      try {
        const [{ auth }, { onAuthStateChanged }] = await Promise.all([
          import("@/lib/firebase"),
          import("firebase/auth"),
        ]);
        unsubscribe = onAuthStateChanged(auth, (user: FirebaseUser | null) => {
          set({ user, isLoading: false });
        });
      } catch {
        set({ isLoading: false });
      }
    })();

    return () => {
      unsubscribe?.();
    };
  },
}));
