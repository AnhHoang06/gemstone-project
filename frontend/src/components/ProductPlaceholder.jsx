export default function ProductPlaceholder({ label = true }) {
  return <span className="product-placeholder"><svg viewBox="0 0 80 80" width="56" height="56" aria-hidden="true" focusable="false"><path d="M18 15h44l14 18-36 35L4 33zM4 33h72M18 15l22 53 22-53M18 15l22 18 22-18" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>{label && <span>Chưa có ảnh</span>}</span>;
}
