import { create } from "zustand";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User as FirebaseUser,
} from "firebase/auth";
import { auth } from "@/lib/firebase";

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
    await signInWithEmailAndPassword(auth, email, password);
  },

  signUp: async (email, password) => {
    await createUserWithEmailAndPassword(auth, email, password);
  },

  signOut: async () => {
    await firebaseSignOut(auth);
    set({ user: null });
  },

  initialize: () => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      set({ user, isLoading: false });
    });
    return unsubscribe;
  },
}));
