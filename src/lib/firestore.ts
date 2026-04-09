import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  increment,
  writeBatch,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Scan, Finding, SitemapNode, User } from "@/types";

// Check if Firebase is configured
function isConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

// ---- Users ----
export async function getUserDoc(uid: string): Promise<User | null> {
  if (!isConfigured()) return null;
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? (snap.data() as User) : null;
}

export async function createUserDoc(uid: string, data: Partial<User>) {
  if (!isConfigured()) return;
  await setDoc(doc(db, "users", uid), {
    uid,
    email: data.email ?? "",
    displayName: data.displayName ?? "",
    createdAt: Timestamp.now(),
    plan: "free",
    totalScans: 0,
    ...data,
  });
}

export async function updateUserDoc(uid: string, data: Partial<User> & Record<string, unknown>) {
  if (!isConfigured()) return;
  await updateDoc(doc(db, "users", uid), data);
}

export function onUserDoc(uid: string, cb: (user: User | null) => void): Unsubscribe {
  if (!isConfigured()) { cb(null); return () => {}; }
  return onSnapshot(doc(db, "users", uid), (snap) => {
    cb(snap.exists() ? (snap.data() as User) : null);
  });
}

// ---- Scans ----
export async function createScan(data: Omit<Scan, "scanId">): Promise<string> {
  if (!isConfigured()) return "demo-scan-" + Date.now();
  const ref = await addDoc(collection(db, "scans"), data);
  return ref.id;
}

export async function getScan(scanId: string): Promise<Scan | null> {
  if (!isConfigured()) return null;
  const snap = await getDoc(doc(db, "scans", scanId));
  return snap.exists() ? ({ scanId: snap.id, ...snap.data() } as Scan) : null;
}

export async function updateScan(scanId: string, data: Partial<Scan>) {
  if (!isConfigured()) return;
  await updateDoc(doc(db, "scans", scanId), data);
}

export async function deleteScanFull(scanId: string) {
  if (!isConfigured()) return;
  const batch = writeBatch(db);
  const findingsSnap = await getDocs(collection(db, "scans", scanId, "findings"));
  findingsSnap.docs.forEach((d) => batch.delete(d.ref));
  const nodesSnap = await getDocs(collection(db, "scans", scanId, "sitemapNodes"));
  nodesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "scans", scanId));
  await batch.commit();
}

export function onUserScans(uid: string, cb: (scans: Scan[]) => void): Unsubscribe {
  if (!isConfigured()) { cb([]); return () => {}; }
  const q = query(
    collection(db, "scans"),
    where("userId", "==", uid),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ scanId: d.id, ...d.data() } as Scan)));
  });
}

export function onScan(scanId: string, cb: (scan: Scan | null) => void): Unsubscribe {
  if (!isConfigured()) { cb(null); return () => {}; }
  return onSnapshot(doc(db, "scans", scanId), (snap) => {
    cb(snap.exists() ? ({ scanId: snap.id, ...snap.data() } as Scan) : null);
  });
}

export async function incrementUserScans(uid: string) {
  if (!isConfigured()) return;
  await updateDoc(doc(db, "users", uid), { totalScans: increment(1) });
}

// ---- Findings ----
export async function getFindings(scanId: string): Promise<Finding[]> {
  if (!isConfigured()) return [];
  const snap = await getDocs(
    query(collection(db, "scans", scanId, "findings"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ findingId: d.id, ...d.data() } as Finding));
}

export function onFindings(scanId: string, cb: (findings: Finding[]) => void): Unsubscribe {
  if (!isConfigured()) { cb([]); return () => {}; }
  const q = query(collection(db, "scans", scanId, "findings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ findingId: d.id, ...d.data() } as Finding)));
  });
}

// ---- Sitemap Nodes ----
export async function getSitemapNodes(scanId: string): Promise<SitemapNode[]> {
  if (!isConfigured()) return [];
  const snap = await getDocs(collection(db, "scans", scanId, "sitemapNodes"));
  return snap.docs.map((d) => d.data() as SitemapNode);
}

export function onSitemapNodes(scanId: string, cb: (nodes: SitemapNode[]) => void): Unsubscribe {
  if (!isConfigured()) { cb([]); return () => {}; }
  return onSnapshot(collection(db, "scans", scanId, "sitemapNodes"), (snap) => {
    cb(snap.docs.map((d) => d.data() as SitemapNode));
  });
}
