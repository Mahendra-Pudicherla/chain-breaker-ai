import "dotenv/config";
import { createServer } from "node:http";
import { storage, hasLegacyJsonStore, migrateLegacyJsonIfNeeded } from "./storage/database.js";
import { ScanOrchestrator } from "./scan/orchestrator.js";
import { startAuthCapture, completeAuthCapture } from "./services/authCapture.js";
import { isAllowedTargetUrl } from "./utils/safety.js";
import { logger } from "./utils/logger.js";

const preferredPort = Number(process.env.PORT || 5000);
const PORT_TRY_COUNT = Number(process.env.PORT_TRY_COUNT || 15);
const orchestrator = new ScanOrchestrator();
const rateWindowMs = 60_000;
const maxReqPerMinute = 180;
const requestLedger = new Map();

const migration = migrateLegacyJsonIfNeeded();
if (migration.migrated > 0) {
  logger.info("legacy_migration_completed", { migrated: migration.migrated });
}

function json(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  });
  res.end(JSON.stringify(payload));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function enforceRateLimit(req) {
  const ip = req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const slot = requestLedger.get(ip) || { start: now, count: 0 };
  if (now - slot.start > rateWindowMs) {
    slot.start = now;
    slot.count = 0;
  }
  slot.count += 1;
  requestLedger.set(ip, slot);
  return slot.count <= maxReqPerMinute;
}

const server = createServer((req, res) => {
  if (req.method === "OPTIONS") return json(res, 204, {});
  if (!enforceRateLimit(req)) return json(res, 429, { message: "Rate limit exceeded" });

  const reqUrl = new URL(req.url || "/", `http://localhost:${preferredPort}`);
  const path = reqUrl.pathname;

  if (req.method === "GET" && path === "/health") {
    return json(res, 200, {
      ok: true,
      workerBusy: orchestrator.busy,
      queueLength: orchestrator.queueLength(),
      metrics: orchestrator.getMetrics(),
      storage: "sqlite",
      legacyJsonDetected: hasLegacyJsonStore(),
    });
  }

  if (req.method === "GET" && path === "/api/scans") {
    const userId = reqUrl.searchParams.get("userId");
    return json(res, 200, { scans: storage.listScans(userId || undefined) });
  }

  if (req.method === "POST" && path === "/api/scans") {
    return void parseBody(req)
      .then((body) => {
        if (!body?.userId || !body?.targetUrl) {
          return json(res, 400, { message: "userId and targetUrl are required" });
        }
        const safe = isAllowedTargetUrl(body.targetUrl);
        if (!safe.ok) return json(res, 400, { message: safe.reason });
        const scan = storage.createScan(body);
        orchestrator.schedule();
        return json(res, 201, { scanId: scan.scanId, scan });
      })
      .catch((error) => json(res, 400, { message: error.message || "Invalid request body" }));
  }

  if (req.method === "GET" && /^\/api\/scans\/[^/]+$/.test(path)) {
    const scanId = path.split("/")[3];
    const scan = storage.getScan(scanId);
    if (!scan) return json(res, 404, { message: "Scan not found" });
    return json(res, 200, { scan });
  }

  if (req.method === "GET" && /^\/api\/scans\/[^/]+\/live$/.test(path)) {
    const scanId = path.split("/")[3];
    const scan = storage.getScan(scanId);
    if (!scan) return json(res, 404, { message: "Scan not found" });
    const nodes = storage.listNodes(scanId);
    const findings = storage.listFindings(scanId);
    return json(res, 200, {
      scan,
      counters: { nodes: nodes.length, findings: findings.length },
      modules: { current: scan.currentModule, progress: scan.progress },
    });
  }

  if (req.method === "PATCH" && /^\/api\/scans\/[^/]+$/.test(path)) {
    const scanId = path.split("/")[3];
    return void parseBody(req)
      .then((body) => {
        const updated = storage.updateScan(scanId, body || {});
        if (!updated) return json(res, 404, { message: "Scan not found" });
        return json(res, 200, { scan: updated });
      })
      .catch((error) => json(res, 400, { message: error.message || "Invalid request body" }));
  }

  if (req.method === "DELETE" && /^\/api\/scans\/[^/]+$/.test(path)) {
    const scanId = path.split("/")[3];
    storage.deleteScan(scanId);
    return json(res, 204, {});
  }

  if (req.method === "GET" && /^\/api\/scans\/[^/]+\/findings$/.test(path)) {
    const scanId = path.split("/")[3];
    return json(res, 200, { findings: storage.listFindings(scanId) });
  }

  if (req.method === "GET" && /^\/api\/scans\/[^/]+\/nodes$/.test(path)) {
    const scanId = path.split("/")[3];
    return json(res, 200, { nodes: storage.listNodes(scanId) });
  }

  if (req.method === "POST" && path === "/api/auth-capture/start") {
    return void parseBody(req)
      .then((body) => {
        if (!body?.userId || !body?.targetUrl) {
          return json(res, 400, { message: "userId and targetUrl are required" });
        }
        const session = startAuthCapture(body.userId, body.targetUrl);
        return json(res, 201, { session });
      })
      .catch((error) => json(res, 400, { message: error.message || "Invalid request body" }));
  }

  if (req.method === "POST" && path === "/api/auth-capture/complete") {
    return void parseBody(req)
      .then((body) => {
        if (!body?.authSessionId) return json(res, 400, { message: "authSessionId is required" });
        const session = completeAuthCapture(body.authSessionId, body.payload || {});
        if (!session) return json(res, 404, { message: "Auth capture session not found" });
        return json(res, 200, { session });
      })
      .catch((error) => json(res, 400, { message: error.message || "Invalid request body" }));
  }

  if (req.method === "GET" && /^\/api\/auth-capture\/[^/]+$/.test(path)) {
    const authSessionId = path.split("/")[3];
    const session = storage.getAuthSession(authSessionId);
    if (!session) return json(res, 404, { message: "Auth capture session not found" });
    return json(res, 200, { session });
  }

  return json(res, 404, { ok: false, message: "Not Found" });
});

function listenOnPort(srv, p) {
  return new Promise((resolve, reject) => {
    const onErr = (err) => {
      srv.off("error", onErr);
      reject(err);
    };
    srv.once("error", onErr);
    srv.listen(p, () => {
      srv.off("error", onErr);
      resolve(p);
    });
  });
}

(async () => {
  for (let i = 0; i < PORT_TRY_COUNT; i++) {
    const tryPort = preferredPort + i;
    try {
      await listenOnPort(server, tryPort);
      if (tryPort !== preferredPort) {
        logger.warn("port_fallback", {
          requested: preferredPort,
          bound: tryPort,
          hint: `Set VITE_API_BASE_URL=http://localhost:${tryPort} in frontend/.env`,
        });
      }
      logger.info("backend_started", { port: tryPort });
      return;
    } catch (err) {
      if (err?.code !== "EADDRINUSE") {
        logger.error("listen_failed", { error: err instanceof Error ? err.message : String(err) });
        process.exit(1);
      }
    }
  }
  logger.error("port_in_use", {
    portsTried: `${preferredPort}–${preferredPort + PORT_TRY_COUNT - 1}`,
    hint: "Stop other Node/backend processes (Task Manager or netstat -ano | findstr :5000 then taskkill /PID <pid> /F) or set PORT in backend/.env to a free port.",
  });
  process.exit(1);
})();
