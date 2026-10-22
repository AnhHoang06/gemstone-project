import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/refinements.css";
import { validateStoredSession } from "./auth/session";
import CommerceProvider from "./commerce/CommerceProvider";
import "./styles/commerce.css";

validateStoredSession();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CommerceProvider><App /></CommerceProvider>
  </StrictMode>,
)
