import { lazy, Suspense, useState } from 'react';
import useApiData from '../../hooks/useApiData';
import '../../styles/admin.css';
import '../../styles/dashboard.css';

const AnalyticsCharts = lazy(() => import('../../components/AnalyticsCharts'));
const number = value => Number(value).toLocaleString('vi-VN');
const money = value => Number(value).toLocaleString('vi-VN', { style: 'currency', currency: 'VND' });
const today = () => new Date().toISOString().slice(0, 10);
const belongsTo = (product, category) => !category || [product.categoryId, product.parentId, product.grandparentId].includes(Number(category));

export default function AdminDashboard() {
  const [range, setRange] = useState('30d');
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [category, setCategory] = useState('');
  const [product, setProduct] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [metric, setMetric] = useState('revenue');
  const [mixMetric, setMixMetric] = useState('revenue');
  const options = useApiData('/dashboard/analytics/options?refresh=' + attempt);
  const query = new URLSearchParams({ range, refresh: attempt });
  if (range === 'custom') { query.set('start', start); query.set('end', end); }
  if (category) query.set('categoryId', category);
  if (product) query.set('productId', product);
  const analytics = useApiData('/dashboard/analytics?' + query);
  const categories = options.data?.categories || [];
  const products = options.data?.products || [];
  const categoryName = item => {
    const names = [item.name]; let parent = categories.find(c => c.id === item.parentId);
    for (let depth = 0; parent && depth < 2; depth++) { names.unshift(parent.name); parent = categories.find(c => c.id === parent.parentId); }
    return names.join(' / ') + (item.isActive ? '' : ' (ẩn)');
  };
  function selectCategory(value) {
    setCategory(String(value));
    if (!value || !belongsTo(products.find(p => p.id === Number(product)) || {}, value)) setProduct('');
  }
  function selectProduct(value) {
    setProduct(String(value));
    if (value && !category) setCategory(String(products.find(p => p.id === Number(value))?.categoryId || ''));
  }
  function drillDown(slice) {
    if (slice.type === 'category') { setCategory(String(slice.id)); setProduct(''); }
    else selectProduct(slice.id);
  }
  const data = analytics.data;
  const error = options.error || analytics.error;
  return <main className="admin-page analytics-page">
    <div className="admin-page-heading"><div><p className="eyebrow">Gem Aurelia · Quản trị</p><h1>Hoạt động kinh doanh</h1>
      <p className="analytics-subtitle">Theo dõi doanh số, từ danh mục đến từng viên đá.</p></div>
      <button type="button" className="btn btn-outline" disabled={analytics.loading || options.loading} onClick={() => setAttempt(v => v + 1)}>Làm mới</button></div>
    <section className="analytics-filters" aria-label="Bộ lọc báo cáo">
      <label>Thời gian<select aria-label="Thời gian" value={range} onChange={e => setRange(e.target.value)}>
        <option value="7d">7 ngày qua</option><option value="30d">30 ngày qua</option><option value="3m">3 tháng qua</option>
        <option value="6m">6 tháng qua</option><option value="1y">1 năm qua</option><option value="custom">Tùy chọn</option></select></label>
      <label>Danh mục<select aria-label="Danh mục" value={category} disabled={options.loading || !!options.error} onChange={e => selectCategory(e.target.value)}>
        <option value="">Tất cả danh mục</option>{categories.map(c => <option key={c.id} value={c.id}>{categoryName(c)}</option>)}</select></label>
      <label>Sản phẩm<select aria-label="Sản phẩm" value={product} disabled={options.loading || !!options.error} onChange={e => selectProduct(e.target.value)}>
        <option value="">Tất cả sản phẩm</option>{products.filter(p => belongsTo(p, category)).map(p => <option key={p.id} value={p.id}>{p.name}{p.isActive ? '' : ' (ẩn)'}</option>)}</select></label>
      {range === 'custom' && <><label>Từ ngày (UTC)<input type="date" value={start} max={end || today()} onChange={e => setStart(e.target.value)} /></label>
        <label>Đến ngày (UTC)<input type="date" value={end} min={start} max={today()} onChange={e => setEnd(e.target.value)} /></label></>}
    </section>
    <p className="analytics-rule">Chỉ tính đơn hoàn tất <strong>và đã thanh toán</strong> (Completed + Paid), theo ngày tạo đơn UTC. Giá trị dùng giá bán đã lưu trên đơn.</p>
    {error ? <div className="admin-error" role="alert">{error}<button className="btn btn-outline" onClick={() => setAttempt(v => v + 1)}>Thử lại</button></div> :
      analytics.loading || options.loading ? <div className="analytics-loading" role="status">Đang tải báo cáo bán hàng…</div> : data && <>
        <dl className="dashboard-metrics">
          {[
            ['Doanh thu', money(data.summary.revenue), 'Giá trị các dòng hàng phù hợp'],
            ['Đơn hoàn tất đã thanh toán', number(data.summary.completedOrders), 'Mỗi đơn chỉ được tính một lần'],
            ['Số lượng bán', number(data.summary.unitsSold), 'Tổng số lượng trên các dòng hàng'],
            ['Giá trị đơn trung bình', money(data.summary.averageOrderValue), 'Doanh thu lọc / số đơn phù hợp'],
          ].map(([title, value, note]) => <div className="dashboard-metric" key={title}><dt>{title}</dt><dd>{value}</dd><dd className="dashboard-metric-note">{note}</dd></div>)}
        </dl>
        {data.summary.completedOrders === 0 && <p className="analytics-empty" role="status">Chưa có doanh số hoàn tất và đã thanh toán trong phạm vi đã chọn.</p>}
        <Suspense fallback={<p role="status">Đang tải biểu đồ…</p>}><AnalyticsCharts data={data} onSelect={drillDown}
          metric={metric} setMetric={setMetric} mixMetric={mixMetric} setMixMetric={setMixMetric} /></Suspense>
      </>}
    <details className="analytics-notes"><summary>Cách đọc báo cáo</summary>
      <p>Đơn Unpaid, trạng thái thanh toán chưa rõ, đơn chưa hoàn tất và đơn đã hủy không được tính. Hệ thống hiện chưa có màn hình xác nhận thanh toán; không tự coi COD hoặc thao tác “Tôi đã chuyển khoản” là Paid.</p>
      <p>Khi lọc danh mục/sản phẩm, doanh thu chỉ gồm các dòng hàng phù hợp, không gồm toàn bộ giá trị đơn có nhiều loại hàng. Biểu đồ cơ cấu giữ phạm vi danh mục để so sánh khi chọn một sản phẩm.</p>
      <p>Sản phẩm và danh mục đang ẩn vẫn có lịch sử. Phân loại dùng danh mục hiện tại vì đơn hàng chưa lưu danh mục lịch sử. Thời gian là ngày tạo đơn UTC, không phải ngày nhận tiền hoặc ngày hoàn tất.</p>
    </details>
  </main>;
}
