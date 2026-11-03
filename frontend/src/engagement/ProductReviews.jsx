import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import useApiData from '../hooks/useApiData';
import { apiError, getSessionToken } from '../auth/session';
import { useEngagementSession } from './session';
import ReviewSummary from './ReviewSummary';
import ReviewForm from './ReviewForm';
import ReviewImage from './ReviewImage';
export default function ProductReviews({ productId }) {
  const token = useEngagementSession();
  return <ReviewContent key={`${productId}:${token}`} productId={productId} token={token} />;
}
function ReviewContent({ productId, token }) {
  const [rating, setRating] = useState(''), [sort, setSort] = useState('newest'), [page, setPage] = useState(1), [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(null), [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { if (window.location.hash === '#reviews') document.getElementById('reviews')?.scrollIntoView(); }, [productId]);
  const reviews = useApiData(`/products/${productId}/reviews?rating=${rating}&sort=${sort}&page=${page}&v=${version}`);
  const customer = token && localStorage.getItem('role') === 'Customer';
  const mine = useApiData(customer ? `/products/${productId}/reviews/me` : null);
  const refresh = () => setVersion(v => v + 1);
  async function helpful(review) {
    if (lock.current) return;
    lock.current = true; setBusy(review.id); setError('');
    try {
      await api[review.helpfulByMe ? 'delete' : 'put'](`/reviews/${review.id}/helpful`);
      if (token === getSessionToken()) refresh();
    } catch (err) { if (token === getSessionToken()) setError(apiError(err, 'Không thể cập nhật bình chọn.')); }
    finally { lock.current = false; setBusy(null); }
  }
  return <section className="engagement-section" id="reviews"><h2>Đánh giá sản phẩm</h2>
    {reviews.data && <ReviewSummary data={reviews.data} />}
    {!token && <p><Link to="/login">Đăng nhập</Link> để đánh giá sau khi mua hàng hoặc bình chọn hữu ích.</p>}
    {customer && (mine.loading ? <p role="status">Đang kiểm tra lịch sử mua hàng…</p> : mine.error ? <p role="alert">{mine.error}</p> :
      mine.data?.canReview ? <ReviewForm key={mine.data.review?.id || 'new'} productId={productId} initialReview={mine.data.review} onSaved={refresh} /> :
      <p>Chỉ khách hàng có đơn Hoàn tất chứa sản phẩm này mới được đánh giá.</p>)}
    <div className="review-filters"><div><label htmlFor="review-rating-filter">Số sao</label><select id="review-rating-filter" value={rating} onChange={e => { setRating(e.target.value); setPage(1); }}>
      <option value="">Tất cả</option>{[5,4,3,2,1].map(n => <option key={n} value={n}>{n} sao</option>)}</select></div>
      <div><label htmlFor="review-sort-filter">Sắp xếp</label><select id="review-sort-filter" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="newest">Mới nhất</option><option value="highest">Điểm cao nhất</option><option value="lowest">Điểm thấp nhất</option><option value="helpful">Hữu ích nhất</option></select></div></div>
    {error && <p role="alert" className="notice notice-error">{error}</p>}
    {reviews.loading ? <p role="status">Đang tải đánh giá…</p> : reviews.error ? <p role="alert">{reviews.error}</p> : <>
      {!reviews.data?.items.length && <p>Chưa có đánh giá phù hợp.</p>}
      {reviews.data?.items.filter(r => r.isVisible).map(r => <article className="review-card" key={r.id}>
        <header><strong>{r.customerName}</strong><span aria-label={`${r.rating} trên 5 sao`}>{'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}</span>{r.verifiedPurchase && <span className="status-badge">Đã mua hàng</span>}</header>
        <p className="review-content">{r.content}</p><div className="review-images">{r.images.map(image => <ReviewImage key={image.id} image={image} />)}</div>
        <small>{new Date(r.createdAt).toLocaleDateString('vi-VN')}{r.updatedAt && ' · Đã chỉnh sửa'}</small>
        {token && !r.isOwn ? <button className="btn btn-outline" aria-pressed={r.helpfulByMe} disabled={busy !== null} onClick={() => helpful(r)}>Hữu ích ({r.helpfulCount})</button> : <span> Hữu ích ({r.helpfulCount})</span>}
      </article>)}
      <div className="review-pagination"><button disabled={page <= 1} onClick={() => setPage(p => p-1)}>Trước</button><span>Trang {page} / {Math.max(1,reviews.data?.totalPages || 0)}</span><button disabled={page >= (reviews.data?.totalPages || 0)} onClick={() => setPage(p => p+1)}>Sau</button></div>
    </>}
  </section>;
}
