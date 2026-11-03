import { useEffect, useState, useSyncExternalStore } from "react";

export function usePageVisible() {
  return useSyncExternalStore(listener => {
    document.addEventListener("visibilitychange", listener);
    return () => document.removeEventListener("visibilitychange", listener);
  }, () => document.visibilityState !== "hidden", () => true);
}

// Re-render periodically so relative times ("5 phút trước") stay fresh.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(timer); }, [intervalMs]);
  return now;
}
