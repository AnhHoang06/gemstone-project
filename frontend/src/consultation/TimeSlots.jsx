import { useId } from "react";
import { formatDate, minutesOf } from "./time";

const PERIODS = [["morning", "Sáng", slot => minutesOf(slot.start) < 12 * 60], ["afternoon", "Chiều", slot => minutesOf(slot.start) >= 12 * 60]];

export default function TimeSlots({ date, day, loading, error, onRetry, selected, onSelect, disabled = false, pointer }) {
  const name = useId();
  if (!date) return <p className="time-slots__hint">Chọn một ngày trên lịch để xem khung giờ còn trống.</p>;
  if (loading && !day) return <p className="time-slots__hint" role="status">Đang tải khung giờ…</p>;
  if (error) return <p className="notice notice-error" role="alert">{error} <button type="button" className="link-button" onClick={onRetry}>Thử lại</button></p>;
  const slots = day?.isOpen ? day.slots : [];
  if (!slots.some(slot => slot.remaining > 0)) {
    return <p className="time-slots__empty" role="status">{day && !day.isOpen ? `Showroom đóng cửa ngày ${formatDate(date, { weekday: false })}${day.reason ? ` (${day.reason})` : ""}.`
      : `Ngày ${formatDate(date, { weekday: false })} không còn khung giờ trống.`} Vui lòng chọn ngày khác.</p>;
  }
  return <fieldset className="time-slots" disabled={disabled}>
    <legend className="time-slots__legend">Khung giờ ngày {formatDate(date)}</legend>
    {PERIODS.map(([key, label, test]) => {
      const group = slots.filter(test);
      if (!group.length) return null;
      return <div key={key} className="time-slots__period" role="radiogroup" aria-label={`Buổi ${label.toLowerCase()}`}>
        <p className="time-slots__period-label" aria-hidden="true">{label}</p>
        <div className="time-slots__chips">{group.map(slot => {
          const full = slot.remaining <= 0;
          return <label key={slot.start} className={`time-chip${selected === slot.start ? " is-selected" : ""}${full ? " is-full" : ""}`}
            onPointerDown={() => { if (pointer) pointer.current = true; }}>
            <input type="radio" className="visually-hidden" name={name} value={slot.start} checked={selected === slot.start} disabled={full}
              onChange={() => onSelect(slot.start, false)}
              onClick={() => { const viaPointer = pointer?.current; if (pointer) pointer.current = false; if (viaPointer) onSelect(slot.start, true); }} />
            <span className="time-chip__time">{slot.start}</span>{" "}
            {full ? <span className="time-chip__note">Hết chỗ</span> : slot.remaining <= 1 && <span className="time-chip__note">còn {slot.remaining} chỗ</span>}
          </label>;
        })}</div>
      </div>;
    })}
  </fieldset>;
}
