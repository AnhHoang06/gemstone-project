import { useId, useState } from "react";
import { useWishlist } from "../wishlist/context";

export default function FavoriteToggle({ product }) {
  const { items, loading, busy, error, refresh, toggle } = useWishlist();
  const tooltipId = useId();
  const [attempted, setAttempted] = useState(false);
  const active = items?.some(item => item.id === product.id) ?? false;
  const label = active ? "Bỏ yêu thích" : "Yêu thích";
  return <span className="favorite-control">
    <button type="button" className={`favorite-toggle${active ? " is-active" : ""}`}
      aria-label={`${label}: ${product.name}`} aria-pressed={active} aria-describedby={tooltipId}
      aria-busy={busy} disabled={loading || busy} onClick={() => { setAttempted(true); void toggle(product.id); }}>
      <svg viewBox="0 0 24 24" width="21" height="21" aria-hidden="true" focusable="false"
        fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
    </button>
    <span id={tooltipId} className="favorite-tooltip" role="tooltip">{label}</span>
    {attempted && error && <span className="favorite-error" role="alert">{error} <button type="button" disabled={busy} onClick={refresh}>Tải lại</button></span>}
  </span>;
}
