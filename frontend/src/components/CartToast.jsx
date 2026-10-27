import { useCommerce } from "../commerce/context";
import NotificationToast from "./NotificationToast";

export default function CartToast() {
  const { cartToast, dismissCartToast } = useCommerce();
  return cartToast ? <NotificationToast key={cartToast.id} toast={cartToast} onClose={dismissCartToast} /> : null;
}
