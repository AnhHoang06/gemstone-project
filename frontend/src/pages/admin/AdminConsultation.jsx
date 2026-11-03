import { useRef, useState } from "react";
import ServicesTab from "../../consultation/admin/ServicesTab";
import HoursTab from "../../consultation/admin/HoursTab";
import ClosedDatesTab from "../../consultation/admin/ClosedDatesTab";
import "../../styles/consultation.css";

const TABS = [["services", "Dịch vụ"], ["hours", "Giờ làm việc"], ["closed", "Ngày nghỉ"]];

export default function AdminConsultation() {
  const [tab, setTab] = useState("services");
  const refs = useRef({});
  function onKeyDown(event, index) {
    const offsets = { ArrowRight: 1, ArrowLeft: -1, Home: -index, End: TABS.length - 1 - index };
    if (!(event.key in offsets)) return;
    event.preventDefault();
    const [key] = TABS[(index + offsets[event.key] + TABS.length) % TABS.length];
    setTab(key); refs.current[key]?.focus();
  }
  return <main className="admin-page consult-admin">
    <div className="admin-page-heading"><h1>Cấu hình tư vấn</h1></div>
    <p>Quản lý dịch vụ tư vấn, giờ làm việc của showroom và ngày nghỉ. Thay đổi áp dụng ngay cho trang Đặt lịch tư vấn.</p>
    <div className="consult-tabs" role="tablist" aria-label="Cấu hình tư vấn">
      {TABS.map(([key, label], index) => <button key={key} type="button" role="tab" id={`consult-tab-${key}`} aria-controls={`consult-panel-${key}`}
        aria-selected={tab === key} tabIndex={tab === key ? 0 : -1} ref={node => { refs.current[key] = node; }}
        onClick={() => setTab(key)} onKeyDown={event => onKeyDown(event, index)}>{label}</button>)}
    </div>
    <section role="tabpanel" id={`consult-panel-${tab}`} aria-labelledby={`consult-tab-${tab}`} className="consult-panel">
      {tab === "services" ? <ServicesTab /> : tab === "hours" ? <HoursTab /> : <ClosedDatesTab />}
    </section>
  </main>;
}
