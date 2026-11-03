import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import useApiData from '../hooks/useApiData';
import { apiError, getSessionToken } from '../auth/session';
import { useEngagementSession } from './session';
export default function ProductQuestions({ productId }) {
  const token=useEngagementSession();
  return <Questions key={`${productId}:${token}`} productId={productId} token={token} />;
}
function Questions({ productId, token }) {
  const [page,setPage]=useState(1), [version,setVersion]=useState(0), [content,setContent]=useState(''), [busy,setBusy]=useState(false), [error,setError]=useState('');
  const lock=useRef(false);
  const result=useApiData(`/products/${productId}/questions?page=${page}&v=${version}`);
  async function ask(event) {
    event.preventDefault(); if(lock.current) return;
    if(!content.trim() || content.length>2000) {setError('Vui lòng nhập câu hỏi tối đa 2.000 ký tự.');return;}
    lock.current=true;setBusy(true);setError('');
    try {await api.post(`/products/${productId}/questions`,{content});
      if(token===getSessionToken()){setContent('');setPage(1);setVersion(v=>v+1);}
    } catch(err){if(token===getSessionToken())setError(apiError(err,'Không thể gửi câu hỏi.'));}
    finally{lock.current=false;setBusy(false);}
  }
  return <section className="engagement-section"><h2>Hỏi đáp về sản phẩm</h2>
    {!token ? <Link to="/login">Đăng nhập để đặt câu hỏi</Link> : localStorage.getItem('role')==='Customer' && <form noValidate onSubmit={ask} className="review-form">
      <div><label htmlFor="product-question">Câu hỏi</label><textarea id="product-question" maxLength={2000} value={content} disabled={busy} aria-invalid={!!error} aria-describedby={error?'question-error':undefined} onChange={e=>{setContent(e.target.value);setError('');}} /></div>
      {error&&<p role="alert" id="question-error">{error}</p>}<button className="btn btn-primary" disabled={busy}>{busy?'Đang gửi…':'Gửi câu hỏi'}</button></form>}
    {result.loading?<p role="status">Đang tải hỏi đáp…</p>:result.error?<p role="alert">{result.error}</p>:<>
      {!result.data?.items.length&&<p>Chưa có câu hỏi.</p>}
      {result.data?.items.map(q=><article className="review-card" key={q.id}><strong>{q.customerName}</strong><p className="review-content">{q.content}</p><small>{new Date(q.createdAt).toLocaleDateString('vi-VN')}</small>
        {q.answer?<div className="question-answer"><strong>Gem Aurelia trả lời</strong><p className="review-content">{q.answer.content}</p><small>{new Date(q.answer.updatedAt||q.answer.createdAt).toLocaleDateString('vi-VN')}</small></div>:<p>Chưa có phản hồi</p>}</article>)}
      <div className="review-pagination"><button disabled={page===1} onClick={()=>setPage(p=>p-1)}>Trước</button><span>Trang {page}</span><button disabled={page*10>=(result.data?.total||0)} onClick={()=>setPage(p=>p+1)}>Sau</button></div></>}
  </section>;
}
