import { randomUUID } from "node:crypto";

const SAFE_PAYLOAD = "__chainbreaker_probe__";

export async function runReflectionChecksModule(scan, nodes) {
  const findings = [];
  const candidates = nodes.filter((n) => n.type === "page").slice(0, 30);
  for (const node of candidates) {
    try {
      const u = new URL(node.url);
      u.searchParams.set("cb_probe", SAFE_PAYLOAD);
      const response = await fetch(u.toString(), { method: "GET", redirect: "follow" });
      const body = await response.text();
      if (!body.includes(SAFE_PAYLOAD)) continue;

      findings.push({
        findingId: randomUUID(),
        title: "Reflected input detected",
        type: "xss",
        severity: "medium",
        url: u.toString(),
        method: "GET",
        parameter: "cb_probe",
        payload: SAFE_PAYLOAD,
        evidence: "Payload appears in response body without encoding",
        description: "A reflection probe value appeared in server response.",
        aiExplanation: "Reflection can become exploitable if context escaping is weak.",
        aiRemediation: "Apply output encoding by context and validate input boundaries.",
        businessImpact: "Potential client-side script injection risk.",
        cvssScore: 6.1,
        businessRiskScore: 62,
        falsePositiveConfidence: 0.42,
        attackChain: [],
        isConfirmed: false,
        createdAt: new Date().toISOString(),
        module: "reflection_checks",
      });
    } catch {
      // ignore probe failures
    }
  }
  return findings;
}
