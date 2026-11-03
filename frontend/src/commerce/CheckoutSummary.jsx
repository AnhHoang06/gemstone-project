import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "../commerce/context";
import { formatPrice } from "../utils/formatPrice";
import DeliveryDialog from "./DeliveryDialog";

export default function CheckoutSummary({ blocked = false, onLockChange }) {
  const { token, cart, cartLoading, cartBusy, cartError, refreshCart } = useCommerce();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ recipientName: "", recipientPhone: "", shippingAddress: "", note: "", paymentMethod: "COD" });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const submitting = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api.get("/users/me").then(({ data }) => {
      if (!active || token !== getSessionToken()) return;
      setProfile(data);
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(`commerce-checkout:${data.id}`)); } catch { /* invalid draft */ }
      if (saved?.requestId) { setPending(saved); setForm(saved); onLockChange?.(true); }
      else {
        setForm({ recipientName: data.fullName || "", recipientPhone: data.phone || "", shippingAddress: data.address || "", note: "", paymentMethod: "COD" });
      }
    }).catch(err => { if (active) setError(apiError(err, "Không tải được hồ sơ. Hãy tải lại trang.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token, onLockChange]);

  function validate() {
    const errors = {};
    if (!form.recipientName.trim()) errors.recipientName = "Vui lòng nhập tên người nhận.";
    if (!form.recipientPhone.trim()) errors.recipientPhone = "Vui lòng nhập số điện thoại.";
    else if (!/^[+\d\s().-]+$/.test(form.recipientPhone) || !/\d/.test(form.recipientPhone)) errors.recipientPhone = "Số điện thoại không hợp lệ.";
    if (!form.shippingAddress.trim()) errors.shippingAddress = "Vui lòng nhập địa chỉ giao hàng.";
    setFieldErrors(errors);
    if (Object.keys(errors).length) return false;
    return true;
  }

  async function submit(e) {
    e.preventDefault();
    if (!dialogOpen || !profile || submitting.current || token !== getSessionToken() || cartBusy || cartLoading) return;
    if (!pending && (blocked || !cart?.items.length || cartError || !validate())) return;
    const request = pending || { ...form, requestId: crypto.randomUUID() };
    sessionStorage.setItem(`commerce-checkout:${profile.id}`, JSON.stringify(request));
    setPending(request); setSaving(true); setError(""); submitting.current = true; onLockChange?.(true);
    try {
      const { data } = await api.post("/orders", request);
      if (token !== getSessionToken()) return;
      sessionStorage.removeItem(`commerce-checkout:${profile.id}`);
      void refreshCart();
      navigate(`/${data.paymentMethod === "BankTransfer" ? "payment" : "orders"}/${data.orderId}`, { replace: true });
    } catch (err) {
      if (token !== getSessionToken()) return;
      setError(apiError(err, "Chưa xác nhận được kết quả. Nhấn thử lại để dùng cùng mã yêu cầu, hoặc kiểm tra lịch sử đơn."));
      if ([400, 409].includes(err.response?.status) && !["request_busy", "request_mismatch"].includes(err.response?.data?.code)) {
        sessionStorage.removeItem(`commerce-checkout:${profile.id}`); setPending(null); onLockChange?.(false); void refreshCart();
      }
    } finally { submitting.current = false; setSaving(false); }
  }

  return <aside className="cart-order-summary"><h2>Tóm tắt đơn hàng</h2>
    {cart && <dl className="cart-totals"><div><dt>Tạm tính</dt><dd>{formatPrice(cart.total)}</dd></div>
      <div><dt>Tổng</dt><dd>{formatPrice(cart.total)}</dd></div></dl>}
    {!dialogOpen && (error || cartError) && <p className="notice notice-error" role="alert">{error || cartError}</p>}
    {loading || cartLoading ? <p role="status">Đang tải thông tin giao hàng...</p> : !profile ? <p>Không tải được hồ sơ. Vui lòng tải lại trang để thử lại.</p> :
      <div className="checkout-form">
        <fieldset className="cart-payment" disabled={saving || Boolean(pending)}><legend>Phương thức thanh toán</legend>
          <label className="cart-payment-option"><input type="radio" name="payment-method" value="COD" aria-label="Thanh toán khi nhận hàng (COD)" checked={(form.paymentMethod || "COD") === "COD"} onChange={() => setForm({ ...form, paymentMethod: "COD" })} />
            <span><strong>Thanh toán khi nhận hàng (COD)</strong><small>Thanh toán khi nhận hàng.</small></span></label>
          <label className="cart-payment-option"><input type="radio" name="payment-method" value="BankTransfer" aria-label="Chuyển khoản ngân hàng" checked={form.paymentMethod === "BankTransfer"} onChange={() => setForm({ ...form, paymentMethod: "BankTransfer" })} />
            <span><strong>Chuyển khoản ngân hàng</strong><small>Chuyển đến trang thanh toán sau khi tạo đơn.</small></span></label>
        </fieldset>
        <p className="cart-helper">{form.paymentMethod === "BankTransfer" ? "Hướng dẫn chuyển khoản sẽ hiển thị sau khi đơn được tạo thành công." : "Thanh toán khi nhận hàng. Đơn mới chưa được ghi nhận thanh toán."}</p>
        {pending && <p>Thông tin đang chờ xác nhận. Thử lại sẽ không tạo thêm đơn trùng.</p>}
        <button type="button" onClick={() => setDialogOpen(true)} className="btn btn-gold cart-place-order" disabled={saving || cartBusy || (!pending && (blocked || !cart?.items.length || Boolean(cartError)))}>
          {saving ? "Đang đặt hàng..." : pending ? "Tiếp tục xác nhận" : "Đặt hàng"}</button>
        <Link className="cart-order-history" to="/orders">Kiểm tra lịch sử đơn</Link>
      </div>}
    {dialogOpen && <DeliveryDialog saving={saving} onClose={() => { if (!submitting.current) setDialogOpen(false); }}>
      <p className="cart-helper">Thông tin chỉ áp dụng cho đơn này, không thay đổi hồ sơ của bạn.</p>
      {(error || cartError) && <p className="notice notice-error" role="alert">{error || cartError}</p>}
      <form className="checkout-form" noValidate onSubmit={submit}>
          <fieldset disabled={saving || Boolean(pending)}>
            {[["recipientName", "Người nhận", 100], ["recipientPhone", "Điện thoại", 20], ["shippingAddress", "Địa chỉ giao hàng", 500]].map(([key, label, max]) =>
              <label key={key}>{label}<input required maxLength={max} type={key === "recipientPhone" ? "tel" : "text"} value={form[key]}
                aria-invalid={Boolean(fieldErrors[key])} aria-describedby={fieldErrors[key] ? `checkout-${key}-error` : undefined}
                onChange={e => { setForm({ ...form, [key]: e.target.value }); setFieldErrors(previous => ({ ...previous, [key]: "" })); }} />
                {fieldErrors[key] && <small className="notice-error" id={`checkout-${key}-error`}>{fieldErrors[key]}</small>}</label>)}
            <label>Ghi chú<textarea maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
          </fieldset>
        {pending && <p className="cart-helper">Đang chờ xác nhận kết quả. Thử lại dùng cùng mã yêu cầu, không tạo thêm đơn trùng.</p>}
        <div className="commerce-actions">
          <button type="button" className="btn btn-outline" disabled={saving} onClick={() => { if (!submitting.current) setDialogOpen(false); }}>Hủy</button>
          <button type="submit" className="btn delivery-confirm" disabled={saving || cartBusy || cartLoading || (!pending && (blocked || !cart?.items.length || Boolean(cartError)))}>
            {saving ? "Đang đặt hàng..." : pending ? "Thử lại cùng yêu cầu" : "Xác nhận đặt hàng"}</button>
        </div>
      </form>
    </DeliveryDialog>}
  </aside>;
}
