import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';
import { getSessionToken, subscribeSession } from '../../auth/session';
import { contactDate, contactError, statuses } from '../../contact/contact';
import '../../styles/admin.css';
import '../../styles/contact.css';

function Detail({ id, session }) {
  const [item, setItem] = useState(null), [error, setError] = useState('');
  const [status, setStatus] = useState('New'), [note, setNote] = useState('');
  const [pending, setPending] = useState(false), [saved, setSaved] = useState(false);
  const [loaded, setLoaded] = useState(false), [attempt, setAttempt] = useState(0);
  const submitting = useRef(false), mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    let active = true;
    api.get('/admin/contacts/' + id).then(({ data }) => {
      if (!active) return;
      setItem(data); setStatus(data.status); setNote(data.adminNote || ''); setError('');
    }).catch(failure => {
      if (active) setError(failure.response?.status === 404 ? 'Không tìm thấy liên hệ.' : contactError(failure, 'Không thể tải nội dung liên hệ.'));
    }).finally(() => { if (active) setLoaded(true); });
    return () => { active = false; mounted.current = false; };
  }, [id, attempt]);
  async function submit(event) {
    event.preventDefault();
    if (submitting.current || !item) return;
    if (!Object.hasOwn(statuses, status) || note.length > 2000) { setError('Trạng thái không hợp lệ hoặc ghi chú vượt quá 2.000 ký tự.'); return; }
    submitting.current = true; setPending(true); setError(''); setSaved(false);
    try {
      await api.put('/admin/contacts/' + id, { status, adminNote: note.trim() || null });
      if (mounted.current && session === getSessionToken()) { setItem(previous => ({ ...previous, status })); setSaved(true); }
    } catch (failure) {
      if (mounted.current && session === getSessionToken()) setError(contactError(failure, 'Không thể lưu thay đổi. Vui lòng thử lại.'));
    } finally { submitting.current = false; if (mounted.current) setPending(false); }
  }
  return <main className="admin-page contact-admin">
    <Link to="/admin/contacts">← Danh sách liên hệ</Link><h1>Chi tiết liên hệ #{id}</h1>
    {error && <p className="contact-error" role="alert">{error}</p>}
    {!loaded ? <p role="status">Đang tải liên hệ...</p> : !item ? <button className="btn btn-outline" onClick={() => { setLoaded(false); setAttempt(value => value + 1); }}>Thử lại</button> :
      <div className="contact-grid">
        <section className="contact-panel"><h2>{item.subject}</h2>
          <span className={'contact-badge contact-status-' + item.status}>{statuses[item.status]}</span>
          <dl><dt>Họ tên</dt><dd>{item.fullName}</dd><dt>Email</dt><dd>{item.email}</dd>
            {item.phone && <><dt>Điện thoại</dt><dd>{item.phone}</dd></>}
            <dt>Ngày gửi</dt><dd>{contactDate(item.createdAt)}</dd>
            <dt>Tài khoản liên kết</dt><dd>{item.userId ? <Link to="/admin/customers">Khách hàng #{item.userId}</Link> : 'Khách vãng lai'}</dd></dl>
          <h2>Nội dung</h2><p className="contact-message">{item.message}</p>
        </section>
        <section className="contact-panel"><h2>Xử lý yêu cầu</h2>
          {saved && <p className="contact-success" role="status">Đã lưu thay đổi.</p>}
          <form noValidate onSubmit={submit}><fieldset disabled={pending}>
            <label htmlFor="contact-status">Trạng thái</label><select id="contact-status" value={status} onChange={event => { setStatus(event.target.value); setSaved(false); }}>
              {Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
            <label htmlFor="contact-note">Ghi chú nội bộ</label><textarea id="contact-note" rows={7} value={note} maxLength={2000} aria-describedby="contact-note-hint"
              onChange={event => { setNote(event.target.value); setSaved(false); }} />
            <p className="contact-hint" id="contact-note-hint">Chỉ Admin xem được. Tối đa 2.000 ký tự.</p>
            <button className="btn btn-primary" type="submit">{pending ? 'Đang lưu...' : 'Lưu thay đổi'}</button>
          </fieldset></form>
        </section>
      </div>}
  </main>;
}
export default function AdminContactDetail() {
  const { id } = useParams();
  const session = useSyncExternalStore(subscribeSession, getSessionToken);
  return <Detail key={session + ':' + id} id={id} session={session} />;
}
