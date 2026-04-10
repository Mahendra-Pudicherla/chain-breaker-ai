import { logger } from "../../utils/logger.js";

async function resendSend({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY || "";
  const from = process.env.RESEND_FROM_EMAIL || "";
  if (!apiKey || !from) return { ok: false, reason: "missing_keys" };

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Resend API error (${res.status}): ${t.slice(0, 300)}`);
  }
  return { ok: true };
}

export async function runEmailNotifierModule(scan, stats) {
  const to = process.env.NOTIFY_EMAIL_TO || "";
  const frontendUrl = process.env.FRONTEND_URL || "";
  if (!to || !frontendUrl) return { sent: false, skipped: true };

  const reportUrl = `${frontendUrl.replace(/\/$/, "")}/scan/${scan.scanId}/report`;
  const subject = `Chain Breaker AI — scan complete: ${stats.total} finding(s)`;
  const html = `
    <div style="font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto;">
      <h2>Scan completed</h2>
      <p><strong>Target:</strong> ${scan.targetUrl}</p>
      <p><strong>Findings:</strong> ${stats.total} (critical ${stats.critical}, high ${stats.high}, medium ${stats.medium}, low ${stats.low}, info ${stats.info})</p>
      <p><a href="${reportUrl}">Open report</a></p>
    </div>
  `;

  try {
    const r = await resendSend({ to, subject, html });
    return { sent: r.ok, skipped: false };
  } catch (err) {
    logger.warn("email_notify_failed", { scanId: scan.scanId, error: err instanceof Error ? err.message : String(err) });
    return { sent: false, skipped: false };
  }
}

