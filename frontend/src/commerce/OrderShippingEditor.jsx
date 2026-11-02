import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { apiError, getSessionToken } from '../auth/session';
import { useCommerce } from './context';
import DeliveryDialog from './DeliveryDialog';
import NotificationToast from '../components/NotificationToast';
import '../styles/cart-checkout.css';

const fields = [
  ['recipientName', 'Người nhận', 100],
  ['recipientPhone', 'Số điện thoại', 20],
  ['shippingAddress', 'Địa chỉ giao hàng', 500],
  ['note', 'Ghi chú', 500],
];
function validate(form) {
  const errors = {};
  for (const [key, label, max] of fields) {
    const value = form[key].trim();
    if (key !== 'note' && !value) errors[key] = `Vui lòng nhập ${label.toLowerCase()}.`;
    else if (value.length > max) errors[key] = `${label} tối đa ${max} ký tự.`;
  }
  if (form.recipientPhone.trim() && !errors.recipientPhone &&
      (!/^[+\d\s().-]+$/.test(form.recipientPhone) || !/\d/.test(form.recipientPhone)))
    errors.recipientPhone = 'Số điện thoại không hợp lệ.';
  return errors;
}

export default function OrderShippingEditor({ order, admin, disabled, onSaved, onConflict }) {
  const { token } = useCommerce();
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [locked, setLocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const submitting = useRef(false);
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  const eligible = ['Pending', 'Confirmed'].includes(order.status);
  const lockedMessage = order.status === 'Shipping'
    ? 'Đơn hàng đã chuyển sang giai đoạn giao hàng và không thể chỉnh sửa thông tin giao nhận.'
    : 'Đơn hàng đã hoàn tất hoặc đã hủy và không thể chỉnh sửa thông tin giao nhận.';
  function open() {
    setForm(Object.fromEntries(fields.map(([key]) => [key, order[key] || ''])));
    setErrors({}); setError(''); setLocked(false); setToast(null);
  }
  async function save(event) {
    event.preventDefault();
    if (submitting.current || !eligible || locked || token !== getSessionToken()) return;
    const invalid = validate(form); setErrors(invalid);
    if (Object.keys(invalid).length) return;
    submitting.current = true; setSaving(true); setError('');
    try {
      await api.put(`/orders/${admin ? 'admin/' : ''}${order.id}/shipping-info`,
        Object.fromEntries(fields.map(([key]) => [key, form[key].trim()])));
      if (!active.current || token !== getSessionToken()) return;
      setForm(null); onSaved();
      setToast({ id: Date.now(), kind: 'success', label: 'Thông báo đơn hàng', message: 'Đã cập nhật thông tin giao hàng',
        actionPath: `${admin ? '/admin' : ''}/orders/${order.id}`, actionLabel: 'Xem đơn hàng' });
    } catch (err) {
      if (!active.current || token !== getSessionToken()) return;
      setError(apiError(err, 'Không cập nhật được thông tin giao hàng. Vui lòng thử lại.'));
      const fieldErrors = err.response?.data?.errors;
      if (fieldErrors) setErrors(Object.fromEntries(fields.map(([key]) => [key,
        fieldErrors[key]?.[0] || fieldErrors[key[0].toUpperCase() + key.slice(1)]?.[0] || ''])));
      if (err.response?.status === 409) { setLocked(true); onConflict(); }
    } finally {
      submitting.current = false;
      if (active.current && token === getSessionToken()) setSaving(false);
    }
  }
  return <>
    {eligible && <button type="button" className="btn btn-outline" disabled={disabled || saving} onClick={open}>Chỉnh sửa thông tin giao hàng</button>}
    {form && <DeliveryDialog saving={saving} onClose={() => { if (!submitting.current) setForm(null); }}>
      <p className="cart-helper">Chỉ cập nhật thông tin giao nhận của đơn này. Sản phẩm, tổng tiền và hồ sơ tài khoản được giữ nguyên.</p>
      {(error || !eligible) && <p className="notice notice-error" role="alert">{error || lockedMessage}</p>}
      <form className="checkout-form" noValidate onSubmit={save}>
        <fieldset disabled={saving || locked || !eligible}>
          {fields.map(([key, label, max]) => {
            const control = { value: form[key], maxLength: max, required: key !== 'note',
              'aria-invalid': Boolean(errors[key]), 'aria-describedby': errors[key] ? `shipping-${key}-error` : undefined,
              onChange: event => {
                const next = { ...form, [key]: event.target.value }; setForm(next);
                if (errors[key]) setErrors(previous => ({ ...previous, [key]: validate(next)[key] || '' }));
              } };
            return <div key={key}><label>{label}{key === 'note' ? <textarea {...control} /> : <input {...control} type={key === 'recipientPhone' ? 'tel' : 'text'} />}</label>
              {errors[key] && <small className="notice-error" id={`shipping-${key}-error`}>{errors[key]}</small>}</div>;
          })}
        </fieldset>
        <div className="commerce-actions">
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => setForm(null)}>Hủy</button>
          <button type="submit" className="btn delivery-confirm" disabled={saving || locked || !eligible}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
        </div>
      </form>
    </DeliveryDialog>}
    {toast && <NotificationToast key={toast.id} toast={toast} onClose={() => setToast(null)} />}
  </>;
}
