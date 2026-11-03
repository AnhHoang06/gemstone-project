import { useEffect, useRef } from 'react';
import { Chart, LineController, DoughnutController, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';

Chart.register(LineController, DoughnutController, LineElement, PointElement, ArcElement, CategoryScale, LinearScale, Tooltip);
const colors = ['#24594a', '#a38242', '#54778a', '#7b5967', '#727952', '#906b49', '#516b65', '#77728c'];
const labels = { revenue: 'Doanh thu', unitsSold: 'Số lượng bán', orders: 'Đơn hàng' };
const format = (value, metric) => Number(value).toLocaleString('vi-VN', metric === 'revenue' ? { style: 'currency', currency: 'VND' } : undefined);
const date = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('vi-VN', { timeZone: 'UTC' });

function CanvasChart({ type, data, options, label }) {
  const ref = useRef(null);
  useEffect(() => {
    const chart = new Chart(ref.current, { type, data, options: {
      responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false } }, ...options,
    } });
    return () => chart.destroy();
  }, [type, data, options]);
  return <canvas ref={ref} role="img" aria-label={label}>Số liệu chi tiết được cung cấp bên dưới biểu đồ.</canvas>;
}

export default function AnalyticsCharts({ data, onSelect, metric, setMetric, mixMetric, setMixMetric }) {
  const slices = data.breakdown.filter(s => s[mixMetric] > 0);
  const total = slices.reduce((sum, slice) => sum + slice[mixMetric], 0);
  const selected = data.filters.productId;
  const trend = data.trend;
  const rangeLabel = row => row.startDate === row.endDate ? date(row.startDate) : `${date(row.startDate)} – ${date(row.endDate)}`;
  return <div className="analytics-charts">
    <section className="analytics-panel" aria-labelledby="sales-title">
      <div className="analytics-panel-heading"><div><h2 id="sales-title">Hoạt động bán hàng</h2><p>{date(data.filters.start)} – {date(data.filters.end)} · UTC</p></div>
        <label>Chỉ số<select aria-label="Chỉ số" value={metric} onChange={e => setMetric(e.target.value)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
      <div className="analytics-line"><CanvasChart type="line" label={`Hoạt động bán hàng: ${labels[metric]}`} data={{
        labels: trend.map(row => date(row.startDate)), datasets: [{ label: labels[metric], data: trend.map(row => row[metric]), borderColor: colors[0], backgroundColor: colors[0], borderWidth: 2, pointRadius: trend.length > 20 ? 2 : 3, tension: 0.15 }],
      }} options={{ scales: { y: { beginAtZero: true, ticks: { precision: 0, callback: value => Number(value).toLocaleString('vi-VN', { notation: 'compact' }) }, grid: { color: '#eee9e0' } }, x: { grid: { display: false }, ticks: { maxTicksLimit: 7, maxRotation: 0 } } },
        plugins: { tooltip: { callbacks: { title: items => rangeLabel(trend[items[0].dataIndex]), label: item => format(item.raw, metric) } } } }} /></div>
      <details className="analytics-data"><summary>Xem số liệu biểu đồ</summary><div className="table-scroll"><table><caption>{labels[metric]} theo kỳ</caption><thead><tr><th>Kỳ (UTC)</th><th>{labels[metric]}</th></tr></thead>
        <tbody>{trend.map(row => <tr key={row.startDate}><td>{rangeLabel(row)}</td><td>{format(row[metric], metric)}</td></tr>)}</tbody></table></div></details>
    </section>
    <section className="analytics-panel" aria-labelledby="mix-title"><div className="analytics-panel-heading"><div><h2 id="mix-title">Cơ cấu bán hàng</h2><p>{data.filters.categoryId ? 'So sánh sản phẩm trong danh mục' : 'So sánh danh mục gốc'}</p></div>
      <label>Cơ cấu<select aria-label="Cơ cấu" value={mixMetric} onChange={e => setMixMetric(e.target.value)}><option value="revenue">Doanh thu</option><option value="unitsSold">Số lượng bán</option></select></label></div>
      {slices.length ? <><div className="analytics-donut"><CanvasChart type="doughnut" label={`Cơ cấu ${labels[mixMetric].toLowerCase()}; dùng các nút chú giải bên dưới để chọn`} data={{
        labels: slices.map(s => s.name), datasets: [{ data: slices.map(s => s[mixMetric]),
          backgroundColor: slices.map((s, index) => colors[index % colors.length] + (selected && s.id !== selected ? '70' : '')),
          borderColor: slices.map(s => s.id === selected ? '#173f32' : '#fffdf7'), borderWidth: slices.map(s => s.id === selected ? 3 : 2), offset: slices.map(s => s.id === selected ? 8 : 0) }],
      }} options={{ cutout: '68%', layout: { padding: 10 }, onClick: (_event, elements) => { if (elements.length) onSelect(slices[elements[0].index]); },
        onHover: (event, elements) => { if (event.native?.target) event.native.target.style.cursor = elements.length ? 'pointer' : 'default'; },
        plugins: { tooltip: { callbacks: { label: item => `${format(item.raw, mixMetric)} · ${(item.raw / total * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%` } } } }} /></div>
        <ul className="analytics-legend">{slices.map((slice, index) => <li key={slice.id}><button type="button"
          aria-label={`${slice.name} · ${format(slice[mixMetric], mixMetric)}${slice.type === 'product' && slice.id === selected ? ' · Đang chọn' : ''}`}
          aria-pressed={slice.type === 'product' ? slice.id === selected : undefined} onClick={() => onSelect(slice)}>
          <span className="analytics-swatch" style={{ backgroundColor: colors[index % colors.length] }} /><span>{slice.name}{slice.type === 'product' && slice.id === selected && <strong> · Đang chọn</strong>}</span>
          <span>{format(slice[mixMetric], mixMetric)}<small>{(slice[mixMetric] / total * 100).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}%</small></span></button></li>)}</ul>
      </> : <p className="analytics-empty">Chưa có dữ liệu cơ cấu cho chỉ số này.</p>}
    </section>
  </div>;
}
