export const subjects = ['Tư vấn sản phẩm', 'Thông tin đơn hàng', 'Thanh toán', 'Đổi / hủy đơn', 'Chứng nhận đá quý', 'Khác'];
export const statuses = { New: 'Mới', InProgress: 'Đang xử lý', Resolved: 'Đã giải quyết' };
export const emptyContact = { fullName: '', email: '', phone: '', subject: '', message: '' };
export function validateContact(values) {
  const errors = {};
  if (!values.fullName.trim()) errors.fullName = 'Vui lòng nhập họ tên.';
  else if (values.fullName.length > 100) errors.fullName = 'Họ tên tối đa 100 ký tự.';
  if (!values.email.trim()) errors.email = 'Vui lòng nhập email.';
  else if (values.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) errors.email = 'Email không đúng định dạng.';
  if (values.phone && (!/^[+]?[0-9 ()-]{7,20}$/.test(values.phone) || values.phone.replace(/\D/g, '').length < 7)) errors.phone = 'Số điện thoại không hợp lệ.';
  if (!values.subject.trim()) errors.subject = 'Vui lòng chọn chủ đề.';
  else if (values.subject.length > 100) errors.subject = 'Chủ đề tối đa 100 ký tự.';
  if (!values.message.trim()) errors.message = 'Vui lòng nhập nội dung.';
  else if (values.message.trim().length < 10) errors.message = 'Nội dung cần ít nhất 10 ký tự.';
  else if (values.message.length > 4000) errors.message = 'Nội dung tối đa 4.000 ký tự.';
  return errors;
}
export function contactError(error, fallback) {
  if (error.response?.status === 400) return 'Thông tin chưa hợp lệ. Vui lòng kiểm tra các trường và giới hạn ký tự.';
  if (error.response?.status === 403) return 'Bạn không có quyền thực hiện thao tác này.';
  if (error.response?.status === 429) return 'Bạn gửi quá nhiều yêu cầu. Vui lòng thử lại sau.';
  return fallback;
}
export function contactDate(value) {
  if (!value) return '—';
  return new Date(value.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(value) ? value : value + 'Z').toLocaleString('vi-VN');
}
