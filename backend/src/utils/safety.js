const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^\[::1\]$/,
];

const ALLOWED_TEST_TARGETS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "dvwa",
  "testphp.vulnweb.com",
  "demo.testfire.net",
  "juice-shop.herokuapp.com",
];

export function parseHostname(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function isAllowedTargetUrl(url) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, reason: "Only http/https targets are supported." };
    }
    const host = parsed.hostname;
    if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) {
      return { ok: false, reason: "Private/local network targets are blocked." };
    }
    return { ok: true, reason: "" };
  } catch {
    return { ok: false, reason: "Invalid URL." };
  }
}

export function isActiveTestingAllowed(scan) {
  const host = parseHostname(scan.targetUrl);
  if (!host) return false;
  if (PRIVATE_HOST_PATTERNS.some((p) => p.test(host))) return true;
  if (ALLOWED_TEST_TARGETS.includes(host)) return true;
  return Boolean(scan.ownershipConfirmed === true);
}

export function isInScope(url, scan) {
  const include = scan.scope?.include || [];
  const exclude = scan.scope?.exclude || [];
  if (exclude.some((p) => url.includes(p.replace("*", "")))) return false;
  if (include.length === 0) return true;
  return include.some((p) => url.includes(p.replace("*", "")));
}
