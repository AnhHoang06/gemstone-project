import { useRef, useState, useSyncExternalStore } from 'react';
import api from '../api/api';
import { getSessionToken, subscribeSession } from '../auth/session';
import { contactError, emptyContact, subjects, validateContact } from '../contact/contact';
import '../styles/contact.css';

function ContactForm({ session }) {
  const [values, setValues] = useState({ ...emptyContact });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  function change(name, value) {
    const next = { ...values, [name]: value };
    setValues(next);
    setErrors(previous => ({ ...previous, [name]: previous[name] ? validateContact(next)[name] : undefined }));
    setSuccess(false);
  }
  async function submit(event) {
    event.preventDefault();
    if (submitting.current) return;
    const nextErrors = validateContact(values);
    setErrors(nextErrors); setError(''); setSuccess(false);
    if (Object.keys(nextErrors).length) {
      event.currentTarget.elements.namedItem(Object.keys(nextErrors)[0])?.focus();
      return;
    }
    submitting.current = true; setPending(true);
    try {
      await api.post('/contact', Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])));
      if (session !== getSessionToken()) return;
      setValues({ ...emptyContact }); setErrors({}); setSuccess(true);
    } catch (failure) {
      if (session === getSessionToken()) setError(contactError(failure, 'Chưa thể gửi liên hệ. Vui lòng thử lại sau.'));
    } finally { submitting.current = false; setPending(false); }
  }
  const inputProps = name => ({
    id: 'contact-' + name, name, value: values[name],
    onChange: event => change(name, event.target.value),
    'aria-invalid': Boolean(errors[name]), 'aria-describedby': errors[name] ? 'error-' + name : undefined,
  });
  const fieldError = name => errors[name] && <p className="contact-field-error" id={'error-' + name}>{errors[name]}</p>;
  return <section className="contact-panel" aria-labelledby="contact-form-title">
    <h2 id="contact-form-title">Gửi lời nhắn</h2><p>Các trường có dấu * là bắt buộc.</p>
    {success && <div className="contact-success" role="status"><strong>Đã gửi yêu cầu liên hệ</strong><p>Gem Aurelia đã ghi nhận nội dung của bạn.</p></div>}
    {error && <p className="contact-error" role="alert">{error}</p>}
    <form noValidate onSubmit={submit} aria-busy={pending}>
      <fieldset disabled={pending}>
        <label htmlFor="contact-fullName">Họ và tên *</label>
        <input {...inputProps('fullName')} autoComplete="name" maxLength={100} required />{fieldError('fullName')}
        <label htmlFor="contact-email">Email *</label>
        <input {...inputProps('email')} type="email" autoComplete="email" maxLength={254} required />{fieldError('email')}
        <label htmlFor="contact-phone">Số điện thoại (không bắt buộc)</label>
        <input {...inputProps('phone')} type="tel" autoComplete="tel" maxLength={20} />{fieldError('phone')}
        <label htmlFor="contact-subject">Chủ đề *</label>
        <select {...inputProps('subject')} required><option value="">Chọn chủ đề</option>{subjects.map(subject => <option key={subject}>{subject}</option>)}</select>{fieldError('subject')}
        <label htmlFor="contact-message">Nội dung *</label>
        <textarea {...inputProps('message')} rows={6} maxLength={4000} required />{fieldError('message')}
        <p className="contact-hint">Từ 10 đến 4.000 ký tự. Không gửi mật khẩu hoặc thông tin thanh toán nhạy cảm.</p>
        <button className="btn btn-primary" type="submit">{pending ? 'Đang gửi...' : 'Gửi liên hệ'}</button>
      </fieldset>
    </form>
  </section>;
}

export default function ContactMessageForm() {
  const session = useSyncExternalStore(subscribeSession, getSessionToken);
  return <ContactForm key={session} session={session} />;
}
