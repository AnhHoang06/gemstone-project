import { orderLabels } from "./orderStatus";
import "../styles/orders.css";

export default function OrderStatusBadge({ status }) {
  return <span className={`order-badge order-badge--${status}`}>{orderLabels[status] || status}</span>;
}
