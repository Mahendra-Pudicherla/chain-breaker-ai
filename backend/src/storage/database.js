import { mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const dataDir = join(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });
const dbPath = join(dataDir, "scanner.db");

const db = new DatabaseSync(dbPath);

function ensureColumn(table, column, typeSql) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some((c) => String(c.name).toLowerCase() === column.toLowerCase());
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${typeSql}`);
}

db.exec(`
CREATE TABLE IF NOT EXISTS scans (
  scanId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  targetUrl TEXT NOT NULL,
  scanProfile TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  currentModule TEXT NOT NULL DEFAULT '',
  authConfig TEXT NOT NULL,
  roles TEXT NOT NULL,
  scope TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  completedAt TEXT,
  aiSummary TEXT NOT NULL DEFAULT '',
  stats TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'beginner',
  ownershipConfirmed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS nodes (
  nodeId TEXT PRIMARY KEY,
  scanId TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS findings (
  findingId TEXT PRIMARY KEY,
  scanId TEXT NOT NULL,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scanId TEXT NOT NULL,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  authSessionId TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  expiresAt TEXT NOT NULL
);
`);

ensureColumn("scans", "ownershipConfirmed", "INTEGER NOT NULL DEFAULT 0");

const insertScanStmt = db.prepare(`
INSERT INTO scans (
  scanId, userId, targetUrl, scanProfile, status, progress, currentModule,
  authConfig, roles, scope, createdAt, completedAt, aiSummary, stats, mode, ownershipConfirmed
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateScanStmt = db.prepare(`
UPDATE scans SET
  status = COALESCE(?, status),
  progress = COALESCE(?, progress),
  currentModule = COALESCE(?, currentModule),
  completedAt = COALESCE(?, completedAt),
  aiSummary = COALESCE(?, aiSummary),
  stats = COALESCE(?, stats),
  authConfig = COALESCE(?, authConfig),
  roles = COALESCE(?, roles),
  scope = COALESCE(?, scope)
WHERE scanId = ?
`);

const countScansStmt = db.prepare("SELECT COUNT(*) as cnt FROM scans");

function parseScanRow(row) {
  if (!row) return null;
  return {
    scanId: row.scanId,
    userId: row.userId,
    targetUrl: row.targetUrl,
    scanProfile: row.scanProfile,
    status: row.status,
    progress: row.progress,
    currentModule: row.currentModule,
    authConfig: JSON.parse(row.authConfig),
    roles: JSON.parse(row.roles),
    scope: JSON.parse(row.scope),
    createdAt: row.createdAt,
    completedAt: row.completedAt,
    aiSummary: row.aiSummary,
    stats: JSON.parse(row.stats),
    mode: row.mode || "beginner",
    ownershipConfirmed: Boolean(row.ownershipConfirmed),
  };
}

export const storage = {
  createScan(input) {
    const scanId = randomUUID();
    const createdAt = new Date().toISOString();
    const scan = {
      scanId,
      userId: input.userId,
      targetUrl: input.targetUrl,
      scanProfile: input.scanProfile || "quick",
      status: "queued",
      progress: 0,
      currentModule: "",
      authConfig: input.authConfig || { type: "none", credentials: {} },
      roles: input.roles || [],
      scope: input.scope || { include: [], exclude: [] },
      createdAt,
      completedAt: null,
      aiSummary: "",
      stats: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
      mode: input.mode || "beginner",
      ownershipConfirmed: Boolean(input.ownershipConfirmed),
    };
    insertScanStmt.run(
      scan.scanId,
      scan.userId,
      scan.targetUrl,
      scan.scanProfile,
      scan.status,
      scan.progress,
      scan.currentModule,
      JSON.stringify(scan.authConfig),
      JSON.stringify(scan.roles),
      JSON.stringify(scan.scope),
      scan.createdAt,
      scan.completedAt,
      scan.aiSummary,
      JSON.stringify(scan.stats),
      scan.mode,
      scan.ownershipConfirmed ? 1 : 0
    );
    db.prepare("INSERT INTO queue(scanId, createdAt) VALUES (?, ?)").run(scanId, createdAt);
    return scan;
  },

  importLegacyScan(scan) {
    // Idempotent import: if scanId already exists, skip.
    const existing = db.prepare("SELECT scanId FROM scans WHERE scanId = ?").get(scan.scanId);
    if (existing) return this.getScan(scan.scanId);

    insertScanStmt.run(
      scan.scanId,
      scan.userId,
      scan.targetUrl,
      scan.scanProfile || "quick",
      scan.status || "completed",
      Number(scan.progress ?? 100),
      scan.currentModule || "",
      JSON.stringify(scan.authConfig || { type: "none", credentials: {} }),
      JSON.stringify(scan.roles || []),
      JSON.stringify(scan.scope || { include: [], exclude: [] }),
      scan.createdAt || new Date().toISOString(),
      scan.completedAt ?? null,
      scan.aiSummary || "",
      JSON.stringify(scan.stats || { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 }),
      scan.mode || "beginner",
      scan.ownershipConfirmed ? 1 : 0
    );

    if (Array.isArray(scan.nodes) && scan.nodes.length > 0) {
      this.setNodes(scan.scanId, scan.nodes);
    }
    if (Array.isArray(scan.findings) && scan.findings.length > 0) {
      this.addFindings(scan.scanId, scan.findings);
    }
    return this.getScan(scan.scanId);
  },

  updateScan(scanId, patch) {
    updateScanStmt.run(
      patch.status ?? null,
      patch.progress ?? null,
      patch.currentModule ?? null,
      patch.completedAt ?? null,
      patch.aiSummary ?? null,
      patch.stats ? JSON.stringify(patch.stats) : null,
      patch.authConfig ? JSON.stringify(patch.authConfig) : null,
      patch.roles ? JSON.stringify(patch.roles) : null,
      patch.scope ? JSON.stringify(patch.scope) : null,
      scanId
    );
    return this.getScan(scanId);
  },

  listScans(userId) {
    const rows = userId
      ? db.prepare("SELECT * FROM scans WHERE userId = ? ORDER BY createdAt DESC").all(userId)
      : db.prepare("SELECT * FROM scans ORDER BY createdAt DESC").all();
    return rows.map(parseScanRow);
  },

  getScan(scanId) {
    const row = db.prepare("SELECT * FROM scans WHERE scanId = ?").get(scanId);
    return parseScanRow(row);
  },

  deleteScan(scanId) {
    db.prepare("DELETE FROM findings WHERE scanId = ?").run(scanId);
    db.prepare("DELETE FROM nodes WHERE scanId = ?").run(scanId);
    db.prepare("DELETE FROM queue WHERE scanId = ?").run(scanId);
    db.prepare("DELETE FROM scans WHERE scanId = ?").run(scanId);
  },

  setNodes(scanId, nodes) {
    db.prepare("DELETE FROM nodes WHERE scanId = ?").run(scanId);
    const stmt = db.prepare("INSERT INTO nodes(nodeId, scanId, data) VALUES (?, ?, ?)");
    for (const node of nodes) {
      stmt.run(randomUUID(), scanId, JSON.stringify(node));
    }
  },

  addFindings(scanId, findings) {
    const stmt = db.prepare("INSERT INTO findings(findingId, scanId, data) VALUES (?, ?, ?)");
    for (const finding of findings) {
      stmt.run(finding.findingId || randomUUID(), scanId, JSON.stringify(finding));
    }
  },

  // ---- Helpers expected by cursor.rules (Promise-based wrappers) ----
  saveFinding(finding) {
    this.addFindings(finding.scanId, [finding]);
    return Promise.resolve();
  },

  getFindingsByScanId(scanId) {
    const findings = this.listFindings(scanId);
    const sevOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
    findings.sort((a, b) => (sevOrder[a.severity] ?? 9) - (sevOrder[b.severity] ?? 9));
    return Promise.resolve(findings);
  },

  updateFinding(findingId, fields) {
    const row = db.prepare("SELECT data FROM findings WHERE findingId = ?").get(findingId);
    if (!row) return Promise.resolve(null);
    const obj = JSON.parse(row.data);
    const updated = { ...obj, ...fields };
    db.prepare("UPDATE findings SET data = ? WHERE findingId = ?").run(JSON.stringify(updated), findingId);
    return Promise.resolve(updated);
  },

  getScanById(scanId) {
    return Promise.resolve(this.getScan(scanId));
  },

  getNodesByScanId(scanId) {
    return Promise.resolve(this.listNodes(scanId));
  },

  listFindings(scanId) {
    const rows = db.prepare("SELECT data FROM findings WHERE scanId = ?").all(scanId);
    return rows.map((r) => JSON.parse(r.data));
  },

  listNodes(scanId) {
    const rows = db.prepare("SELECT data FROM nodes WHERE scanId = ?").all(scanId);
    return rows.map((r) => JSON.parse(r.data));
  },

  dequeue() {
    const row = db.prepare("SELECT id, scanId FROM queue ORDER BY id ASC LIMIT 1").get();
    if (!row) return null;
    db.prepare("DELETE FROM queue WHERE id = ?").run(row.id);
    return row.scanId;
  },

  queueLength() {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM queue").get();
    return row?.cnt || 0;
  },

  createAuthSession(userId, payload = {}) {
    const authSessionId = randomUUID();
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    db.prepare(
      "INSERT INTO auth_sessions(authSessionId, userId, status, payload, createdAt, expiresAt) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(authSessionId, userId, "pending", JSON.stringify(payload), createdAt, expiresAt);
    return { authSessionId, createdAt, expiresAt, status: "pending" };
  },

  completeAuthSession(authSessionId, payload = {}) {
    db.prepare("UPDATE auth_sessions SET status = 'completed', payload = ? WHERE authSessionId = ?").run(
      JSON.stringify(payload),
      authSessionId
    );
    return this.getAuthSession(authSessionId);
  },

  getAuthSession(authSessionId) {
    const row = db.prepare("SELECT * FROM auth_sessions WHERE authSessionId = ?").get(authSessionId);
    if (!row) return null;
    return {
      authSessionId: row.authSessionId,
      userId: row.userId,
      status: row.status,
      payload: JSON.parse(row.payload),
      createdAt: row.createdAt,
      expiresAt: row.expiresAt,
    };
  },
};

export function hasLegacyJsonStore() {
  const legacyPath = join(dataDir, "scans.json");
  return existsSync(legacyPath);
}

export function migrateLegacyJsonIfNeeded() {
  const legacyPath = join(dataDir, "scans.json");
  if (!existsSync(legacyPath)) return { migrated: 0 };

  const cntRow = countScansStmt.get();
  const existingCount = cntRow?.cnt || 0;
  if (existingCount > 0) return { migrated: 0 };

  let parsed;
  try {
    parsed = JSON.parse(readFileSync(legacyPath, "utf8"));
  } catch {
    return { migrated: 0 };
  }

  const scansObj = parsed?.scans && typeof parsed.scans === "object" ? parsed.scans : {};
  const scans = Object.values(scansObj);
  let migrated = 0;
  for (const scan of scans) {
    if (!scan || !scan.scanId) continue;
    storage.importLegacyScan(scan);
    migrated += 1;
  }
  return { migrated };
}
