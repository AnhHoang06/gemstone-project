import { useEffect, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import { getSessionToken, subscribeSession } from '../../auth/session';
import { contactDate, contactError, statuses } from '../../contact/contact';
import '../../styles/admin.css';
import '../../styles/contact.css';

function ContactList({ status, page, retry, setPage }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  useEffect(() => {
    let active = true;
    api.get('/admin/contacts', { params: { page, ...(status ? { status } : {}) } })
      .then(({ data }) => { if (active) setResult(data); })
      .catch(failure => { if (active) setError(contactError(failure, 'Không thể tải danh sách liên hệ.')); });
    return () => { active = false; };
  }, [status, page]);
  if (error) return <div><p className="contact-error" role="alert">{error}</p><button className="btn btn-outline" onClick={retry}>Thử lại</button></div>;
  if (!result) return <p role="status">Đang tải liên hệ...</p>;
  return <>
    <p>{result.total} yêu cầu liên hệ</p>
    {result.items.length === 0 ? <p>Chưa có yêu cầu liên hệ phù hợp.</p> : <div className="table-scroll" tabIndex={0} aria-label="Danh sách liên hệ">
      <table className="admin-table contact-table"><thead><tr><th>ID</th><th>Họ tên</th><th>Email</th><th>Chủ đề</th><th>Trạng thái</th><th>Ngày gửi</th></tr></thead>
        <tbody>{result.items.map(item => <tr key={item.id} tabIndex={0} className="contact-clickable-row" aria-label={'Mở liên hệ #' + item.id}
          onClick={event => { if (!event.target.closest('a,button')) navigate('/admin/contacts/' + item.id); }}
          onKeyDown={event => { if (event.target === event.currentTarget && ['Enter', ' '].includes(event.key)) { event.preventDefault(); navigate('/admin/contacts/' + item.id); } }}>
          <td><Link to={'/admin/contacts/' + item.id}>#{item.id}</Link></td><td>{item.fullName}</td><td>{item.email}</td><td>{item.subject}</td>
          <td><span className={'contact-badge contact-status-' + item.status}>{statuses[item.status]}</span></td><td>{contactDate(item.createdAt)}</td>
        </tr>)}</tbody></table></div>}
    <p className="contact-hint">Trang {page} / {Math.max(1, Math.ceil(result.total / 20))}</p>
    <nav className="contact-actions" aria-label="Phân trang liên hệ">
      <button className="btn btn-outline" disabled={page === 1} onClick={() => setPage(value => value - 1)}>Trang trước</button>
      <button className="btn btn-outline" disabled={page * 20 >= result.total || page >= 100000} onClick={() => setPage(value => value + 1)}>Trang sau</button>
    </nav>
  </>;
}

export default function AdminContacts() {
  const session = useSyncExternalStore(subscribeSession, getSessionToken);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  return <main className="admin-page contact-admin">
    <h1>Liên hệ khách hàng</h1><p>Tiếp nhận và theo dõi yêu cầu gửi đến Gem Aurelia.</p>
    <div className="contact-filters" role="group" aria-label="Lọc trạng thái liên hệ">
      {Object.entries({ '': 'Tất cả', ...statuses }).map(([value, label]) => <button key={value} type="button" className="btn btn-outline"
        aria-pressed={status === value} onClick={() => { setStatus(value); setPage(1); }}>{label}</button>)}
    </div>
    <ContactList key={[session, status, page, attempt].join(':')} status={status} page={page} setPage={setPage} retry={() => setAttempt(value => value + 1)} />

  </main>;
}
