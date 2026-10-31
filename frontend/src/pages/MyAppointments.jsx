import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { apiError, getSessionToken, subscribeSession } from "../auth/session";
import { consultationApi } from "../consultation/api";
import AppointmentStatusBadge from "../consultation/AppointmentStatusBadge";
import CancelAppointmentDialog from "../consultation/CancelAppointmentDialog";
import useAppointmentEvents from "../consultation/useAppointmentEvents";
import { CalendarIcon, ClockIcon } from "../consultation/icons";
import { canCustomerCancel, formatDate, formatPriceOrFree, isUpcoming, parseWallClock, wallClockParts, WEEKDAYS_LONG } from "../consultation/time";
import { formatPrice } from "../utils/formatPrice";
import "../styles/consultation.css";

export default function MyAppointments() {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  return <AppointmentsView key={token} token={token} />;
}

function AppointmentsView({ token }) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ attempt: -1, data: null, error: "" });
  const [tab, setTab] = useState("upcoming");
  const [cancelling, setCancelling] = useState(null);
  const [saving, setSaving] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [message, setMessage] = useState("");
  const submitting = useRef(false);
  const headingRef = useRef(null);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  const connection = useAppointmentEvents(token, refresh);

  useEffect(() => {
    let active = true;
    consultationApi.myAppointments().then(data => { if (active) setState({ attempt, data, error: "" }); })
      .catch(err => { if (active && err?.name !== "CanceledError") setState(previous => ({ attempt, data: previous.data,
        error: apiError(err, "Không tải được lịch hẹn. Vui lòng thử lại.") })); });
    return () => { active = false; };
  }, [attempt]);

  const loading = state.attempt !== attempt;
  const all = state.data || [];
  const upcoming = all.filter(item => isUpcoming(item)).sort((a, b) => parseWallClock(a.startAt) - parseWallClock(b.startAt));
  const past = all.filter(item => !isUpcoming(item)).sort((a, b) => parseWallClock(b.startAt) - parseWallClock(a.startAt));
  const shown = tab === "upcoming" ? upcoming : past;

  async function confirmCancel(reason) {
    if (!cancelling || submitting.current) return;
    submitting.current = true; setSaving(true); setDialogError("");
    try {
      await consultationApi.cancelMine(cancelling.id, reason);
      if (token !== getSessionToken()) return;
      setMessage(`Đã hủy lịch hẹn #${cancelling.id}.`); setCancelling(null); refresh();
    } catch (err) {
      if (token === getSessionToken()) { setDialogError(apiError(err, "Không hủy được lịch hẹn. Vui lòng tải lại và thử lại.")); refresh(); }
    } finally { submitting.current = false; setSaving(false); }
  }

  return <div className="store-container appointments-page">
    <nav className="catalog-breadcrumb" aria-label="Đường dẫn"><Link to="/">Trang chủ</Link><span aria-hidden="true">/</span><Link to="/account">Tài khoản</Link><span aria-hidden="true">/</span><span aria-current="page">Lịch hẹn của tôi</span></nav>
    <header className="appointments-heading">
      <div><h1 ref={headingRef} tabIndex={-1}>Lịch hẹn của tôi</h1>
        <p className="appointments-live" role="status"><span className={`live-dot${connection === "Đã kết nối" ? " is-on" : ""}`} aria-hidden="true" />Cập nhật trực tiếp: {connection}</p></div>
      <Link className="booking-primary" to="/hen-lich"><CalendarIcon /> Đặt lịch mới</Link>
    </header>
    <div className="appointments-tabs" role="group" aria-label="Lọc lịch hẹn">
      <button type="button" aria-pressed={tab === "upcoming"} onClick={() => setTab("upcoming")}>Sắp tới <span>({upcoming.length})</span></button>
      <button type="button" aria-pressed={tab === "past"} onClick={() => setTab("past")}>Đã qua và đã hủy <span>({past.length})</span></button>
      <button type="button" className="appointments-refresh" onClick={refresh} disabled={loading}>{loading && state.data ? "Đang cập nhật…" : "Tải lại"}</button>
    </div>
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {state.error && <p className="notice notice-error" role="alert">{state.error} <button type="button" className="link-button" onClick={refresh}>Thử lại</button></p>}
    {!state.data && loading ? <p role="status">Đang tải lịch hẹn…</p> : state.data && shown.length === 0 ?
      <div className="appointments-empty"><p>{tab === "upcoming" ? "Bạn chưa có lịch hẹn sắp tới." : "Chưa có lịch hẹn đã qua."}</p>
        {tab === "upcoming" && <Link className="booking-secondary" to="/hen-lich">Đặt lịch tư vấn</Link>}</div> :
      <ul className="appointment-list" aria-busy={loading}>{shown.map(item => {
        const start = wallClockParts(item.startAt), end = wallClockParts(item.endAt);
        const cancellable = canCustomerCancel(item);
        return <li key={item.id} className={`appointment-card appointment-card--${item.status}`}>
          {start && <div className="appointment-card__date" aria-hidden="true"><span>{WEEKDAYS_LONG[start.weekday]}</span><strong>{start.date.slice(8, 10)}</strong><span>Tháng {Number(start.date.slice(5, 7))}</span></div>}
          <div className="appointment-card__body">
            <div className="appointment-card__top"><h2>{item.serviceName}</h2><AppointmentStatusBadge status={item.status} /></div>
            <p className="appointment-card__time"><ClockIcon /> {start ? `${formatDate(start.date)} · ${start.time}${end ? ` – ${end.time}` : ""}` : item.startAt}</p>
            <p className="appointment-card__meta">Mã #{item.id} · {formatPriceOrFree(item.price, formatPrice)}{item.contactName ? ` · ${item.contactName}` : ""}{item.phone ? ` · ${item.phone}` : ""}</p>
            {item.note && <p className="appointment-card__note">Ghi chú: {item.note}</p>}
            {item.status === "Cancelled" && <p className="appointment-card__note">{item.cancelledBy === "Customer" ? "Bạn đã hủy lịch" : "Cửa hàng đã hủy lịch"}{item.cancelReason ? `: ${item.cancelReason}` : "."}</p>}
            {["Pending", "Confirmed"].includes(item.status) && <div className="appointment-card__actions">
              {cancellable ? <button type="button" className="appointment-cancel" disabled={saving}
                onClick={() => { setDialogError(""); setMessage(""); setCancelling(item); }}>Hủy lịch hẹn</button>
                : <p className="appointment-card__hint">Lịch hẹn chỉ có thể hủy trước giờ hẹn ít nhất 2 giờ. Vui lòng liên hệ cửa hàng nếu cần thay đổi.</p>}
            </div>}
          </div>
        </li>;
      })}</ul>}
    {cancelling && <CancelAppointmentDialog appointment={cancelling} saving={saving} error={dialogError} fallbackFocus={headingRef}
      onClose={() => { if (!submitting.current) setCancelling(null); }} onConfirm={confirmCancel} />}
  </div>;
}
