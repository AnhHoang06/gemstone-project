import { useEffect, useRef, useState } from "react";
import { apiError } from "../../auth/session";
import { affectedAppointments, consultationApi } from "../api";
import { formatDate, storeToday } from "../time";
import AffectedAppointments from "./AffectedAppointments";

export default function ClosedDatesTab() {
  const [today] = useState(() => storeToday());
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState({ attempt: -1, data: null, error: "" });
  const [form, setForm] = useState({ date: "", reason: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [affected, setAffected] = useState(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    consultationApi.closedDates().then(data => { if (active) setState({ attempt, data, error: "" }); })
      .catch(err => { if (active) setState(previous => ({ attempt, data: previous.data, error: apiError(err, "Không tải được danh sách ngày nghỉ.") })); });
    return () => { active = false; };
  }, [attempt]);

  async function run(action, success) {
    if (lock.current) return;
    lock.current = true; setSaving(true); setFormError(""); setMessage("");
    try { await action(); setMessage(success); setAttempt(value => value + 1); return true; }
    catch (err) { return err; }
    finally { lock.current = false; setSaving(false); }
  }

  async function add(force = false) {
    if (!form.date) { setFormError("Vui lòng chọn ngày nghỉ."); return; }
    if (form.date < today) { setFormError("Chỉ thêm ngày nghỉ từ hôm nay trở đi."); return; }
    const body = { date: form.date, reason: form.reason.trim() || null };
    const outcome = await run(() => consultationApi.addClosedDate(body, force), `Đã thêm ngày nghỉ ${formatDate(form.date, { weekday: false })}.`);
    if (outcome === true) { setAffected(null); setForm({ date: "", reason: "" }); }
    else if (outcome) {
      if (outcome.response?.status === 409 && !force && affectedAppointments(outcome).length) setAffected({ items: affectedAppointments(outcome), message: outcome.response?.data?.message });
      else setFormError(apiError(outcome, "Không thêm được ngày nghỉ."));
    }
  }

  async function remove(date) {
    const outcome = await run(() => consultationApi.removeClosedDate(date), `Đã mở lại ngày ${formatDate(date, { weekday: false })}.`);
    if (outcome !== true && outcome) setFormError(apiError(outcome, "Không xóa được ngày nghỉ."));
  }

  const upcoming = (state.data || []).filter(row => row.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return <div className="consult-admin-closed">
    <p className="consult-admin-help">Ngày nghỉ đột xuất (lễ, kiểm kê…) sẽ không nhận lịch hẹn mới. Lịch đã đặt vào ngày đó cần được xử lý riêng.</p>
    {affected ? <AffectedAppointments items={affected.items} message={affected.message} saving={saving} forceLabel="Vẫn đặt ngày nghỉ"
      onBack={() => setAffected(null)} onForce={() => add(true)} /> :
      <form className="admin-form consult-closed-form" noValidate onSubmit={event => { event.preventDefault(); void add(false); }}>
        <div className="form-row"><label htmlFor="closed-date">Ngày nghỉ</label><input id="closed-date" type="date" min={today} value={form.date} required
          aria-invalid={Boolean(formError && !form.date)} onChange={event => setForm({ ...form, date: event.target.value })} /></div>
        <div className="form-row"><label htmlFor="closed-reason">Lý do <span className="booking-optional">(hiển thị cho khách)</span></label>
          <input id="closed-reason" maxLength={200} value={form.reason} placeholder="Ví dụ: Nghỉ lễ Quốc khánh" onChange={event => setForm({ ...form, reason: event.target.value })} /></div>
        <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Thêm ngày nghỉ"}</button>
      </form>}
    {formError && <p className="notice notice-error" role="alert">{formError}</p>}
    {message && <p className="notice notice-success" role="status">{message}</p>}
    {state.error && <p className="notice notice-error" role="alert">{state.error}</p>}
    <h2>Ngày nghỉ sắp tới</h2>
    {!state.data && state.attempt !== attempt ? <p role="status">Đang tải…</p> : upcoming.length === 0 ? <p className="empty-state">Chưa có ngày nghỉ nào sắp tới.</p> :
      <ul className="consult-closed-list">{upcoming.map(row => <li key={row.date}>
        <div><strong>{formatDate(row.date)}</strong>{row.reason && <span>{row.reason}</span>}</div>
        <button type="button" className="btn btn-outline" disabled={saving} aria-label={`Mở lại ngày ${formatDate(row.date)}`} onClick={() => remove(row.date)}>Mở lại</button>
      </li>)}</ul>}
  </div>;
}
