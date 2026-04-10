import { randomUUID } from "node:crypto";

export function runAuthChecksModule(scan, nodes) {
  const findings = [];
  if (scan.authConfig?.type === "none") {
    findings.push({
      findingId: randomUUID(),
      title: "Unauthenticated scan mode selected",
      type: "broken_auth",
      severity: "info",
      url: scan.targetUrl,
      method: "GET",
      parameter: "",
      payload: "",
      evidence: "authConfig.type = none",
      description: "No authentication context was supplied for this run.",
      aiExplanation: "Protected routes may not be fully covered without valid session context.",
      aiRemediation: "Use guided auth capture or provide token/session config.",
      businessImpact: "Coverage gap risk for protected endpoints.",
      cvssScore: 0,
      businessRiskScore: 20,
      falsePositiveConfidence: 0,
      attackChain: [],
      isConfirmed: true,
      createdAt: new Date().toISOString(),
      module: "auth_checks",
    });
  }

  const adminLike = nodes.filter((n) => /\/admin|\/manage|\/internal/i.test(n.url));
  for (const node of adminLike.slice(0, 10)) {
    if (node.statusCode >= 200 && node.statusCode < 300 && scan.authConfig?.type === "none") {
      findings.push({
        findingId: randomUUID(),
        title: "Potential exposed privileged route",
        type: "rbac",
        severity: "high",
        url: node.url,
        method: node.method || "GET",
        parameter: "",
        payload: "",
        evidence: `Status ${node.statusCode} without auth context`,
        description: "A route with privileged naming patterns returned success in unauthenticated mode.",
        aiExplanation: "This could indicate missing access control enforcement.",
        aiRemediation: "Enforce role checks and deny-by-default policy for privileged paths.",
        businessImpact: "Potential unauthorized access to sensitive actions/data.",
        cvssScore: 8.1,
        businessRiskScore: 84,
        falsePositiveConfidence: 0.35,
        attackChain: [],
        isConfirmed: false,
        createdAt: new Date().toISOString(),
        module: "auth_checks",
      });
    }
  }

  return findings;
}
