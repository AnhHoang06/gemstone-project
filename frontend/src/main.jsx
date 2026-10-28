import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "bootstrap/dist/css/bootstrap.min.css";
import './index.css'
import App from './App.jsx'
import "bootstrap/dist/js/bootstrap.bundle.min.js";
import "./styles/refinements.css";
import { validateStoredSession } from "./auth/session";
import CommerceProvider from "./commerce/CommerceProvider";
import "./styles/commerce.css";
import WishlistProvider from "./wishlist/WishlistProvider";
import "./styles/wishlist.css";
import "./styles/catalog-layout.css";
import "./styles/theme.css";

validateStoredSession();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CommerceProvider><WishlistProvider><App /></WishlistProvider></CommerceProvider>
  </StrictMode>,
)
