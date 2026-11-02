export const paymentMethodLabel = order => order.paymentMethod === "COD" ? "COD" : order.paymentMethod === "BankTransfer" ? "Chuyển khoản" : "Chưa ghi nhận";
export function paymentLabel(order) {
  if (order.paymentStatus === "Paid") return "Đã thanh toán";
  if (order.paymentStatus !== "Unpaid") return "Chưa ghi nhận";
  if (order.paymentMethod === "BankTransfer" && order.status === "Pending")
    return order.paymentReportedAt ? "Chờ xác nhận thanh toán" : "Chờ thanh toán";
  if (order.paymentMethod === "COD" && order.status !== "Cancelled") return "Thanh toán khi nhận hàng";
  return "Chưa thanh toán";
}
export const canConfirmPayment = order => order.paymentMethod === "BankTransfer" && order.status === "Pending" && order.paymentStatus === "Unpaid" && Boolean(order.paymentReportedAt);
export const canCancelOrder = order => order.paymentStatus !== "Paid";
