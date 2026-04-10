import { storage } from "../../storage/database.js";
import { logger } from "../../utils/logger.js";

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
      max_tokens: 700
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI API error (${res.status}): ${t.slice(0, 300)}`);
  }
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || "";
}

export async function runAiSummaryModule(scanId) {
  const enabled = Boolean(process.env.OPENAI_API_KEY);
  if (!enabled) return { updated: false, skipped: true };

  const scan = await storage.getScanById(scanId);
  if (!scan) return { updated: false, skipped: false };

  const findings = await storage.getFindingsByScanId(scanId);
  const stats = scan.stats || { total: findings.length };

  const top = findings.slice(0, 8).map((f) => ({
    title: f.title,
    severity: f.severity,
    type: f.type,
    url: f.url,
  }));

  try {
    const text = await callOpenAI({
      system: "You are an expert security consultant and technical writer. You provide highly descriptive and detailed executive summaries.",
      user: `Write a deeply descriptive and highly detailed executive summary of the scan results. Provide 150-300 words describing the overall security posture, the impact of the specific vulnerabilities found, and a clear, actionable set of "Next steps" formatted nicely with bullet points.
Context:
targetUrl: ${scan.targetUrl}
stats: ${JSON.stringify(stats)}
topFindings: ${JSON.stringify(top)}
`,
    });
    if (!text) return { updated: false, skipped: false };

    storage.updateScan(scanId, { aiSummary: text });
    return { updated: true, skipped: false };
  } catch (err) {
    logger.warn("ai_summary_failed", { scanId, error: err instanceof Error ? err.message : String(err) });
    return { updated: false, skipped: false };
  }
}

