import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  Timestamp,
  increment,
  writeBatch,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Scan, Finding, SitemapNode, User } from "@/types";

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
const useBackendApi = Boolean(apiBaseUrl);

let apiUnreachableHintShown = false;
function warnApiUnreachableOnce() {
  if (apiUnreachableHintShown || !useBackendApi) return;
  apiUnreachableHintShown = true;
  console.warn(
    `[Chain Breaker AI] Cannot reach the backend at ${apiBaseUrl} (connection refused or network error).\n` +
      "The API must be running for SQLite-backed scans. From repo root: npm run dev\n" +
      "Or only backend: cd backend && npm run dev\n" +
      "Match VITE_API_BASE_URL in frontend/.env to the port shown in the backend log (backend_started), then restart Vite.\n" +
      "This is not a port conflict — nothing is listening on that port until the backend starts."
  );
}

/** Cached GET /health so we do not spam /api/scans every few seconds when the server is down (reduces console noise). */
let healthCache: { ok: boolean; expiresAt: number } = { ok: false, expiresAt: 0 };

async function isBackendUp(): Promise<boolean> {
  if (!useBackendApi) return false;
  const now = Date.now();
  if (now < healthCache.expiresAt) {
    return healthCache.ok;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 4000);
  try {
    const r = await fetch(`${apiBaseUrl}/health`, { signal: ac.signal });
    clearTimeout(timer);
    const ok = r.ok;
    healthCache = { ok, expiresAt: now + (ok ? 5000 : 15000) };
    if (!ok) warnApiUnreachableOnce();
    return ok;
  } catch {
    clearTimeout(timer);
    healthCache = { ok: false, expiresAt: now + 15000 };
    warnApiUnreachableOnce();
    return false;
  }
}

// Check if Firebase is configured
function isConfigured(): boolean {
  return Boolean(import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID);
}

function sortScans(scans: Scan[]) {
  return scans.sort((a, b) => {
    const aTime = a.createdAt?.toMillis?.()
      ? a.createdAt.toMillis()
      : new Date((a as any).createdAt ?? 0).getTime();
    const bTime = b.createdAt?.toMillis?.()
      ? b.createdAt.toMillis()
      : new Date((b as any).createdAt ?? 0).getTime();
    return bTime - aTime;
  });
}

async function apiGet<T>(path: string, opts?: { skipUnreachableWarn?: boolean }): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`);
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    return response.json() as Promise<T>;
  } catch (err) {
    if (!opts?.skipUnreachableWarn) warnApiUnreachableOnce();
    throw err;
  }
}

async function apiJson<T>(path: string, method: string, body?: unknown): Promise<T> {
  try {
    const response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) throw new Error(`API request failed (${response.status})`);
    if (response.status === 204) return {} as T;
    return response.json() as Promise<T>;
  } catch (err) {
    warnApiUnreachableOnce();
    throw err;
  }
}

export interface AuthCaptureSession {
  authSessionId: string;
  status: "pending" | "completed";
  createdAt: string;
  expiresAt: string;
  instructions?: string[];
  payload?: Record<string, unknown>;
}

function poll<T>(fn: () => Promise<T>, cb: (value: T) => void, ms = 2000): Unsubscribe {
  let active = true;
  const run = async () => {
    if (!active) return;
    try {
      const value = await fn();
      if (active) cb(value);
    } catch {
      /* Backend down: warnApiUnreachableOnce already logged from apiGet */
    }
  };
  void run();
  const interval = setInterval(run, ms);
  return () => {
    active = false;
    clearInterval(interval);
  };
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

export function onUserScans(uid: string, cb: (scans: Scan[]) => void): Unsubscribe {
  if (useBackendApi) {
    return poll(async () => {
      if (!(await isBackendUp())) {
        return [] as Scan[];
      }
      try {
        const result = await apiGet<{ scans: Scan[] }>(
          `/api/scans?userId=${encodeURIComponent(uid)}`,
          { skipUnreachableWarn: true }
        );
        return sortScans(result.scans || []);
      } catch {
        healthCache = { ok: false, expiresAt: Date.now() + 3000 };
        return [] as Scan[];
      }
    }, cb, 2500);
  }

  if (!isConfigured()) { cb([]); return () => {}; }
  const q = query(
    collection(db, "scans"),
    where("userId", "==", uid)
  );
  return onSnapshot(
    q,
    (snap) => {
      const scans = snap.docs.map((d) => ({ scanId: d.id, ...d.data() } as Scan));
      scans.sort((a, b) => {
        const aTime = a.createdAt?.toMillis?.() ?? 0;
        const bTime = b.createdAt?.toMillis?.() ?? 0;
        return bTime - aTime;
      });
      cb(scans);
    },
    (error) => {
      console.error("[Firestore] onUserScans listener failed:", error);
      cb([]);
    }
  );
}

export function onScan(scanId: string, cb: (scan: Scan | null) => void): Unsubscribe {
  if (useBackendApi) {
    return poll(async () => {
      if (!(await isBackendUp())) return null;
      try {
        const result = await apiGet<{ scan: Scan }>(`/api/scans/${scanId}`, { skipUnreachableWarn: true });
        return result.scan || null;
      } catch {
        healthCache = { ok: false, expiresAt: Date.now() + 3000 };
        return null;
      }
    }, cb, 1500);
  }

  if (!isConfigured()) { cb(null); return () => {}; }
  return onSnapshot(doc(db, "scans", scanId), (snap) => {
    cb(snap.exists() ? ({ scanId: snap.id, ...snap.data() } as Scan) : null);
  });
}

export async function incrementUserScans(uid: string) {
  if (useBackendApi) return;
  if (!isConfigured()) return;
  await updateDoc(doc(db, "users", uid), { totalScans: increment(1) });
}

// ---- Findings ----
export async function getFindings(scanId: string): Promise<Finding[]> {
  if (useBackendApi) {
    if (!(await isBackendUp())) return [];
    try {
      const result = await apiGet<{ findings: Finding[] }>(`/api/scans/${scanId}/findings`, {
        skipUnreachableWarn: true,
      });
      return result.findings || [];
    } catch {
      return [];
    }
  }
  if (!isConfigured()) return [];
  const snap = await getDocs(
    query(collection(db, "scans", scanId, "findings"), orderBy("createdAt", "desc"))
  );
  return snap.docs.map((d) => ({ findingId: d.id, ...d.data() } as Finding));
}

export function onFindings(scanId: string, cb: (findings: Finding[]) => void): Unsubscribe {
  if (useBackendApi) {
    return poll(async () => {
      if (!(await isBackendUp())) {
        return [] as Finding[];
      }
      try {
        const result = await apiGet<{ findings: Finding[] }>(`/api/scans/${scanId}/findings`, {
          skipUnreachableWarn: true,
        });
        return result.findings || [];
      } catch {
        healthCache = { ok: false, expiresAt: Date.now() + 3000 };
        return [] as Finding[];
      }
    }, cb, 2500);
  }

  if (!isConfigured()) { cb([]); return () => {}; }
  const q = query(collection(db, "scans", scanId, "findings"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ findingId: d.id, ...d.data() } as Finding)));
  });
}

// ---- Sitemap Nodes ----
export async function getSitemapNodes(scanId: string): Promise<SitemapNode[]> {
  if (useBackendApi) {
    if (!(await isBackendUp())) return [];
    try {
      const result = await apiGet<{ nodes: SitemapNode[] }>(`/api/scans/${scanId}/nodes`, {
        skipUnreachableWarn: true,
      });
      return result.nodes || [];
    } catch {
      return [];
    }
  }
  if (!isConfigured()) return [];
  const snap = await getDocs(collection(db, "scans", scanId, "sitemapNodes"));
  return snap.docs.map((d) => d.data() as SitemapNode);
}

export function onSitemapNodes(scanId: string, cb: (nodes: SitemapNode[]) => void): Unsubscribe {
  if (useBackendApi) {
    return poll(async () => {
      if (!(await isBackendUp())) {
        return [] as SitemapNode[];
      }
      try {
        const result = await apiGet<{ nodes: SitemapNode[] }>(`/api/scans/${scanId}/nodes`, {
          skipUnreachableWarn: true,
        });
        return result.nodes || [];
      } catch {
        healthCache = { ok: false, expiresAt: Date.now() + 3000 };
        return [] as SitemapNode[];
      }
    }, cb, 2500);
  }

  if (!isConfigured()) { cb([]); return () => {}; }
  return onSnapshot(collection(db, "scans", scanId, "sitemapNodes"), (snap) => {
    cb(snap.docs.map((d) => d.data() as SitemapNode));
  });
}

// Backend API overrides for scan CRUD
export async function createScan(data: Omit<Scan, "scanId">): Promise<string> {
  if (useBackendApi) {
    const result = await apiJson<{ scanId: string }>("/api/scans", "POST", data);
    return result.scanId;
  }
  if (!isConfigured()) return "demo-scan-" + Date.now();
  const ref = await addDoc(collection(db, "scans"), data);
  return ref.id;
}

export async function getScan(scanId: string): Promise<Scan | null> {
  if (useBackendApi) {
    if (!(await isBackendUp())) return null;
    try {
      const result = await apiGet<{ scan: Scan }>(`/api/scans/${scanId}`, { skipUnreachableWarn: true });
      return result.scan || null;
    } catch {
      return null;
    }
  }
  if (!isConfigured()) return null;
  const snap = await getDoc(doc(db, "scans", scanId));
  return snap.exists() ? ({ scanId: snap.id, ...snap.data() } as Scan) : null;
}

export async function updateScan(scanId: string, data: Partial<Scan>) {
  if (useBackendApi) {
    await apiJson(`/api/scans/${scanId}`, "PATCH", data);
    return;
  }
  if (!isConfigured()) return;
  await updateDoc(doc(db, "scans", scanId), data);
}

export async function deleteScanFull(scanId: string) {
  if (useBackendApi) {
    await apiJson(`/api/scans/${scanId}`, "DELETE");
    return;
  }
  if (!isConfigured()) return;
  const batch = writeBatch(db);
  const findingsSnap = await getDocs(collection(db, "scans", scanId, "findings"));
  findingsSnap.docs.forEach((d) => batch.delete(d.ref));
  const nodesSnap = await getDocs(collection(db, "scans", scanId, "sitemapNodes"));
  nodesSnap.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(doc(db, "scans", scanId));
  await batch.commit();
}

export async function startAuthCaptureSession(userId: string, targetUrl: string): Promise<AuthCaptureSession> {
  if (!useBackendApi) {
    throw new Error("Auth capture requires the backend API. Set VITE_API_BASE_URL and start the backend.");
  }
  const result = await apiJson<{ session: AuthCaptureSession }>("/api/auth-capture/start", "POST", {
    userId,
    targetUrl,
  });
  return result.session;
}

export async function completeAuthCaptureSession(
  authSessionId: string,
  payload: Record<string, unknown>
): Promise<AuthCaptureSession> {
  if (!useBackendApi) {
    throw new Error("Auth capture requires the backend API. Set VITE_API_BASE_URL and start the backend.");
  }
  const result = await apiJson<{ session: AuthCaptureSession }>("/api/auth-capture/complete", "POST", {
    authSessionId,
    payload,
  });
  return result.session;
}
