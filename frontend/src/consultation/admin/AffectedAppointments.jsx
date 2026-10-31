import { useEffect, useRef } from "react";
import AppointmentStatusBadge from "../AppointmentStatusBadge";
import { formatDate, wallClockParts } from "../time";

// Shown when the API answers 409 because a schedule change would strand existing appointments.
export default function AffectedAppointments({ items, message, saving, onForce, onBack, forceLabel }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <section className="affected-panel" role="alert" aria-labelledby="affected-title">
    <h2 id="affected-title" ref={ref} tabIndex={-1}>Thay đổi này ảnh hưởng {items.length} lịch hẹn</h2>
    <p>{message || "Các lịch hẹn dưới đây sẽ nằm ngoài giờ làm việc mới hoặc rơi vào ngày nghỉ và không tự hủy."} Hãy liên hệ khách để đổi giờ hoặc hủy lịch trong mục Lịch hẹn.</p>
    {items.length > 0 && <div className="table-scroll"><table className="shop-table"><thead><tr><th scope="col">Thời gian</th><th scope="col">Khách hàng</th><th scope="col">Dịch vụ</th><th scope="col">Trạng thái</th></tr></thead>
      <tbody>{items.map(item => { const start = wallClockParts(item.startAt);
        return <tr key={item.id}><td>{start ? `${formatDate(start.date)} · ${start.time}` : item.startAt}</td>
          <td>{item.contactName || item.customer?.fullName}{item.phone && <small>{item.phone}</small>}</td><td>{item.serviceName}</td>
          <td><AppointmentStatusBadge status={item.status} /></td></tr>; })}</tbody></table></div>}
    <div className="admin-delete-actions">
      <button type="button" className="btn btn-outline" disabled={saving} onClick={onBack}>Quay lại chỉnh sửa</button>
      <button type="button" className="btn btn-danger" disabled={saving} onClick={onForce}>{saving ? "Đang lưu…" : forceLabel}</button>
    </div>
  </section>;
}
