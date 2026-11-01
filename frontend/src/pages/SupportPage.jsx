import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronIcon } from '../components/Icons';
import { filterSupportFaq, orderGuide, supportCategories, supportLinks } from '../data/supportContent';
import '../styles/support.css';

function StatusIcon({ type }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {type === 'clock' ? <><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></> : type === 'truck' ? <><path d="M3 6h11v12H3zM14 10h4l3 4v4h-7" /><circle cx="7" cy="18" r="2" /><circle cx="18" cy="18" r="2" /></> : type === 'cancel' ? <><circle cx="12" cy="12" r="9" /><path d="m8 8 8 8m0-8-8 8" /></> : <><circle cx="12" cy="12" r="9" /><path d="m7 12 3 3 7-7" /></>}
  </svg>;
}
function FaqItem({ item }) {
  const [open, setOpen] = useState(false);
  const id = `support-answer-${item.id}`;
  return <article className="support-faq">
    <h3><button id={`${id}-trigger`} type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}>
      <span>{item.title}</span><ChevronIcon direction={open ? 'up' : 'down'} />
    </button></h3>
    <div id={id} hidden={!open} aria-labelledby={`${id}-trigger`} className="support-answer">
      <p>{item.content}</p>{item.link && <Link to={item.link.to}>{item.link.label} <span aria-hidden="true">↗</span></Link>}
    </div>
  </article>;
}
export default function SupportPage() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const searchRef = useRef(null);
  const matches = filterSupportFaq(query, category);
  function reset() { setQuery(''); setCategory(''); searchRef.current?.focus(); }
  return <main className="store-container support-page">
    <header className="support-heading"><p className="eyebrow">Gem Aurelia · Chăm sóc khách hàng</p>
      <h1>Trung tâm hỗ trợ</h1><p>Tìm hướng dẫn mua sắm, theo dõi đơn hàng và thông tin bạn cần.</p>
    </header>
    <section className="support-search" aria-label="Tìm kiếm hỗ trợ">
      <label htmlFor="support-search">Bạn cần hỗ trợ điều gì?</label>
      <div><input id="support-search" ref={searchRef} type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm câu hỏi hoặc chủ đề hỗ trợ..." />
        {(query || category) && <button type="button" onClick={reset}>Xóa bộ lọc</button>}</div>
    </section>
    <section className="support-topics" aria-labelledby="support-topics-title"><h2 id="support-topics-title">Chủ đề hỗ trợ</h2>
      <div className="support-topic-grid"><button type="button" aria-pressed={!category} onClick={() => setCategory('')}>Tất cả chủ đề</button>
        {supportCategories.map(topic => <button key={topic.id} type="button" aria-pressed={category === topic.id} onClick={() => setCategory(topic.id)}>{topic.title}</button>)}
      </div>
    </section>
    <nav className="support-quick" aria-label="Liên kết nhanh">{supportLinks.map(link => <Link key={link.to} to={link.to}>{link.label}<span aria-hidden="true"> ↗</span></Link>)}</nav>
    <section className="support-status" aria-labelledby="support-status-title"><h2 id="support-status-title">Hiểu trạng thái đơn hàng</h2>
      <p className="support-muted">Hướng dẫn chung, không phải tiến độ của một đơn cụ thể.</p>
      <ol>{orderGuide.map(state => <li key={state.id} className={`support-state support-state--${state.id}`}><StatusIcon type={state.icon} /><div><h3>{state.title}</h3><p>{state.text}</p></div></li>)}</ol>
      <p className="support-cancelled"><StatusIcon type="cancel" /><span><strong>Đã hủy</strong> — Đơn đã dừng xử lý; không chuyển khoản cho đơn này.</span></p>
    </section>
    <section aria-labelledby="support-faq-title" className="support-results"><h2 id="support-faq-title">Câu hỏi thường gặp</h2>
      <p className="support-muted" role="status" aria-live="polite">{matches.length} câu hỏi phù hợp</p>
      {!matches.length ? <div className="support-empty"><h3>Không tìm thấy nội dung phù hợp.</h3><p>Thử từ khóa khác hoặc xóa bộ lọc để xem tất cả câu hỏi.</p><button type="button" onClick={reset}>Xem tất cả câu hỏi</button><Link to="/lien-he">Liên hệ với chúng tôi</Link></div> :
        supportCategories.map(topic => {
          const entries = matches.filter(item => item.category === topic.id);
          return entries.length ? <section key={topic.id} className="support-group" aria-labelledby={`support-topic-${topic.id}`}><h2 id={`support-topic-${topic.id}`}>{topic.title}</h2>{entries.map(item => <FaqItem key={item.id} item={item} />)}</section> : null;
        })}
    </section>
    <section className="support-contact" aria-labelledby="support-contact-title"><div><h2 id="support-contact-title">Bạn vẫn cần hỗ trợ?</h2><p>Trò chuyện với cửa hàng về sản phẩm hoặc đơn hàng của bạn tại trang Liên hệ.</p></div><Link className="btn btn-primary" to="/lien-he">Liên hệ với chúng tôi</Link></section>
  </main>;
}
