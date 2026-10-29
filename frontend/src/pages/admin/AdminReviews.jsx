import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../api/api';
import useApiData from '../../hooks/useApiData';
import { apiError, getSessionToken } from '../../auth/session';
import { useEngagementSession } from '../../engagement/session';
import ReviewImage from '../../engagement/ReviewImage';
export default function AdminReviews() {
  const token=useEngagementSession();
  return <Content key={token} token={token}/>;
}
function AnswerForm({question,run,busy}) {
  const [content,setContent]=useState(question.answer?.content||''),[error,setError]=useState('');
  return <form className="review-form" noValidate onSubmit={e=>{e.preventDefault();if(!content.trim()){setError('Vui lòng nhập phản hồi.');return;}run(`/admin/questions/${question.id}/answer`,{content});}}>
    <div><label htmlFor={`answer-${question.id}`}>Phản hồi cho câu hỏi #{question.id}</label><textarea id={`answer-${question.id}`} value={content} maxLength={2000} disabled={busy} aria-invalid={!!error} onChange={e=>{setContent(e.target.value);setError('');}} /></div>
    {error&&<p role="alert">{error}</p>}<button className="btn btn-primary" disabled={busy}>{question.answer?'Cập nhật phản hồi':'Trả lời'}</button></form>;
}
function Content({token}) {
  const [tab,setTab]=useState('reviews'),[search,setSearch]=useState(''),[rating,setRating]=useState(''),[visible,setVisible]=useState(''),[page,setPage]=useState(1),[version,setVersion]=useState(0);
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const lock=useRef(false);
  const result=useApiData(tab==='analytics'?null:`/admin/${tab}?search=${encodeURIComponent(search)}&rating=${rating}&visible=${visible}&page=${page}&v=${version}`);
  const until=to?new Date(new Date(to+'T00:00:00Z').getTime()+86400000).toISOString():'';
  const stats=useApiData(tab==='analytics'?`/admin/reviews/analytics?from=${from}&to=${until}&v=${version}`:null);
  async function run(path,body) {
    if(lock.current)return;lock.current=true;setBusy(true);setError('');
    try{await api.put(path,body);if(token===getSessionToken())setVersion(v=>v+1);}
    catch(err){if(token===getSessionToken())setError(apiError(err,'Không thể cập nhật.'));}
    finally{lock.current=false;setBusy(false);}
  }
  const data=tab==='analytics'?stats:result;
  return <main className="admin-page"><h1>Đánh giá & Hỏi đáp</h1>
    <nav className="review-filters" aria-label="Quản lý tương tác">{[['reviews','Đánh giá'],['questions','Hỏi đáp'],['analytics','Thống kê đánh giá']].map(([value,label])=><button className="btn btn-outline" key={value} aria-pressed={tab===value} onClick={()=>{setTab(value);setPage(1);setError('');}}>{label}</button>)}</nav>
    {tab!=='analytics'?<div className="review-filters"><label>Sản phẩm / khách hàng<input value={search} maxLength={200} onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
      {tab==='reviews'&&<label>Số sao<select value={rating} onChange={e=>{setRating(e.target.value);setPage(1);}}><option value="">Tất cả</option>{[5,4,3,2,1].map(n=><option key={n} value={n}>{n} sao</option>)}</select></label>}
      <label>Hiển thị<select value={visible} onChange={e=>{setVisible(e.target.value);setPage(1);}}><option value="">Tất cả</option><option value="true">Công khai</option><option value="false">Đã ẩn</option></select></label></div>:
      <div className="review-filters"><label>Từ ngày (UTC)<input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến hết ngày (UTC)<input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>}
    <button className="btn btn-outline" disabled={busy||data.loading} onClick={()=>setVersion(v=>v+1)}>Làm mới</button>
    {error&&<p role="alert" className="notice notice-error">{error}</p>}
    {data.loading?<p role="status">Đang tải…</p>:data.error?<p role="alert">{data.error}</p>:tab==='analytics'?<Analytics data={data.data}/>:<>
      {!result.data?.items.length?<p className="empty-state">Chưa có dữ liệu phù hợp.</p>:<div className="table-scroll"><table className="shop-table"><thead><tr><th>Sản phẩm / Khách hàng</th><th>Nội dung</th><th>Thời gian / Hiển thị</th><th>Thao tác</th></tr></thead><tbody>
        {result.data.items.map(r=><tr key={r.id}><td><Link to={`/product/${r.productId}#reviews`}>{r.productName}</Link><p>{r.customerName}</p>{r.verifiedPurchase&&<span className="status-badge">Đã mua hàng</span>}</td>
          <td>{r.rating&&<strong>{r.rating} ★ · {r.helpfulCount} hữu ích</strong>}<p className="review-content">{r.content}</p>
            {r.images&&<div className="review-images">{r.images.map(i=><ReviewImage key={i.id} image={i}/>)}</div>}
            {tab==='questions'&&<AnswerForm key={r.answer?.updatedAt||r.answer?.createdAt||r.id} question={r} run={run} busy={busy}/>}</td>
          <td><small>{new Date(r.createdAt).toLocaleString('vi-VN')}</small><p>{r.isVisible?'Công khai':'Đã ẩn'}</p>{r.moderatedAt&&<small>Duyệt: {new Date(r.moderatedAt).toLocaleString('vi-VN')}</small>}</td>
          <td><button className="btn btn-outline" disabled={busy} onClick={()=>run(`/admin/${tab}/${r.id}/visibility`,{isVisible:!r.isVisible})}>{r.isVisible?'Ẩn':'Khôi phục'}</button></td></tr>)}
      </tbody></table></div>}
      <div className="review-pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Trước</button><span>{result.data?.total||0} kết quả · Trang {page}</span><button disabled={page*20>=(result.data?.total||0)} onClick={()=>setPage(p=>p+1)}>Sau</button></div>
    </>}
  </main>;
}
function Analytics({data}) {
  if(!data)return null;
  return <section className="engagement-section"><h2>Thống kê đánh giá</h2><p>Công khai toàn thời gian: {data.totalVisible} · Đã ẩn: {data.hiddenCount}</p>
    <p>Trong kỳ: {data.periodCount} đánh giá · Trung bình: {data.averageRating.toFixed(2)} / 5</p>
    <ul>{[5,4,3,2,1].map(n=><li key={n}>{n} ★: {data.distribution.find(d=>d.rating===n)?.count||0}</li>)}</ul>
    <p>Xếp hạng cao/thấp yêu cầu ít nhất 3 đánh giá công khai trong kỳ.</p>
    <div className="engagement-products">{[['highest','Điểm cao nhất'],['lowest','Điểm thấp nhất'],['mostReviewed','Nhiều đánh giá nhất']].map(([key,title])=><section key={key}><h3>{title}</h3>{!data[key].length?<p>Chưa đủ dữ liệu.</p>:<ol>{data[key].map(r=><li key={r.productId}><Link to={`/product/${r.productId}#reviews`}>{r.name}</Link><p>{r.average.toFixed(2)} ★ · {r.count} đánh giá</p></li>)}</ol>}</section>)}</div>
    <h3>Đánh giá mới nhất trong kỳ</h3>{data.latest.map(r=><article className="review-card" key={r.id}><strong>{r.productName} · {r.rating} ★</strong><p>{r.customerName}</p><p className="review-content">{r.content}</p></article>)}
  </section>;
}
