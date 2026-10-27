import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/cart-toast.css";

export default function NotificationToast({ toast, onClose }) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [closing, setClosing] = useState(false);
  const remaining = useRef(4000);
  const paused = hovered || focused;
  useEffect(() => {
    if (paused || closing) return;
    const started = Date.now();
    const timer = setTimeout(() => setClosing(true), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - started));
    };
  }, [paused, closing]);
  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(onClose, 200);
    return () => clearTimeout(timer);
  }, [closing, onClose]);
  return <aside className={`cart-toast cart-toast--${toast.kind}${closing ? " cart-toast--closing" : ""}${paused ? " cart-toast--paused" : ""}`} aria-label={toast.label || "Thông báo giỏ hàng"}
    onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    onFocus={() => setFocused(true)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}>
    <span className="cart-toast-icon" aria-hidden="true">{toast.kind === "success" ? (toast.icon || "✓") : "!"}</span>
    <div className="cart-toast-content">
      <div role="status" aria-live="polite" aria-atomic="true">
        <p>{toast.message}</p>
        {toast.productName && <p className="cart-toast-product">{toast.productName}</p>}
      </div>
      <Link to={toast.actionPath || "/cart"} onClick={() => setClosing(true)}>{toast.actionLabel || "Xem giỏ hàng"}</Link>
    </div>
    <button type="button" className="cart-toast-close" aria-label={`Đóng ${toast.label?.toLowerCase() || "thông báo giỏ hàng"}`} onClick={() => setClosing(true)}>×</button>
    <span className="cart-toast-progress" aria-hidden="true" />
  </aside>;
}
