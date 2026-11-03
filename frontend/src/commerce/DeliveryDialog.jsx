import { useEffect, useRef } from "react";

export default function DeliveryDialog({ saving, onClose, children }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} className="commerce-dialog delivery-dialog" aria-labelledby="delivery-title" aria-busy={saving}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
    onClick={event => {
      if (saving || event.target !== event.currentTarget) return;
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <h2 id="delivery-title">Thông tin giao hàng</h2>
    {children}
  </dialog>;
}
