import { logger } from "../utils/logger.js";
import { parseHostname } from "../utils/safety.js";

export async function discoverWithBrowser(scan) {
  let playwright;
  try {
    playwright = await import("playwright");
  } catch {
    logger.warn("Playwright unavailable, skipping browser fallback", { scanId: scan.scanId });
    return [];
  }

  const discovered = [];
  const host = parseHostname(scan.targetUrl);
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto(scan.targetUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
    const hrefs = await page.$$eval("a[href]", (els) =>
      els.map((a) => a.getAttribute("href")).filter(Boolean)
    );
    for (const href of hrefs.slice(0, 100)) {
      try {
        const url = new URL(href, scan.targetUrl).toString();
        if (parseHostname(url) !== host) continue;
        discovered.push({
          url,
          method: "GET",
          type: "page",
          depth: 1,
          parentUrl: scan.targetUrl,
          statusCode: 200,
          scanned: false,
          vulnerable: false,
        });
      } catch {
        // ignore invalid urls
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }
  return discovered;
}
