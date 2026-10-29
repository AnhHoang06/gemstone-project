export default function ReviewSummary({ data }) {
  const count = data.totalVisible || 0;
  return <div className="review-summary"><div><strong>{Number(data.averageRating || 0).toFixed(1)} / 5</strong><p>{count} đánh giá</p></div>
    <div className="review-distribution">{[5,4,3,2,1].map(rating => {
      const n = data.ratingDistribution?.find(r => r.rating === rating)?.count || 0;
      return <div key={rating}><span>{rating} ★</span><meter min="0" max={count || 1} value={n} aria-label={`${rating} sao: ${n} đánh giá`} /><span>{count ? Math.round(n * 100 / count) : 0}%</span></div>;
    })}</div></div>;
}
