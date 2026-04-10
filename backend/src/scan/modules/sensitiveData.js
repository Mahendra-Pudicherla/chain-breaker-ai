import { randomUUID } from "node:crypto";

const SENSITIVE_PATTERNS = [
  { name: "AWS Access Key", re: /\bAKIA[0-9A-Z]{16}\b/g, severity: "high" },
  { name: "JWT", re: /\beyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\b/g, severity: "medium" },
  { name: "Email address", re: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, severity: "low" },
  { name: "Private Key header", re: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
];

function clampEvidence(text, maxLen = 600) {
  if (!text) return "";
  const s = String(text);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}

export async function runSensitiveDataModule(scan, nodes, options = {}) {
  const timeoutMs = options.timeoutMs ?? 10000;
  const max = options.maxEndpoints ?? 40;

  const targets = (nodes || [])
    .filter((n) => (n.method || "GET").toUpperCase() === "GET")
    .filter((n) => typeof n.url === "string")
    .slice(0, max);

  const findings = [];
  for (const node of targets) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(node.url, { signal: ac.signal });
      const ct = res.headers.get("content-type") || "";
      if (!/(text\/html|application\/json|text\/plain)/i.test(ct)) continue;
      const body = await res.text();
      if (!body) continue;

      for (const p of SENSITIVE_PATTERNS) {
        const m = body.match(p.re);
        if (!m || m.length === 0) continue;
        const sample = m.slice(0, 3).join(", ");
        findings.push({
          findingId: randomUUID(),
          scanId: scan.scanId,
          title: `Potential sensitive data exposed: ${p.name}`,
          type: "sensitive_data",
          severity: p.severity,
          url: node.url,
          method: "GET",
          parameter: "",
          payload: "",
          evidence: clampEvidence(`Matched ${p.name}: ${sample}`),
          description: "The response appears to contain data that may be sensitive. This could indicate accidental exposure in HTML/JSON responses.",
          aiExplanation: "",
          aiRemediation:
            "Remove secrets/tokens from responses, ensure server-side redaction, and rotate any exposed credentials immediately. Add scanning in CI to prevent future leaks.",
          businessImpact: "Exposed credentials or personal data can lead to account compromise, data leaks, or abuse.",
          cvssScore: p.severity === "critical" ? 9.5 : p.severity === "high" ? 8.2 : p.severity === "medium" ? 6.4 : 3.7,
          businessRiskScore: p.severity === "critical" ? 9.0 : p.severity === "high" ? 8.0 : p.severity === "medium" ? 6.0 : 3.5,
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

  return findings;
}

