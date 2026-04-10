import { randomUUID } from "node:crypto";

function hasCsrfToken(html) {
  if (!html) return false;
  const s = String(html);
  return /name=["']csrf["']/i.test(s) || /name=["']_csrf["']/i.test(s) || /csrf-token/i.test(s);
}

function getCookieHeader(scan) {
  const creds = scan?.authConfig?.credentials || {};
  const cookie = creds.cookies || "";
  return cookie ? { Cookie: cookie } : {};
}

export async function runCsrfChecksModule(scan, nodes, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10000;
  const max = options.maxEndpoints ?? 30;

  const targets = (nodes || [])
    .filter((n) => (n.method || "GET").toUpperCase() === "GET")
    .filter((n) => typeof n.url === "string")
    .slice(0, max);

  const findings = [];
  for (const node of targets) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(node.url, { signal: ac.signal, headers: { ...getCookieHeader(scan) } });
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("text/html")) continue;
      const body = await res.text();
      if (!body || body.length < 200) continue;
      const hasForms = /<form[\s>]/i.test(body);
      if (!hasForms) continue;

      const tokenPresent = hasCsrfToken(body);
      if (!tokenPresent) {
        findings.push({
          findingId: randomUUID(),
          scanId: scan.scanId,
          title: "Potential CSRF protection missing",
          type: "csrf",
          severity: "medium",
          url: node.url,
          method: "GET",
          parameter: "",
          payload: "",
          evidence: "Detected HTML form(s) but could not find common CSRF token patterns.",
          description:
            "CSRF tokens (or equivalent protections like SameSite cookies and double-submit tokens) help prevent cross-site request forgery on state-changing requests.",
          aiExplanation: "",
          aiRemediation:
            "Add CSRF protections to state-changing endpoints (POST/PUT/PATCH/DELETE): per-request CSRF tokens, SameSite cookies where appropriate, and verify Origin/Referer.",
          businessImpact: "Users could be tricked into performing unintended actions while authenticated.",
          cvssScore: 6.5,
          businessRiskScore: 6.0,
          falsePositiveConfidence: 0.35,
          createdAt: new Date().toISOString(),
        });
      }
    } catch {
      // ignore fetch errors
    } finally {
      clearTimeout(t);
    }
  }
  return findings;
}

