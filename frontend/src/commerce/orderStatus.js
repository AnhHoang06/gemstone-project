export const orderLabels = { Pending: "Chờ xác nhận", Confirmed: "Đã xác nhận", Shipping: "Đang giao", Completed: "Hoàn tất", Cancelled: "Đã hủy" };
export const adminNextStatuses = { Pending: ["Confirmed", "Cancelled"], Confirmed: ["Shipping", "Cancelled"], Shipping: ["Completed"] };
