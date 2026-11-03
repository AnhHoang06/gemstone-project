import { useWishlist } from "../wishlist/context";
import NotificationToast from "./NotificationToast";

export default function WishlistToast() {
  const { wishlistToast, dismissWishlistToast } = useWishlist();
  return wishlistToast ? <NotificationToast key={wishlistToast.id} toast={{ ...wishlistToast,
    label: "Thông báo yêu thích", icon: "♥", actionPath: "/wishlist", actionLabel: "Xem yêu thích" }}
    onClose={dismissWishlistToast} /> : null;
}
