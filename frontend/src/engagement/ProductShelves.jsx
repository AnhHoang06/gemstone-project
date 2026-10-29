import { useEffect, useState } from 'react';
import { useEngagementSession } from './session';
import api from '../api/api';
import useApiData from '../hooks/useApiData';
import ProductCard from '../components/ProductCard';
import { getSessionToken } from '../auth/session';
import { recordRecent } from './recent';
const key='gem-aurelia:recent-products';
function Grid({ products }) {return <div className="engagement-products">{products.map(p=><ProductCard key={p.id} product={p} />)}</div>;}
export function RelatedProducts({ productId }) {
  const result=useApiData(`/products/${productId}/related`);
  return <section className="engagement-section"><h2>Sản phẩm liên quan</h2>{result.loading?<p role="status">Đang tải…</p>:result.error?<p role="alert">{result.error}</p>:result.data?.length?<Grid products={result.data} />:<p>Chưa có sản phẩm liên quan.</p>}</section>;
}
export function TopRatedProducts() {
  const result=useApiData('/products/top-rated');
  return <section className="engagement-section"><h2>Được khách hàng đánh giá cao</h2><p>Ít nhất 3 đánh giá công khai mỗi sản phẩm.</p>
    {result.loading?<p role="status">Đang tải…</p>:result.error?<p role="alert">{result.error}</p>:result.data?.length?<div className="engagement-products">{result.data.map(r=><div key={r.product.id}><p>{r.averageRating.toFixed(1)} ★ · {r.reviewCount} đánh giá</p><ProductCard product={r.product} /></div>)}</div>:<p>Chưa đủ đánh giá để xếp hạng sản phẩm.</p>}</section>;
}
export function RecentlyViewed({ productId }) {
  const token=useEngagementSession();
  return <Recent key={`${productId}:${token}`} productId={productId} token={token} />;
}
function Recent({ productId, token }) {
  const [result,setResult]=useState({loading:true,items:[],error:''});
  useEffect(()=>{
    let active=true;
    const ids=recordRecent(Number(productId));
    api.get(`/products/recent?ids=${ids.join(',')}`).then(({data})=>{
      if(!active||token!==getSessionToken())return;
      try{localStorage.setItem(key,JSON.stringify(data.map(p=>p.id)));}catch{/* Optional local history. */}
      setResult({loading:false,items:data.filter(p=>p.id!==Number(productId)),error:''});
    }).catch(()=>{if(active&&token===getSessionToken())setResult({loading:false,items:[],error:'Không thể tải sản phẩm đã xem.'});});
    return()=>{active=false;};
  },[productId,token]);
  return <section className="engagement-section"><h2>Sản phẩm đã xem gần đây</h2>{result.loading?<p role="status">Đang tải…</p>:result.error?<p role="alert">{result.error}</p>:result.items.length?<Grid products={result.items} />:<p>Chưa có sản phẩm khác trong lịch sử xem trên trình duyệt này.</p>}</section>;
}
export function LowStock({ stock }) {return stock>0&&stock<=3?<span className="product-stock-label">Còn {stock} sản phẩm</span>:null;}
