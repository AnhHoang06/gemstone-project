import { Link } from "react-router-dom";
import useApiData from "../hooks/useApiData";
import { site } from "../config/site";
import ChatPanel from "../chat/ChatPanel";
import { WEEK, formatDate, normalizeHours, storeNow } from "../chat/hours";
import { CalendarIcon, ClockIcon, LinkIcon, MailIcon, PhoneIcon, PinIcon } from "../chat/ChatIcons";

function HoursCard() {
  const { data, loading, error } = useApiData("/consultation/hours");
  const now = storeNow();
  const { days, closed } = normalizeHours(data);
  const today = days.get(now.day);
  const closedToday = closed.find(item => item.date === now.date);
  const openNow = today?.isOpen && !closedToday && now.time >= today.open && now.time < today.close;
  return <section className="contact-card" aria-labelledby="contact-hours">
    <h2 id="contact-hours"><ClockIcon /> Giờ làm việc</h2>
    {loading ? <p role="status" className="contact-muted">Đang tải giờ làm việc…</p> : error ? <p role="alert" className="contact-muted">Chưa tải được giờ làm việc. Vui lòng thử lại sau.</p> : <>
      {days.size > 0 && <p className={`contact-open-state${openNow ? " contact-open-state--open" : ""}`}>
        {closedToday ? `Hôm nay nghỉ${closedToday.reason ? `: ${closedToday.reason}` : ""}`
          : openNow ? `Đang mở cửa · đóng lúc ${today.close}` : "Hiện đã ngoài giờ làm việc"}</p>}
      {days.size === 0 ? <p className="contact-muted">Giờ làm việc đang được cập nhật.</p> : <dl className="contact-hours">
        {WEEK.map(([day, label]) => {
          const hours = days.get(day);
          return <div key={day} className={day === now.day ? "is-today" : undefined} aria-current={day === now.day ? "date" : undefined}>
            <dt>{label}{day === now.day && <span className="contact-today">Hôm nay</span>}</dt>
            <dd>{hours?.isOpen ? `${hours.open} – ${hours.close}` : "Nghỉ"}</dd>
          </div>;
        })}
      </dl>}
      {closed.length > 0 && <div className="contact-closed"><h3>Ngày nghỉ sắp tới</h3><ul>
        {closed.slice(0, 5).map(item => <li key={item.date}><strong>{formatDate(item.date)}</strong>{item.reason && ` · ${item.reason}`}</li>)}
      </ul></div>}
    </>}
  </section>;
}

function ContactInfoCard() {
  const socials = (site.socialLinks || []).filter(link => link?.url && link?.label);
  if (!site.address && !site.phone && !site.email && socials.length === 0) return null;
  return <section className="contact-card" aria-labelledby="contact-info">
    <h2 id="contact-info">Thông tin liên hệ</h2>
    <ul className="contact-info-list">
      {site.address && <li><PinIcon /><span>{site.address}</span></li>}
      {site.phone && <li><PhoneIcon /><a href={`tel:${site.phone.replace(/\s+/g, "")}`}>{site.phone}</a></li>}
      {site.email && <li><MailIcon /><a href={`mailto:${site.email}`}>{site.email}</a></li>}
      {socials.map(link => <li key={link.url}><LinkIcon /><a href={link.url} target="_blank" rel="noreferrer">{link.label}</a></li>)}
    </ul>
  </section>;
}

export default function Contact() {
  return <div className="store-container contact-page">
    <header className="contact-hero">
      <p className="contact-eyebrow">Chăm sóc khách hàng</p>
      <h1>Liên hệ Gem Aurelia</h1>
      <p>Trò chuyện trực tiếp với tư vấn viên về đá quý, đơn hàng hay lịch hẹn — tin nhắn được lưu lại để bạn xem tiếp bất cứ lúc nào.</p>
    </header>
    <div className="contact-layout">
      <div className="contact-chat"><ChatPanel variant="page" /></div>
      <aside className="contact-aside" aria-label="Thông tin cửa hàng">
        <HoursCard />
        <section className="contact-card contact-card--booking" aria-labelledby="contact-booking">
          <h2 id="contact-booking"><CalendarIcon /> Đặt lịch tư vấn tại showroom</h2>
          <p>Chọn dịch vụ và khung giờ phù hợp, tư vấn viên sẽ xác nhận lịch hẹn với bạn.</p>
          <Link className="chat-btn chat-btn--primary" to="/hen-lich">Đặt lịch tư vấn</Link>
        </section>
        <ContactInfoCard />
      </aside>
    </div>
  </div>;
}
