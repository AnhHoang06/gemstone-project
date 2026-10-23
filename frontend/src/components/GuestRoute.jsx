import { useSyncExternalStore } from "react";
import { Navigate } from "react-router-dom";
import { getSessionToken, isTokenExpired, subscribeSession } from "../auth/session";

export default function GuestRoute({ children }) {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  // Local expiry validation is for navigation only; the API still validates the JWT.
  if (!isTokenExpired(token)) {
    return <Navigate to={localStorage.getItem("role") === "Admin" ? "/admin/dashboard" : "/"} replace />;
  }
  return children;
}
