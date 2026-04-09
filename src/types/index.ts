import { Timestamp } from "firebase/firestore";

// Enums
export enum ScanStatus {
  Queued = "queued",
  Crawling = "crawling",
  Scanning = "scanning",
  Analyzing = "analyzing",
  Completed = "completed",
  Failed = "failed",
}

export enum Severity {
  Critical = "critical",
  High = "high",
  Medium = "medium",
  Low = "low",
  Info = "info",
}

export enum FindingType {
  SQLi = "sqli",
  XSS = "xss",
  CSRF = "csrf",
  IDOR = "idor",
  SSRF = "ssrf",
  OpenRedirect = "open_redirect",
  BrokenAuth = "broken_auth",
  Misconfig = "misconfig",
  SensitiveData = "sensitive_data",
  RBAC = "rbac",
  API = "api",
  Logic = "logic",
}

export enum ScanProfile {
  Quick = "quick",
  Full = "full",
  APIOnly = "api-only",
}

// Interfaces
export interface User {
  uid: string;
  email: string;
  displayName: string;
  createdAt: Timestamp;
  plan: "free" | "pro";
  totalScans: number;
  notificationPrefs?: {
    onScanComplete: boolean;
    onCriticalFinding: boolean;
    notificationEmail: string;
  };
  apiKeys?: {
    claudeApiKey: string;
    resendApiKey: string;
  };
}

export interface AuthConfig {
  type: "none" | "session" | "jwt" | "oauth";
  credentials: Record<string, string>;
}

export interface RoleConfig {
  name: string;
  token: string;
  cookies: string;
}

export interface ScanStats {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface Scan {
  scanId: string;
  userId: string;
  targetUrl: string;
  scanProfile: ScanProfile;
  status: ScanStatus;
  progress: number;
  currentModule: string;
  authConfig: AuthConfig;
  roles: RoleConfig[];
  scope: {
    include: string[];
    exclude: string[];
  };
  createdAt: Timestamp;
  completedAt: Timestamp | null;
  aiSummary: string;
  stats: ScanStats;
}

export interface Finding {
  findingId: string;
  title: string;
  type: FindingType;
  severity: Severity;
  url: string;
  method: string;
  parameter: string;
  payload: string;
  evidence: string;
  description: string;
  aiExplanation: string;
  aiRemediation: string;
  businessImpact: string;
  cvssScore: number;
  businessRiskScore: number;
  falsePositiveConfidence: number;
  attackChain: string[];
  isConfirmed: boolean;
  createdAt: Timestamp;
}

export interface SitemapNode {
  url: string;
  method: string;
  type: "page" | "api" | "form" | "asset";
  depth: number;
  parentUrl: string;
  statusCode: number;
  scanned: boolean;
  vulnerable: boolean;
}

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
