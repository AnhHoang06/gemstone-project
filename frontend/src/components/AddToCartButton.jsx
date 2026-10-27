import { useState } from "react";
import { useCommerce } from "../commerce/context";

export default function AddToCartButton({ product }) {
  const { mutateCart, cartBusy, cartError } = useCommerce();
  const [attempted, setAttempted] = useState(false);
  async function add() {
    setAttempted(true);
    await mutateCart("post", `/cart/items/${product.id}`, { quantity: 1 });
  }
  return <div>
    <button type="button" className="btn btn-gold" disabled={cartBusy || product.stock === 0 || product.isActive === false} onClick={add}>
      {cartBusy ? "Đang cập nhật..." : product.stock === 0 ? "Hết hàng" : "Thêm giỏ hàng"}
    </button>
    {attempted && cartError && <small role="alert" className="notice-error">{cartError}</small>}
  </div>;
}
