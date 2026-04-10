import { randomUUID } from "node:crypto";
import { isActiveTestingAllowed } from "../../utils/safety.js";

function bumpId(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return String(n + 1);
}

export async function runIdorChecksModule(scan, nodes, options = {}) {
  if (!isActiveTestingAllowed(scan)) return [];
  const timeoutMs = options.timeoutMs ?? 10000;
  const max = options.maxEndpoints ?? 30;

  const candidates = (nodes || [])
    .filter((n) => (n.method || "GET").toUpperCase() === "GET")
    .filter((n) => typeof n.url === "string")
    .filter((n) => /\/\d+(\b|\/|\?)/.test(n.url))
    .slice(0, max);

  const findings = [];
  for (const node of candidates) {
    const url = node.url;
    const mutated = url.replace(/\/(\d+)(\b|\/|\?)/, (m, id, tail) => {
      const b = bumpId(id);
      return b ? `/${b}${tail}` : m;
    });
    if (mutated === url) continue;

    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(mutated, { signal: ac.signal, redirect: "manual" });
      if (res.status === 200) {
        findings.push({
          findingId: randomUUID(),
          scanId: scan.scanId,
          title: "Potential IDOR (insecure direct object reference)",
          type: "idor",
          severity: "medium",
          url,
          method: "GET",
          parameter: "path",
          payload: mutated,
          evidence: `A nearby object ID returned HTTP 200: ${mutated}`,
          description:
            "IDOR can occur when object identifiers are directly accessible and authorization is not enforced per-object/per-user.",
          aiExplanation: "",
          aiRemediation:
            "Enforce authorization checks on every object access (server-side). Avoid relying on obscurity of IDs; consider using scoped IDs.",
          businessImpact: "Attackers may access or modify other users' data.",
          cvssScore: 6.8,
          businessRiskScore: 6.5,
          falsePositiveConfidence: 0.4,
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

