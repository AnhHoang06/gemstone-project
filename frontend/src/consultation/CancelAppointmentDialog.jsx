import { useEffect, useId, useRef, useState } from "react";
import { formatDate, wallClockParts } from "./time";

// Modal confirm for cancelling an appointment, with an optional (customer) or suggested (admin) reason.
export default function CancelAppointmentDialog({ appointment, saving, error, onClose, onConfirm, admin = false, fallbackFocus }) {
  const dialogRef = useRef(null);
  const id = useId();
  const [reason, setReason] = useState("");
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const fallback = fallbackFocus?.current;
    dialog.showModal?.();
    return () => {
      dialog.close?.();
      if (previousFocus?.isConnected) previousFocus.focus();
      else fallback?.focus();
    };
  }, [fallbackFocus]);
  const start = wallClockParts(appointment.startAt);
  return <dialog ref={dialogRef} className="appt-dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} aria-busy={saving}
    onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <p className="eyebrow">Gem Aurelia · Lịch hẹn</p>
    <h2 id={`${id}-title`}>Hủy lịch hẹn #{appointment.id}?</h2>
    <p id={`${id}-description`}>{appointment.serviceName}{start ? ` — ${formatDate(start.date)}, ${start.time}` : ""}.
      {admin ? " Khách hàng sẽ thấy trạng thái “Đã hủy” và lý do bạn nhập." : " Khung giờ sẽ được mở lại cho khách khác."}</p>
    <form method="dialog" onSubmit={event => { event.preventDefault(); if (!saving) onConfirm(reason.trim()); }}>
      <label htmlFor={`${id}-reason`}>Lý do hủy <span className="booking-optional">(không bắt buộc)</span></label>
      <textarea id={`${id}-reason`} maxLength={300} rows={3} value={reason} disabled={saving} onChange={event => setReason(event.target.value)} />
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      <div className="appt-dialog__actions">
        <button type="button" className="btn btn-outline" autoFocus disabled={saving} onClick={onClose}>Giữ lịch hẹn</button>
        <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? "Đang hủy…" : "Xác nhận hủy"}</button>
      </div>
    </form>
  </dialog>;
}
