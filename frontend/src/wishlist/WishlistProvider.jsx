import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import api from "../api/api";
import { apiError, getSessionToken, isTokenExpired, logout, subscribeSession } from "../auth/session";
import { WishlistContext } from "./context";

export default function WishlistProvider({ children }) {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  return <WishlistSession key={token} token={token}>{children}</WishlistSession>;
}

function WishlistSession({ token, children }) {
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [wishlistToast, setWishlistToast] = useState(null);
  const toastNumber = useRef(0);
  const dismissWishlistToast = useCallback(() => setWishlistToast(null), []);
  const sequence = useRef(0);
  const mutating = useRef(false);
  const mounted = useRef(false);

  const refresh = useCallback(() => {
    if (!token || mutating.current) return;
    const request = ++sequence.current;
    const current = () => mounted.current && request === sequence.current && token === getSessionToken();
    return api.get("/wishlist").then(({ data }) => {
      if (current()) { setItems(data); setError(""); }
    }).catch(err => {
      if (current()) setError(apiError(err, "Không tải được danh sách yêu thích. Vui lòng thử lại."));
    }).finally(() => { if (current()) setLoading(false); });
  }, [token]);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    window.addEventListener("focus", refresh);
    const requests = sequence;
    return () => {
      mounted.current = false; ++requests.current;
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  async function toggle(productId) {
    if (!token || isTokenExpired(token)) { logout(); return false; }
    if (mutating.current || loading) return false;
    // A failed fetch must not guess whether POST or DELETE is intended.
    if (items === null || error) { await refresh(); return false; }
    mutating.current = true; setBusy(true); setError("");
    const request = ++sequence.current;
    const current = () => mounted.current && request === sequence.current && token === getSessionToken();
    try {
      const method = items.some(item => item.id === productId) ? "delete" : "post";
      const { data } = await api.request({ method, url: `/wishlist/${productId}` });
      if (!current()) return false;
      setItems(data); setLoading(false);
      setWishlistToast({ id: ++toastNumber.current, kind: "success",
        message: method === "post" ? "Đã thêm vào yêu thích" : "Đã xóa khỏi yêu thích",
        productName: (method === "post" ? data : items).find(item => item.id === productId)?.name });
      return true;
    } catch (err) {
      if (current()) {
        const message = apiError(err, "Không cập nhật được yêu thích. Vui lòng tải lại trước khi thử lại.");
        setError(message);
        setWishlistToast({ id: ++toastNumber.current, kind: "error", message });
      }
      return false;
    } finally {
      mutating.current = false;
      if (current()) setBusy(false);
    }
  }

  return <WishlistContext.Provider value={{ items, loading, busy, error, refresh, toggle, token,
    wishlistToast, dismissWishlistToast }}>{children}</WishlistContext.Provider>;
}
