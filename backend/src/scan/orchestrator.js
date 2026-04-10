import { storage } from "../storage/database.js";
import { logger } from "../utils/logger.js";
import { crawlWithHttp } from "./httpCrawler.js";
import { discoverWithBrowser } from "./browserWorker.js";
import { runSecurityHeadersModule } from "./modules/securityHeaders.js";
import { runAuthChecksModule } from "./modules/authChecks.js";
import { runReflectionChecksModule } from "./modules/reflectionChecks.js";
import { runCsrfChecksModule } from "./modules/csrfChecks.js";
import { runSensitiveDataModule } from "./modules/sensitiveData.js";
import { runSqlInjectionModule } from "./modules/sqlInjection.js";
import { runXssReflectedModule } from "./modules/xssReflected.js";
import { runIdorChecksModule } from "./modules/idorChecks.js";
import { runRbacTesterModule } from "./modules/rbacTester.js";
import { runAiEnricherModule } from "./modules/aiEnricher.js";
import { runAiSummaryModule } from "./modules/aiSummary.js";
import { runEmailNotifierModule } from "./modules/emailNotifier.js";

function dedupeNodes(nodes) {
  const map = new Map();
  for (const node of nodes) {
    const key = `${node.method || "GET"}::${node.url}`;
    if (!map.has(key)) map.set(key, node);
  }
  return [...map.values()];
}

function computeStats(findings) {
  const stats = { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 };
  for (const f of findings) {
    stats.total += 1;
    if (f.severity in stats) stats[f.severity] += 1;
  }
  return stats;
}

export class ScanOrchestrator {
  constructor() {
    this.busy = false;
    this.metrics = {
      scansStarted: 0,
      scansCompleted: 0,
      scansFailed: 0,
      averageDurationMs: 0,
    };
  }

  queueLength() {
    return storage.queueLength();
  }

  getMetrics() {
    return this.metrics;
  }

  schedule() {
    if (this.busy) return;
    const scanId = storage.dequeue();
    if (!scanId) return;
    this.busy = true;
    void this.run(scanId).finally(() => {
      this.busy = false;
      this.schedule();
    });
  }

  async run(scanId) {
    const scan = storage.getScan(scanId);
    if (!scan) return;
    this.metrics.scansStarted += 1;
    const startedAt = Date.now();
    logger.info("scan_started", { scanId, targetUrl: scan.targetUrl });

    try {
      storage.updateScan(scanId, { status: "crawling", progress: 8, currentModule: "crawler" });
      const httpNodes = await crawlWithHttp(scan, { timeoutMs: 10000 });

      storage.updateScan(scanId, { status: "scanning", progress: 35, currentModule: "browser_worker" });
      const browserNodes = await discoverWithBrowser(scan);

      const allNodes = dedupeNodes([...httpNodes, ...browserNodes]);
      storage.setNodes(scanId, allNodes);

      storage.updateScan(scanId, { status: "scanning", progress: 55, currentModule: "security_headers" });
      const headersFindings = runSecurityHeadersModule(scan, allNodes);
      storage.addFindings(scanId, headersFindings);

      storage.updateScan(scanId, { status: "scanning", progress: 68, currentModule: "auth_checks" });
      const authFindings = runAuthChecksModule(scan, allNodes);
      storage.addFindings(scanId, authFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 82, currentModule: "reflection_checks" });
      const reflectionFindings = await runReflectionChecksModule(scan, allNodes);
      storage.addFindings(scanId, reflectionFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 86, currentModule: "sql_injection" });
      const sqliFindings = await runSqlInjectionModule(scan, allNodes);
      storage.addFindings(scanId, sqliFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 89, currentModule: "xss_reflected" });
      const xssFindings = await runXssReflectedModule(scan, allNodes);
      storage.addFindings(scanId, xssFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 91, currentModule: "csrf_checks" });
      const csrfFindings = await runCsrfChecksModule(scan, allNodes);
      storage.addFindings(scanId, csrfFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 93, currentModule: "idor_checks" });
      const idorFindings = await runIdorChecksModule(scan, allNodes);
      storage.addFindings(scanId, idorFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 95, currentModule: "sensitive_data" });
      const sensitiveFindings = await runSensitiveDataModule(scan, allNodes);
      storage.addFindings(scanId, sensitiveFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 97, currentModule: "rbac_tester" });
      const rbacFindings = await runRbacTesterModule(scan, allNodes);
      storage.addFindings(scanId, rbacFindings);

      storage.updateScan(scanId, { status: "analyzing", progress: 98, currentModule: "ai_enrichment" });
      await runAiEnricherModule(scanId);

      storage.updateScan(scanId, { status: "analyzing", progress: 99, currentModule: "ai_summary" });
      await runAiSummaryModule(scanId);

      const findings = storage.listFindings(scanId);
      const stats = computeStats(findings);
      const finalScan = storage.getScan(scanId) || scan;
      storage.updateScan(scanId, {
        status: "completed",
        progress: 100,
        currentModule: "report",
        completedAt: new Date().toISOString(),
        aiSummary: storage.getScan(scanId)?.aiSummary || `Live scan completed. ${stats.total} findings across ${allNodes.length} discovered endpoints.`,
        stats,
      });

      // non-blocking notification
      void runEmailNotifierModule(finalScan, stats);

      const durationMs = Date.now() - startedAt;
      this.metrics.scansCompleted += 1;
      const prev = this.metrics.averageDurationMs;
      const count = this.metrics.scansCompleted;
      this.metrics.averageDurationMs = Math.round((prev * (count - 1) + durationMs) / count);
      logger.info("scan_completed", { scanId, durationMs, findings: stats.total, nodes: allNodes.length });
    } catch (error) {
      this.metrics.scansFailed += 1;
      storage.updateScan(scanId, {
        status: "failed",
        completedAt: new Date().toISOString(),
        currentModule: "failed",
      });
      logger.error("scan_failed", { scanId, error: error instanceof Error ? error.message : String(error) });
    }
  }
}
