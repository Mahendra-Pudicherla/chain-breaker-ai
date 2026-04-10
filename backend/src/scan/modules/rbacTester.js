import { randomUUID } from "node:crypto";
import { isActiveTestingAllowed } from "../../utils/safety.js";

function headerFromRole(role) {
  if (!role) return {};
  const headers = {};
  if (role.token) headers.Authorization = role.token.startsWith("Bearer ") ? role.token : `Bearer ${role.token}`;
  if (role.cookies) headers.Cookie = role.cookies;
  return headers;
}

export async function runRbacTesterModule(scan, nodes, options = {}) {
  if (!isActiveTestingAllowed(scan)) return [];
  const timeoutMs = options.timeoutMs ?? 10000;
  const max = options.maxEndpoints ?? 20;

  const roles = Array.isArray(scan.roles) ? scan.roles.filter((r) => r?.name) : [];
  if (roles.length < 2) return [];

  const candidates = (nodes || [])
    .filter((n) => (n.method || "GET").toUpperCase() === "GET")
    .filter((n) => typeof n.url === "string")
    .filter((n) => /(admin|manage|settings|users|roles|permissions)/i.test(n.url))
    .slice(0, max);

  const findings = [];
  for (const node of candidates) {
    const url = node.url;
    const results = [];
    for (const role of roles) {
      const ac = new AbortController();
      const t = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const res = await fetch(url, { signal: ac.signal, headers: headerFromRole(role), redirect: "manual" });
        results.push({ role: role.name, status: res.status });
      } catch {
        results.push({ role: role.name, status: 0 });
      } finally {
        clearTimeout(t);
      }
    }

    const okRoles = results.filter((r) => r.status === 200);
    if (okRoles.length >= 2) {
      findings.push({
        findingId: randomUUID(),
        scanId: scan.scanId,
        title: "RBAC anomaly: multiple roles can access privileged endpoint",
        type: "rbac",
        severity: "medium",
        url,
        method: "GET",
        parameter: "",
        payload: "",
        evidence: `HTTP 200 for roles: ${okRoles.map((r) => r.role).join(", ")}`,
        description:
          "Role-based access control should restrict privileged routes to authorized roles only. Multiple roles receiving 200 may indicate overly broad permissions.",
        aiExplanation: "",
        aiRemediation:
          "Review authorization middleware and role checks. Add explicit allowlists per route and add tests ensuring least-privilege access.",
        businessImpact: "Over-privileged roles increase risk of unauthorized admin actions and data exposure.",
        cvssScore: 6.0,
        businessRiskScore: 6.2,
        falsePositiveConfidence: 0.45,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return findings;
}

