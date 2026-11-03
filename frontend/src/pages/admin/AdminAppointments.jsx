import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { apiError, getSessionToken, subscribeSession } from "../../auth/session";
import { consultationApi } from "../../consultation/api";
import AppointmentStatusBadge from "../../consultation/AppointmentStatusBadge";
import CancelAppointmentDialog from "../../consultation/CancelAppointmentDialog";
import useAppointmentEvents from "../../consultation/useAppointmentEvents";
import { adminTransitions, appointmentLabels, transitionLabels } from "../../consultation/status";
import { addDays, formatDate, parseWallClock, storeToday, wallClockParts } from "../../consultation/time";
import "../../styles/consultation.css";

export default function AdminAppointments() {
  const token = useSyncExternalStore(subscribeSession, getSessionToken, () => "");
  return <AdminAppointmentsView key={token} token={token} />;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
function filtersFromUrl(params) {
  const today = storeToday();
  const read = name => params.get(name)?.trim() || "";
  const q = read("q").slice(0, 100);
  const from = ISO_DATE.test(read("from")) ? read("from") : today;
  // A customer lookup without dates covers the whole booking window, not just the next week.
  const to = ISO_DATE.test(read("to")) ? read("to") : addDays(from, q ? 60 : 6);
  const status = Object.hasOwn(appointmentLabels, read("status")) ? read("status") : "";
  return { from, to, status, q };
}

function AdminAppointmentsView({ token }) {
  // Filters live in the URL (e.g. the chat inbox links to /admin/appointments?q=<email>).
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState(() => filtersFromUrl(searchParams));
  const [search, setSearch] = useState(filters.q);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ key: null, data: null, error: "" });
  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [message, setMessage] = useState("");
  const [cancelling, setCancelling] = useState(null);
  const [dialogError, setDialogError] = useState("");
  const lock = useRef(false);
  const headingRef = useRef(null);
  const refresh = useCallback(() => setAttempt(value => value + 1), []);
  const connection = useAppointmentEvents(token, refresh);
  const invalidRange = filters.from && filters.to && filters.from > filters.to;
  const key = `${filters.from}|${filters.to}|${filters.status}|${filters.q}|${attempt}`;

  const update = useCallback(patch => {
    const next = { ...filters, ...patch };
    if (Object.keys(patch).every(name => filters[name] === next[name])) return;
    setFilters(next);
    setSearchParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)), { replace: true });
  }, [filters, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => update({ q: search.trim() }), 300);
    return () => clearTimeout(timer);
  }, [search, update]);

  useEffect(() => {
    if (invalidRange) return;
    let active = true;
    const params = Object.fromEntries(Object.entries({ from: filters.from, to: filters.to, status: filters.status, q: filters.q }).filter(([, value]) => value));
    consultationApi.adminAppointments(params).then(data => { if (active) setState({ key, data, error: "" }); })
      .catch(err => { if (active && err?.name !== "CanceledError") setState(previous => ({ key, data: previous.data, error: apiError(err, "Không tải được danh sách lịch hẹn.") })); });
    return () => { active = false; };
  }, [key, filters, invalidRange]);

  const loading = !invalidRange && state.key !== key;
  const groups = new Map();
  for (const item of [...(state.data || [])].sort((a, b) => parseWallClock(a.startAt) - parseWallClock(b.startAt))) {
    const date = wallClockParts(item.startAt)?.date || "";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  }

  async function change(item, status, reason) {
    if (lock.current) return false;
    lock.current = true; setBusyId(item.id); setActionError(""); setMessage("");
    try {
      await consultationApi.setStatus(item.id, status, reason);
      if (token !== getSessionToken()) return false;
      setMessage(`Lịch hẹn #${item.id}: ${appointmentLabels[status]}.`);
      refresh();
      return true;
    } catch (err) {
      if (token !== getSessionToken()) return false;
      const text = err.response?.status === 409 ? apiError(err, "Lịch hẹn vừa được cập nhật ở nơi khác. Danh sách đã được tải lại.")
        : apiError(err, "Không cập nhật được trạng thái lịch hẹn.");
      if (cancelling) setDialogError(text); else setActionError(text);
      refresh();
      return false;
    } finally { lock.current = false; setBusyId(null); }
  }

  return <main className="admin-page admin-appointments">
    <div className="admin-page-heading"><h1 ref={headingRef} tabIndex={-1}>Lịch hẹn tư vấn</h1>
      <button type="button" className="btn btn-outline" onClick={refresh} disabled={loading}>{loading && state.data ? "Đang cập nhật…" : "Tải lại"}</button></div>
    <p className="order-secondary" role="status">Cập nhật trực tiếp: {connection}</p>
    <form className="admin-appt-filters" role="search" onSubmit={event => { event.preventDefault(); update({ q: search.trim() }); }}>
      <label>Từ ngày<input type="date" value={filters.from} onChange={event => update({ from: event.target.value })} /></label>
      <label>Đến ngày<input type="date" value={filters.to} onChange={event => update({ to: event.target.value })} /></label>
      <label>Trạng thái<select value={filters.status} onChange={event => update({ status: event.target.value })}>
        <option value="">Tất cả</option>{Object.entries(appointmentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="admin-appt-search">Tìm khách hàng<input type="search" value={search} maxLength={100} placeholder="Tên, số điện thoại hoặc email"
        onChange={event => setSearch(event.target.value)} /></label>
    </form>
    {invalidRange && <p className="notice notice-error" role="alert">“Từ ngày” phải trước hoặc bằng “Đến ngày”.</p>}
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {actionError && <p className="notice notice-error" role="alert">{actionError}</p>}
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    {!state.data && loading ? <p role="status">Đang tải lịch hẹn…</p> : !invalidRange && state.data && groups.size === 0 ?
      <p className="empty-state">Không có lịch hẹn phù hợp trong khoảng thời gian này.</p> :
      <div aria-busy={loading}>{[...groups].map(([date, items]) => <section key={date} className="admin-appt-day" aria-labelledby={`appt-day-${date}`}>
        <h2 id={`appt-day-${date}`}>{formatDate(date)} <span>· {items.length} lịch hẹn</span></h2>
        <div className="table-scroll"><table className="shop-table admin-appt-table"><thead><tr>
          <th scope="col">Giờ</th><th scope="col">Khách hàng</th><th scope="col">Số điện thoại</th><th scope="col">Dịch vụ</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>{items.map(item => {
            const start = wallClockParts(item.startAt), end = wallClockParts(item.endAt);
            const actions = adminTransitions[item.status] || [];
            // Completed / NoShow are accepted only once the appointment has started (409 not_started otherwise).
            const tooEarly = status => ["Completed", "NoShow"].includes(status) && item.hasStarted === false;
            return <tr key={item.id}>
              <td className="admin-appt-time"><strong>{start?.time}</strong>{end && <span>– {end.time}</span>}</td>
              <td><strong>{item.contactName || item.customer?.fullName}</strong>
                {item.customer && item.customer.fullName !== item.contactName && <small>Tài khoản: {item.customer.fullName}</small>}
                {item.customer?.email && <small>{item.customer.email}</small>}
                {item.note && <small className="admin-appt-note">Ghi chú: {item.note}</small>}</td>
              <td>{item.phone ? <a href={`tel:${item.phone}`}>{item.phone}</a> : "—"}</td>
              <td>{item.serviceName}<small>Mã #{item.id}</small></td>
              <td><AppointmentStatusBadge status={item.status} />{item.status === "Cancelled" && item.cancelReason && <small>Lý do: {item.cancelReason}</small>}</td>
              <td><div className="admin-appt-actions">{actions.length ? actions.map(status => <button key={status} type="button"
                className={`btn ${status === "Cancelled" ? "btn-danger" : status === "Confirmed" ? "btn-primary" : "btn-outline"}`}
                disabled={busyId !== null || tooEarly(status)} aria-label={`${transitionLabels[status]} lịch hẹn #${item.id}`}
                title={tooEarly(status) ? "Chỉ dùng được sau giờ bắt đầu lịch hẹn" : undefined}
                onClick={() => { if (status === "Cancelled") { setDialogError(""); setCancelling(item); } else void change(item, status); }}>
                {busyId === item.id ? "…" : transitionLabels[status]}</button>) : <span className="order-secondary">—</span>}</div></td>
            </tr>;
          })}</tbody></table></div>
      </section>)}</div>}
    {cancelling && <CancelAppointmentDialog admin appointment={cancelling} saving={busyId === cancelling.id} error={dialogError} fallbackFocus={headingRef}
      onClose={() => { if (!lock.current) setCancelling(null); }}
      onConfirm={async reason => { if (await change(cancelling, "Cancelled", reason)) setCancelling(null); }} />}
  </main>;
}
