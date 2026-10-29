import { Link, useParams } from 'react-router-dom';
import useApiData from '../hooks/useApiData';
import { useEngagementSession } from './session';
import ReviewForm from './ReviewForm';
export function OrderReviewLink({ productId }) {
  const result=useApiData(`/products/${productId}/reviews/me`);
  return <div><Link to={`/review-product/${productId}`}>{result.data?.review?'Xem / sửa đánh giá':'Đánh giá sản phẩm'}</Link></div>;
}
export default function OrderReview() {
  const {id}=useParams(),token=useEngagementSession();
  return <ReviewPage key={`${id}:${token}`} id={id}/>;
}
function ReviewPage({id}) {
  const result=useApiData(`/products/${id}/reviews/me`);
  return <main className="container commerce-page"><h1>Đánh giá sản phẩm đã mua</h1><Link to="/orders">← Lịch sử đơn hàng</Link>
    {result.loading?<p role="status">Đang kiểm tra lịch sử mua hàng…</p>:result.error?<p role="alert">{result.error}</p>:result.data?.canReview?
      <><p>{result.data.review?.productName}</p><ReviewForm productId={id} initialReview={result.data.review} onSaved={()=>{}} /></>:<p>Bạn cần có đơn Hoàn tất chứa sản phẩm này để đánh giá.</p>}</main>;
}
