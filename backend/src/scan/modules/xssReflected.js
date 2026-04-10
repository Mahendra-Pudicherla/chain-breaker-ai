import { randomUUID } from "node:crypto";
import { isActiveTestingAllowed } from "../../utils/safety.js";

function withParam(url, key, value) {
  const u = new URL(url);
  u.searchParams.set(key, value);
  return u.toString();
}

export async function runXssReflectedModule(scan, nodes, options = {}) {
  if (!isActiveTestingAllowed(scan)) return [];
  const timeoutMs = options.timeoutMs ?? 10000;
  const max = options.maxEndpoints ?? 25;
  const payload = options.payload ?? `"><svg/onload=console.log("xss_probe")>`;

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
    const params = [...u.searchParams.keys()].slice(0, 3);
    for (const param of params) {
      const testUrl = withParam(baseUrl, param, payload);
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(testUrl, { signal: ac.signal });
        const body = await res.text();
        if (body && body.includes(payload)) {
          findings.push({
            findingId: randomUUID(),
            scanId: scan.scanId,
            title: "Potential reflected XSS",
            type: "xss_reflected",
            severity: "high",
            url: baseUrl,
            method: "GET",
            parameter: param,
            payload,
            evidence: "Probe payload was reflected verbatim in the HTTP response body.",
            description: "Reflected XSS can occur when user-controlled input is embedded in HTML/JS contexts without proper output encoding.",
            aiExplanation: "",
            aiRemediation:
              "Apply context-aware output encoding, use templating auto-escaping, and add a strict CSP. Validate/normalize inputs server-side.",
            businessImpact: "Attackers may execute scripts in users' browsers, steal sessions, or perform actions as the user.",
            cvssScore: 8.0,
            businessRiskScore: 7.5,
            falsePositiveConfidence: 0.25,
            createdAt: new Date().toISOString(),
          });
        }
      } catch {
        // ignore
      } finally {
        clearTimeout(t);
      }
    }
  }
  return findings;
}

