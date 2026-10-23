import { useEffect, useRef } from "react";

export default function CancelOrderDialog({ orderId, saving, error, onClose, onConfirm, fallbackFocus }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const fallback = fallbackFocus.current;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previousFocus?.isConnected) previousFocus.focus();
      else fallback?.focus();
    };
  }, [fallbackFocus]);
  return <dialog ref={dialogRef} className="commerce-dialog" aria-labelledby="cancel-order-title"
    aria-describedby="cancel-order-description" aria-busy={saving}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <p className="eyebrow">Gem Aurelia · Đơn hàng</p>
    <h2 id="cancel-order-title">Hủy đơn #{orderId}?</h2>
    <p id="cancel-order-description">Chỉ đơn chờ xác nhận mới có thể hủy. Sản phẩm sẽ được hoàn lại tồn kho.</p>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="commerce-actions">
      <button className="btn btn-outline" autoFocus disabled={saving} onClick={onClose}>Giữ đơn</button>
      <button className="btn btn-danger" disabled={saving} onClick={onConfirm}>{saving ? "Đang hủy..." : "Xác nhận hủy"}</button>
    </div>
  </dialog>;
}
