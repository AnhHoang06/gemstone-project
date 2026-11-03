// Only same-origin, in-app paths are accepted as post-login destinations (no open redirects).
const AUTH_PAGES = new Set(["/login", "/register"]);

const hasControlCharacter = value => [...value].some(character => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127);

export function safeNextPath(value) {
  if (typeof value !== "string" || value.length > 512) return null;
  // Must be a rooted path; reject protocol-relative ("//host"), backslash tricks and control characters.
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\") || hasControlCharacter(value)) return null;
  try {
    const url = new URL(value, window.location.origin);
    if (url.origin !== window.location.origin || AUTH_PAGES.has(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export function withNext(path, next) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}
