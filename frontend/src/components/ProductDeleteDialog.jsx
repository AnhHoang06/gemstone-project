import { useEffect, useRef } from "react";

export default function ProductDeleteDialog({ product, deleting, error, onCancel, onConfirm, fallbackFocus }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        const previousFocus = document.activeElement;
        const fallbackElement = fallbackFocus.current;
        const previousOverflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        return () => {
            dialog.close();
            document.body.style.overflow = previousOverflow;
            if (previousFocus?.isConnected) previousFocus.focus();
            else fallbackElement?.focus();
        };
    }, [fallbackFocus]);

    function handleBackdrop(event) {
        if (deleting || event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel();
    }

    return <dialog ref={dialogRef} className="admin-delete-dialog"
        aria-labelledby="delete-product-title" aria-describedby="delete-product-description"
        aria-busy={deleting} onClick={handleBackdrop}
        onCancel={(event) => { event.preventDefault(); if (!deleting) onCancel(); }}>
        <p className="eyebrow">Gem Aurelia · Quản lý sản phẩm</p>
        <h2 id="delete-product-title">Xóa sản phẩm?</h2>
        <p><strong>{product.name}</strong></p>
        <p id="delete-product-description">Sản phẩm sẽ bị xóa khỏi danh sách quản lý và không còn hiển thị cho khách hàng.</p>
        <p>Dữ liệu lịch sử đơn hàng vẫn được giữ lại.</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-delete-actions">
            <button type="button" className="btn btn-outline" disabled={deleting} onClick={onCancel} autoFocus>Hủy</button>
            <button type="button" className="btn btn-danger" disabled={deleting} onClick={onConfirm}>
                {deleting ? "Đang xóa..." : "Xóa"}
            </button>
        </div>
        <span className="visually-hidden" role="status">{deleting ? "Đang xóa sản phẩm, vui lòng chờ." : ""}</span>
    </dialog>;
}
