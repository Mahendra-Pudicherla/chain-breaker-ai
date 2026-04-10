import { randomUUID } from "node:crypto";
import { isActiveTestingAllowed } from "../../utils/safety.js";

function withParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

function looksLikeSqlError(body) {
  const s = String(body || "").toLowerCase();
  return (
    s.includes("you have an error in your sql syntax") ||
    s.includes("warning: mysql") ||
    s.includes("unclosed quotation mark") ||
    s.includes("quoted string not properly terminated") ||
    s.includes("pg_query()") ||
    s.includes("sqlite3.operationalerror") ||
    s.includes("ora-01756") ||
    s.includes("microsoft ole db provider for sql server")
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

const IGNORE_PARAMS = new Set(["_token", "csrf", "authenticity_token", "__requestverificationtoken"]);

export async function runSqlInjectionModule(scan, nodes, options = {}) {
  if (!isActiveTestingAllowed(scan)) return [];
  const timeoutMs = options.timeoutMs ?? 8000;
  const max = options.maxEndpoints ?? 25;
  const payloads = options.payloads ?? ["' OR '1'='1", "1; DROP TABLE users--", "' UNION SELECT null,null,null--"];
  const delayMs = options.delayMs ?? 300;

  const candidates = (nodes || [])
    .filter((n) => (n.method || "GET").toUpperCase() === "GET")
    .filter((n) => typeof n.url === "string")
    .filter((n) => {
      try {
        const u = new URL(n.url);
        return [...u.searchParams.keys()].length > 0;
      } catch {
        return false;
      }
    })
    .slice(0, max);

  const findings = [];
  for (const node of candidates) {
    const baseUrl = node.url;
    const u = new URL(baseUrl);
    const params = [...u.searchParams.keys()]
      .filter((p) => !IGNORE_PARAMS.has(p.toLowerCase()))
      .slice(0, 3);
    for (const param of params) {
      for (const payload of payloads) {
        const testUrl = withParam(baseUrl, param, payload);
        const ac = new AbortController();
        const t = setTimeout(() => ac.abort(), timeoutMs);
        try {
          const res = await fetch(testUrl, { signal: ac.signal });
          const body = await res.text();
          if (looksLikeSqlError(body)) {
            findings.push({
              findingId: randomUUID(),
              scanId: scan.scanId,
              title: "SQL Injection",
              type: "sqli",
              severity: "critical",
              url: testUrl,
              method: "GET",
              parameter: param,
              payload,
              evidence: String(body || "").slice(0, 500),
              description:
                `SQL injection vulnerability detected in parameter ${param}. The application returned a database error when a crafted SQL payload was injected, indicating the input is not properly sanitised before being used in a SQL query.`,
              aiExplanation: "",
              aiRemediation: "Use parameterized queries/ORM, validate input, and avoid string concatenation in SQL. Add WAF rules as defense-in-depth.",
              businessImpact: "Attackers may read/modify data or bypass authentication depending on query context.",
              cvssScore: 8.6,
              businessRiskScore: 8.0,
              falsePositiveConfidence: 0.3,
              createdAt: new Date().toISOString(),
            });
            break;
          }
          if (res.status >= 500) {
            findings.push({
              findingId: randomUUID(),
              scanId: scan.scanId,
              title: "Possible SQL Injection",
              type: "sqli",
              severity: "high",
              url: testUrl,
              method: "GET",
              parameter: param,
              payload,
              evidence: `Server returned HTTP ${res.status} to SQL payload.`,
              description: "Possible SQL injection — server returned error response to SQL payload.",
              aiExplanation: "",
              aiRemediation: "Use parameterized queries and handle input safely; investigate server errors and add input validation.",
              businessImpact: "Server errors can indicate injection or unsafe query construction.",
              cvssScore: 7.6,
              businessRiskScore: 7.0,
              falsePositiveConfidence: 0.55,
              createdAt: new Date().toISOString(),
            });
          }
        } catch {
          // ignore
        } finally {
          clearTimeout(t);
        }
        await sleep(delayMs);
      }
    }
  }
  return findings;
}

