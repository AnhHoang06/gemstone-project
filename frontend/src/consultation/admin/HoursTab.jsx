import { useEffect, useRef, useState } from "react";
import { apiError } from "../../auth/session";
import { affectedAppointments, consultationApi } from "../api";
import { minutesOf, WEEKDAYS_LONG } from "../time";
import AffectedAppointments from "./AffectedAppointments";

const ORDER = [1, 2, 3, 4, 5, 6, 0];
const SLOT_OPTIONS = [15, 20, 30, 45, 60, 90, 120, 180, 240];
const closedDay = dayOfWeek => ({ dayOfWeek, isOpen: false, openTime: "09:00", closeTime: "18:00", slotMinutes: 60, capacityPerSlot: 1 });

function validateHours(rows) {
  const errors = {};
  for (const row of rows) {
    if (!row.isOpen) continue;
    const open = minutesOf(row.openTime), close = minutesOf(row.closeTime);
    const slot = Number(row.slotMinutes), capacity = Number(row.capacityPerSlot);
    if (!row.openTime || !row.closeTime || Number.isNaN(open) || Number.isNaN(close)) errors[row.dayOfWeek] = "Nhập đủ giờ mở và giờ đóng cửa.";
    else if (open >= close) errors[row.dayOfWeek] = "Giờ mở cửa phải trước giờ đóng cửa.";
    else if (!Number.isInteger(slot) || slot < 15 || slot > 240) errors[row.dayOfWeek] = "Độ dài khung giờ từ 15 đến 240 phút.";
    else if (close - open < slot) errors[row.dayOfWeek] = "Khoảng mở cửa phải dài ít nhất một khung giờ.";
    else if (!Number.isInteger(capacity) || capacity < 1 || capacity > 20) errors[row.dayOfWeek] = "Số khách mỗi khung giờ từ 1 đến 20.";
  }
  return errors;
}

export default function HoursTab() {
  const [rows, setRows] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [affected, setAffected] = useState(null);
  const lock = useRef(false);

  useEffect(() => {
    let active = true;
    consultationApi.adminHours().then(list => {
      if (active) setRows(ORDER.map(day => list.find(row => row.dayOfWeek === day) || closedDay(day)));
    }).catch(err => { if (active) setLoadError(apiError(err, "Không tải được giờ làm việc.")); });
    return () => { active = false; };
  }, []);

  const edit = (dayOfWeek, patch) => { setRows(previous => previous.map(row => row.dayOfWeek === dayOfWeek ? { ...row, ...patch } : row)); setMessage(""); setErrors(previous => ({ ...previous, [dayOfWeek]: "" })); };

  async function save(force = false) {
    if (lock.current) return;
    const found = validateHours(rows);
    setErrors(found);
    if (Object.keys(found).length) { setError("Vui lòng sửa các dòng được đánh dấu."); return; }
    lock.current = true; setSaving(true); setError(""); setMessage("");
    try {
      const payload = rows.map(row => ({ ...row, slotMinutes: Number(row.slotMinutes), capacityPerSlot: Number(row.capacityPerSlot) }));
      await consultationApi.saveHours(payload, force);
      setAffected(null); setMessage(force ? "Đã lưu giờ làm việc. Hãy liên hệ khách có lịch bị ảnh hưởng." : "Đã lưu giờ làm việc.");
    } catch (err) {
      if (err.response?.status === 409 && !force) setAffected({ items: affectedAppointments(err), message: err.response?.data?.message });
      else setError(apiError(err, "Không lưu được giờ làm việc."));
    } finally { lock.current = false; setSaving(false); }
  }

  if (loadError) return <p className="notice notice-error" role="alert">{loadError}</p>;
  if (!rows) return <p role="status">Đang tải giờ làm việc…</p>;
  return <div className="consult-admin-hours">
    <p className="consult-admin-help">Lịch tuần áp dụng cho mọi dịch vụ. Dịch vụ dài hơn một khung giờ sẽ chiếm nhiều khung liên tiếp.</p>
    {affected ? <AffectedAppointments items={affected.items} message={affected.message} saving={saving} forceLabel="Vẫn lưu giờ làm việc"
      onBack={() => setAffected(null)} onForce={() => save(true)} /> : <form noValidate onSubmit={event => { event.preventDefault(); void save(false); }}>
      <div className="table-scroll"><table className="shop-table consult-hours-table"><thead><tr>
        <th scope="col">Ngày</th><th scope="col">Mở cửa</th><th scope="col">Giờ mở</th><th scope="col">Giờ đóng</th><th scope="col">Độ dài khung giờ</th><th scope="col">Khách mỗi khung</th></tr></thead>
        <tbody>{rows.map(row => { const name = WEEKDAYS_LONG[row.dayOfWeek], invalid = Boolean(errors[row.dayOfWeek]);
          return <tr key={row.dayOfWeek} className={row.isOpen ? "" : "is-closed"}>
            <th scope="row">{name}{invalid && <small className="field-error" role="alert">{errors[row.dayOfWeek]}</small>}</th>
            <td><label className="consult-switch"><input type="checkbox" checked={row.isOpen} disabled={saving} onChange={event => edit(row.dayOfWeek, { isOpen: event.target.checked })} />
              <span>{row.isOpen ? "Mở" : "Nghỉ"}</span><span className="visually-hidden"> — {name}</span></label></td>
            <td><input type="time" step={900} aria-label={`Giờ mở cửa ${name}`} value={row.openTime} disabled={!row.isOpen || saving} aria-invalid={invalid}
              onChange={event => edit(row.dayOfWeek, { openTime: event.target.value })} /></td>
            <td><input type="time" step={900} aria-label={`Giờ đóng cửa ${name}`} value={row.closeTime} disabled={!row.isOpen || saving} aria-invalid={invalid}
              onChange={event => edit(row.dayOfWeek, { closeTime: event.target.value })} /></td>
            <td><select aria-label={`Độ dài khung giờ ${name}`} value={row.slotMinutes} disabled={!row.isOpen || saving} onChange={event => edit(row.dayOfWeek, { slotMinutes: Number(event.target.value) })}>
              {[...new Set([...SLOT_OPTIONS, Number(row.slotMinutes)])].sort((a, b) => a - b).map(value => <option key={value} value={value}>{value} phút</option>)}</select></td>
            <td><input type="number" min={1} max={20} step={1} inputMode="numeric" aria-label={`Số khách mỗi khung giờ ${name}`} value={row.capacityPerSlot}
              disabled={!row.isOpen || saving} onChange={event => edit(row.dayOfWeek, { capacityPerSlot: event.target.value })} /></td>
          </tr>; })}</tbody></table></div>
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {message && <p className="notice notice-success" role="status">{message}</p>}
      <div className="consult-admin-actions"><button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Đang lưu…" : "Lưu giờ làm việc"}</button></div>
    </form>}
  </div>;
}
