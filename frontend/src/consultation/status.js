export const appointmentLabels = {
  Pending: "Chờ xác nhận", Confirmed: "Đã xác nhận", Completed: "Hoàn tất", Cancelled: "Đã hủy", NoShow: "Vắng mặt",
};
// Mirrors the server's compare-and-set transitions; the API stays authoritative.
export const adminTransitions = {
  Pending: ["Confirmed", "Cancelled"],
  Confirmed: ["Completed", "NoShow", "Cancelled"],
};
export const transitionLabels = { Confirmed: "Xác nhận", Completed: "Hoàn tất", NoShow: "Vắng mặt", Cancelled: "Hủy" };

export function serviceKind(name = "") {
  const text = name.toLocaleLowerCase("vi");
  if (/kiểm|đánh giá|định|giám/.test(text)) return "appraisal";
  if (/quà|bộ sưu tập|sưu tầm/.test(text)) return "gift";
  if (/thiết kế|trang sức|nhẫn/.test(text)) return "design";
  return "gem";
}
