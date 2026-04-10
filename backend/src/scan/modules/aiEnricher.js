import { storage } from "../../storage/database.js";
import { logger } from "../../utils/logger.js";

function redact(text) {
  if (!text) return "";
  return String(text)
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[redacted_email]")
    .replace(/\bAKIA[0-9A-Z]{16}\b/g, "[redacted_aws_key]")
    .replace(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g, "[redacted_private_key]");
}

async function callOpenAI({ system, user }) {
  const apiKey = process.env.OPENAI_API_KEY || "";
  if (!apiKey) return null;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ],
      max_tokens: 700,
      response_format: { type: "json_object" }
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || "";
}

export async function runAiEnricherModule(scanId, options = {}) {
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  if (!enabled) return { enriched: 0, skipped: true };

  const maxFindings = options.maxFindings ?? 20;
  const findings = await storage.getFindingsByScanId(scanId);

  let enriched = 0;
  for (const f of findings.slice(0, maxFindings)) {
    try {
      const prompt = `Enrich this security finding. Return JSON with keys: aiExplanation, aiRemediation, businessImpact, cvssScore, businessRiskScore, falsePositiveConfidence (0..1). Crucially, the "aiExplanation" must be highly descriptive. The "aiRemediation" MUST provide concrete, recommended code snippets correctly formatted in markdown to fix the vulnerability.

Finding:
${JSON.stringify(
  {
    title: f.title,
    type: f.type,
    severity: f.severity,
    url: f.url,
    method: f.method,
    parameter: f.parameter,
    payload: redact(f.payload),
    evidence: redact(f.evidence),
    description: f.description,
  },
  null,
  2
)}`;

      const out = await callOpenAI({
        system: "You are a senior application security engineer. Be concise and practical.",
        user: prompt,
      });
      if (!out) continue;
      let parsed = null;
      try {
        parsed = JSON.parse(out);
      } catch {
        // If model returns non-JSON, skip safely.
        continue;
      }

      await storage.updateFinding(f.findingId, {
        aiExplanation: String(parsed.aiExplanation || ""),
        aiRemediation: String(parsed.aiRemediation || ""),
        businessImpact: String(parsed.businessImpact || ""),
        cvssScore: Number(parsed.cvssScore || f.cvssScore || 0),
        businessRiskScore: Number(parsed.businessRiskScore || f.businessRiskScore || 0),
        falsePositiveConfidence: Number(parsed.falsePositiveConfidence ?? f.falsePositiveConfidence ?? 0),
      });
      enriched += 1;
    } catch (err) {
      logger.warn("ai_enrich_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { enriched, skipped: false };
}

