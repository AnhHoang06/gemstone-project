import { useState } from "react";
import { useCommerce } from "../commerce/context";

export default function AddToCartButton({ product, className = "btn btn-gold", label = "Thêm giỏ hàng", wrapperClassName }) {
  const { mutateCart, cartBusy, cartError } = useCommerce();
  const [attempted, setAttempted] = useState(false);
  async function add() {
    setAttempted(true);
    await mutateCart("post", `/cart/items/${product.id}`, { quantity: 1 });
  }
  return <div className={wrapperClassName}>
    <button type="button" className={className} disabled={cartBusy || product.stock === 0 || product.isActive === false} onClick={add}>
      {cartBusy ? "Đang cập nhật..." : product.stock === 0 ? "Hết hàng" : label}
    </button>
    {attempted && cartError && <small role="alert" className="notice-error">{cartError}</small>}
  </div>;
}
