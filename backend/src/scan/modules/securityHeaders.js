import { randomUUID } from "node:crypto";

const REQUIRED_HEADERS = [
  "content-security-policy",
  "x-frame-options",
  "x-content-type-options",
  "strict-transport-security",
];

export function runSecurityHeadersModule(scan, nodes) {
  const findings = [];
  for (const node of nodes) {
    if (!node.responseHeaders || node.statusCode <= 0) continue;
    const missing = REQUIRED_HEADERS.filter((h) => !node.responseHeaders[h]);
    if (missing.length === 0) continue;
    findings.push({
      findingId: randomUUID(),
      title: "Missing security headers",
      type: "misconfig",
      severity: "medium",
      url: node.url,
      method: node.method || "GET",
      parameter: "",
      payload: "",
      evidence: `Missing headers: ${missing.join(", ")}`,
      description: "The endpoint response omits recommended browser security headers.",
      aiExplanation: "Missing headers can increase exposure to clickjacking, MIME sniffing, and script injection attacks.",
      aiRemediation: "Set strong defaults at reverse proxy/app middleware for all required security headers.",
      businessImpact: "Medium risk for widespread exploitability across pages.",
      cvssScore: 5.4,
      businessRiskScore: 58,
      falsePositiveConfidence: 0.12,
      attackChain: [],
      isConfirmed: true,
      createdAt: new Date().toISOString(),
      module: "security_headers",
    });
  }
  return findings;
}
