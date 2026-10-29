import { useEffect, useId, useRef, useState } from 'react';
import api from '../api/api';
import { apiError, getSessionToken } from '../auth/session';
import ReviewImage from './ReviewImage';
function Preview({ file }) {
  const [src, setSrc] = useState('');
  useEffect(() => { const reader = new FileReader(); reader.onload = () => setSrc(reader.result); reader.readAsDataURL(file); return () => { reader.onload = null; reader.abort(); }; }, [file]);
  return <img src={src || undefined} alt={`Ảnh chờ tải: ${file.name}`} />;
}
export default function ReviewForm({ productId, initialReview, onSaved }) {
  const contentId = useId();
  const [review, setReview] = useState(initialReview);
  const [rating, setRating] = useState(initialReview?.rating || 0), [content, setContent] = useState(initialReview?.content || '');
  const [files, setFiles] = useState([]), [error, setError] = useState(''), [busy, setBusy] = useState(false), [message, setMessage] = useState('');
  const lock = useRef(false), token = getSessionToken();
  async function save(event) {
    event.preventDefault();
    if (lock.current) return;
    if (!rating || !content.trim() || content.length > 2000) { setError('Vui lòng chọn 1–5 sao và nhập nội dung tối đa 2.000 ký tự.'); return; }
    lock.current = true; setBusy(true); setError(''); setMessage('');
    try {
      const { data } = await api[review ? 'put' : 'post'](`/products/${productId}/reviews${review ? '/me' : ''}`, { rating, content: content.trim() });
      if (token !== getSessionToken()) return;
      setReview(data); // If a later upload fails, retry edits this review instead of creating a duplicate.
      if (files.length) {
        const form = new FormData(); files.forEach(file => form.append('files', file));
        const uploaded = await api.post(`/reviews/${data.id}/images`, form);
        if (token !== getSessionToken()) return;
        setReview(uploaded.data); setFiles([]);
      }
      setMessage('Đã lưu đánh giá.'); onSaved();
    } catch (err) {
      if (token === getSessionToken()) { setError(apiError(err, 'Không thể lưu đầy đủ đánh giá/ảnh. Kiểm tra dữ liệu trước khi thử lại.')); onSaved(); }
    } finally { lock.current = false; setBusy(false); }
  }
  async function removeImage(id) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      await api.delete(`/reviews/${review.id}/images/${id}`);
      if (token !== getSessionToken()) return;
      setReview(r => ({ ...r, images: r.images.filter(i => i.id !== id) })); onSaved();
    } catch (err) { if (token === getSessionToken()) setError(apiError(err, 'Không thể xóa ảnh.')); }
    finally { lock.current = false; setBusy(false); }
  }
  function choose(event) {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (selected.length + files.length + (review?.images.length || 0) > 3) { setError('Mỗi đánh giá tối đa 3 ảnh.'); return; }
    if (selected.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size > 5*1024*1024)) { setError('Chỉ nhận PNG, JPEG, WebP; mỗi ảnh tối đa 5 MB.'); return; }
    setFiles(old => [...old, ...selected]); setError('');
  }
  return <form className="review-form" noValidate onSubmit={save}>
    <h3>{review ? 'Sửa đánh giá của bạn' : 'Đánh giá sản phẩm'}</h3>
    {review && !review.isVisible && <p className="notice">Đánh giá đang bị ẩn. Chỉnh sửa không tự khôi phục hiển thị.</p>}
    <fieldset disabled={busy}><legend>Điểm đánh giá</legend><div className="review-stars">
      {[1,2,3,4,5].map(n => <label key={n}><input type="radio" name="rating" value={n} checked={rating === n} onChange={() => { setRating(n); setError(''); }} />{n} ★</label>)}
    </div></fieldset>
    <div><label htmlFor={contentId}>Nội dung</label><textarea id={contentId} maxLength={2000} value={content} disabled={busy} aria-invalid={!!error} aria-describedby={error ? 'review-form-error' : undefined} onChange={e => { setContent(e.target.value); setError(''); }} /></div>
    <label>Ảnh (tùy chọn, tối đa 3 ảnh, 5 MB/ảnh)<input type="file" accept="image/png,image/jpeg,image/webp" multiple disabled={busy} onChange={choose} /></label>
    <div className="review-images">{review?.images.map(image => <div key={image.id}><ReviewImage image={image} /><button type="button" disabled={busy} onClick={() => removeImage(image.id)}>Xóa ảnh</button></div>)}
      {files.map((file, index) => <div key={index}><Preview file={file} /><button type="button" disabled={busy} onClick={() => setFiles(list => list.filter((_, i) => i !== index))}>Bỏ ảnh đã chọn</button></div>)}</div>
    {error && <p id="review-form-error" role="alert" className="notice notice-error">{error}</p>}{message && <p role="status">{message}</p>}
    <button className="btn btn-primary" disabled={busy}>{busy ? 'Đang lưu…' : review ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}</button>
  </form>;
}
