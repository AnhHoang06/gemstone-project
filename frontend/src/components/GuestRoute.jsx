import { useSyncExternalStore } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { getSessionToken, isTokenExpired, subscribeSession } from "../auth/session";
import { safeNextPath } from "../pages/auth/nextPath";

export default function GuestRoute({ children }) {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  const [params] = useSearchParams();
  // Local expiry validation is for navigation only; the API still validates the JWT.
  if (!isTokenExpired(token)) {
    // Signing in re-renders this guard before Login's own navigate(), so an internal ?next= is honored here too.
    return <Navigate to={safeNextPath(params.get("next")) || (localStorage.getItem("role") === "Admin" ? "/admin/dashboard" : "/")} replace />;
  }
  return children;
}
