import { useEffect, useRef } from "react";

export default function ProductDeleteDialog({ product, deleting, error, onCancel, onConfirm, fallbackFocus }) {
    const dialogRef = useRef(null);
    const action = product.isActive ? "Ngừng bán" : "Bán lại";

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
        <h2 id="delete-product-title">{action} sản phẩm?</h2>
        <p id="delete-product-description">{action} <strong>{product.name}</strong>? {product.isActive
            ? "Sản phẩm sẽ được ẩn khỏi khách hàng. Ảnh, chứng nhận và lịch sử đơn hàng được giữ nguyên. Bạn có thể bán lại sản phẩm sau này."
            : "Sản phẩm sẽ hiển thị trở lại trong cửa hàng."}</p>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <div className="admin-delete-actions">
            <button type="button" className="btn btn-outline" disabled={deleting} onClick={onCancel} autoFocus>Hủy</button>
            <button type="button" className={`btn ${product.isActive ? "btn-danger" : "btn-primary"}`} disabled={deleting} onClick={onConfirm}>
                {deleting ? "Đang cập nhật..." : action}
            </button>
        </div>
        <span className="visually-hidden" role="status">{deleting ? "Đang cập nhật trạng thái sản phẩm, vui lòng chờ." : ""}</span>
    </dialog>;
}
