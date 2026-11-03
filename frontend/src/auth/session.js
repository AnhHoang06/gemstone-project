export function clearSession() {
  for (const key of ["token", "role", "fullName"]) localStorage.removeItem(key);
  clearCheckoutDrafts();
  window.dispatchEvent(new Event("auth-session-changed"));
}

function clearCheckoutDrafts() {
  localStorage.removeItem("gem-aurelia:recent-products");
  for (const key of Object.keys(sessionStorage))
    // Drafts may hold contact names and phone numbers: never keep them across sessions.
    if (key.startsWith("commerce-checkout:") || key.startsWith("gem-aurelia:booking-request:")) sessionStorage.removeItem(key);
}

export function getSessionToken() { return localStorage.getItem("token") || ""; }

export function saveSession(data) {
  clearCheckoutDrafts();
  for (const key of ["token", "role", "fullName"]) localStorage.setItem(key, data[key]);
  window.dispatchEvent(new Event("auth-session-changed"));
}

export function subscribeSession(listener) {
  const onStorage = (event) => {
    if (event.key === "token" || event.key === null) { clearCheckoutDrafts(); listener(); }
  };
  window.addEventListener("auth-session-changed", listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener("auth-session-changed", listener);
    window.removeEventListener("storage", onStorage);
  };
}

function decodeSegment(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment) || segment.length % 4 === 1) {
    throw new Error("Malformed JWT segment");
  }
  const base64 = segment.replace(/-/g, "+").replace(/_/g, "/");
  return atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "="));
}

function decodeObject(segment) {
  const bytes = Uint8Array.from(decodeSegment(segment), (character) => character.charCodeAt(0));
  const value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Malformed JWT JSON");
  }
  return value;
}

// UX check only: true also means missing/unreadable expiry. This does NOT
// verify the signature, issuer, audience, or server-side account permissions.
export function isTokenExpired(token) {
  try {
    if (typeof token !== "string") return true;
    const segments = token.split(".");
    if (segments.length !== 3) return true;
    decodeObject(segments[0]);
    const payload = decodeObject(segments[1]);
    decodeSegment(segments[2]);
    return typeof payload.exp !== "number" || !Number.isFinite(payload.exp) ||
      payload.exp <= Date.now() / 1000;
  } catch {
    return true;
  }
}

export function validateStoredSession() {
  if (isTokenExpired(localStorage.getItem("token"))) {
    clearSession();
    return false;
  }
  return true;
}

export function logout() {
  clearSession();
  if (window.location.pathname !== "/login") window.location.replace("/login");
}

export function apiError(error, fallback) {
  if (error.response?.status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  const data = error.response?.data;
  return data?.message || (data?.errors && Object.values(data.errors).flat().join(" ")) || fallback;
}
