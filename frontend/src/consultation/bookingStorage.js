// Booking selections survive the login round-trip (sessionStorage, this tab only).
// The pending request (with its requestId) is scoped to the signed-in user, like checkout drafts.
const DRAFT_KEY = "gem-aurelia:booking-draft";
const requestKey = userId => `gem-aurelia:booking-request:${userId}`;

function read(key) {
  try { const value = JSON.parse(sessionStorage.getItem(key)); return value && typeof value === "object" ? value : null; }
  catch { return null; }
}

export const bookingStorage = {
  readDraft: () => read(DRAFT_KEY),
  writeDraft: draft => sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)),
  clearDraft: () => sessionStorage.removeItem(DRAFT_KEY),
  readRequest: userId => { const value = read(requestKey(userId)); return value?.requestId ? value : null; },
  writeRequest: (userId, request) => sessionStorage.setItem(requestKey(userId), JSON.stringify(request)),
  clearRequest: userId => sessionStorage.removeItem(requestKey(userId)),
};
