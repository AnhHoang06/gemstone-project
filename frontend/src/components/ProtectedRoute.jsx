import { Navigate, useLocation } from "react-router-dom";
import { withNext } from "../pages/auth/nextPath";

function ProtectedRoute({ children }) {
  const token = localStorage.getItem("token");
  const location = useLocation();

  if (!token) {
    // Come back to the page the visitor asked for after signing in.
    return <Navigate to={withNext("/login", `${location.pathname}${location.search}`)} replace />;
  }

  return children;
}

export default ProtectedRoute;
