import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/api";
import { apiError, getSessionToken } from "../auth/session";
import { useCommerce } from "../commerce/context";
import { formatPrice } from "../utils/formatPrice";

export default function Checkout() {
  const { token, cart, cartLoading, cartError, refreshCart } = useCommerce();
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ recipientName: "", recipientPhone: "", shippingAddress: "", note: "" });
  const [pending, setPending] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api.get("/users/me").then(({ data }) => {
      if (!active) return;
      setProfile(data);
      let saved;
      try { saved = JSON.parse(sessionStorage.getItem(`commerce-checkout:${data.id}`)); } catch { /* invalid draft */ }
      if (saved?.requestId) { setPending(saved); setForm(saved); }
      else setForm({ recipientName: data.fullName || "", recipientPhone: data.phone || "", shippingAddress: data.address || "", note: "" });
    }).catch(err => { if (active) setError(apiError(err, "Không tải được hồ sơ. Hãy tải lại trang.")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (!profile || submitting.current) return;
    const request = pending || { ...form, requestId: crypto.randomUUID() };
    sessionStorage.setItem(`commerce-checkout:${profile.id}`, JSON.stringify(request));
    setPending(request); setSaving(true); setError(""); submitting.current = true;
    try {
      const { data } = await api.post("/orders", request);
      if (token !== getSessionToken()) return;
      sessionStorage.removeItem(`commerce-checkout:${profile.id}`);
      void refreshCart();
      navigate(`/orders/${data.orderId}`, { replace: true });
    } catch (err) {
      if (token !== getSessionToken()) return;
      setError(apiError(err, "Chưa xác nhận được kết quả. Nhấn thử lại để dùng cùng mã yêu cầu, hoặc kiểm tra lịch sử đơn."));
      if ([400, 409].includes(err.response?.status) && err.response?.data?.code !== "request_busy") {
        sessionStorage.removeItem(`commerce-checkout:${profile.id}`); setPending(null); void refreshCart();
      }
    } finally { submitting.current = false; setSaving(false); }
  }

  return <main className="container commerce-page"><h1>Đặt hàng</h1>
    <p>Đơn hàng được tiếp nhận để xác nhận. Chưa tích hợp thanh toán trực tuyến.</p>
    {(error || cartError) && <p className="notice notice-error" role="alert">{error || cartError}</p>}
    {loading || cartLoading ? <p role="status">Đang tải...</p> : !profile ? <p>Không thể tiếp tục khi chưa tải được hồ sơ.</p> : <div className="checkout-grid">
      <form className="checkout-form" onSubmit={submit}>
        <fieldset disabled={saving || Boolean(pending)}>
          {[["recipientName", "Người nhận", 100], ["recipientPhone", "Điện thoại", 20], ["shippingAddress", "Địa chỉ giao hàng", 500]].map(([key, label, max]) =>
            <label key={key}>{label}<input required maxLength={max} type={key === "recipientPhone" ? "tel" : "text"} value={form[key]}
              onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
          <label>Ghi chú<textarea maxLength={500} value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></label>
        </fieldset>
        {pending && <p>Thông tin đang chờ xác nhận. Thử lại sẽ không tạo thêm đơn trùng.</p>}
        <button className="btn btn-gold" disabled={saving || (!pending && (!cart?.items.length || Boolean(cartError)))}>
          {saving ? "Đang đặt hàng..." : pending ? "Thử lại cùng yêu cầu" : "Xác nhận đặt hàng"}</button>
        <Link to="/orders">Kiểm tra lịch sử đơn</Link>
      </form>
      <aside className="summary-box"><h2>Giỏ hiện tại</h2>{cart?.items.map(i => <p key={i.productId}>{i.name} × {i.quantity}: {formatPrice(i.lineTotal)}</p>)}
        {cart && <strong>{formatPrice(cart.total)}</strong>}<p>Đơn giá cuối cùng được chốt trên server khi tạo đơn.</p></aside>
    </div>}
  </main>;
}
