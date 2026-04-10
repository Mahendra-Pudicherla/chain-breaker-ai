import { parseHostname, isInScope } from "../utils/safety.js";

function classifyNode(url, contentType) {
  if (url.includes("/api") || (contentType || "").includes("json")) return "api";
  if ((contentType || "").includes("html")) return "page";
  return "asset";
}

export async function crawlWithHttp(scan, options = {}) {
  const discovered = [];
  const visited = new Set();
  const host = parseHostname(scan.targetUrl);
  const maxDepth =
    scan.scanProfile === "quick" ? 1 : scan.scanProfile === "api-only" ? 1 : 2;
  const maxNodes = scan.scanProfile === "quick" ? 40 : 120;
  const queue = [{ url: scan.targetUrl, depth: 0, parentUrl: "" }];

  while (queue.length && discovered.length < maxNodes) {
    const current = queue.shift();
    if (!current || visited.has(current.url) || current.depth > maxDepth) continue;
    if (!isInScope(current.url, scan)) continue;
    visited.add(current.url);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs || 10000);
    try {
      const response = await fetch(current.url, {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
      });
      const contentType = response.headers.get("content-type") || "";
      const body = await response.text();
      const nodeType = classifyNode(current.url, contentType);
      discovered.push({
        url: current.url,
        method: "GET",
        type: nodeType,
        depth: current.depth,
        parentUrl: current.parentUrl,
        statusCode: response.status,
        scanned: true,
        vulnerable: false,
        responseHeaders: Object.fromEntries(response.headers.entries()),
        responseSample: body.slice(0, 1200),
      });

      if (nodeType === "page" && current.depth < maxDepth) {
        const hrefs = [...body.matchAll(/href=["']([^"'#]+)["']/gi)].map((m) => m[1]);
        for (const href of hrefs.slice(0, 50)) {
          try {
            const next = new URL(href, current.url).toString();
            if (parseHostname(next) !== host) continue;
            queue.push({ url: next, depth: current.depth + 1, parentUrl: current.url });
          } catch {
            // ignore malformed urls
          }
        }
      }
    } catch {
      discovered.push({
        url: current.url,
        method: "GET",
        type: "page",
        depth: current.depth,
        parentUrl: current.parentUrl,
        statusCode: 0,
        scanned: false,
        vulnerable: false,
        responseHeaders: {},
        responseSample: "",
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  return discovered;
}
