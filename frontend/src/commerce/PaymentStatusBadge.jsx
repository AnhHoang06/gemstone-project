import { paymentLabel } from "./paymentStatus";
export default function PaymentStatusBadge({ order }) {
  return <span className={`order-badge order-badge--${order.paymentStatus === "Paid" ? "Completed" : "Pending"}`}>{paymentLabel(order)}</span>;
}
