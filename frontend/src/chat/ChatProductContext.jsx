import { useEffect } from "react";
import { useChat } from "./context";

/** Rendered on /product/:id: lets the chat panel offer "Hỏi về sản phẩm này" for this product. */
export default function ChatProductContext({ product }) {
  const setProductContext = useChat()?.setProductContext;
  const id = product?.id, name = product?.name, price = product?.price, imageUrl = product?.imageUrl;
  useEffect(() => {
    if (!setProductContext || id == null) return;
    setProductContext({ id, name, price, imageUrl });
    return () => setProductContext(current => current?.id === id ? null : current);
  }, [setProductContext, id, name, price, imageUrl]);
  return null;
}
