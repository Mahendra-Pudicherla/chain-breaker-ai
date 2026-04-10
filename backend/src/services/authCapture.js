import { storage } from "../storage/database.js";

export function startAuthCapture(userId, targetUrl) {
  const session = storage.createAuthSession(userId, {
    targetUrl,
    cookies: [],
    headers: {},
    localStorage: {},
  });
  return {
    ...session,
    instructions: [
      "Open the target login page in your browser.",
      "Authenticate manually (OAuth/session flow).",
      "Copy cookie/header values and submit completion payload.",
    ],
  };
}

export function completeAuthCapture(authSessionId, payload) {
  return storage.completeAuthSession(authSessionId, payload);
}
