import { useEffect, useState } from 'react';
import api from '../api/api';
export default function ReviewImage({ image }) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let active = true, url;
    api.get(`/review-images/${image.id}`, { responseType: 'blob' }).then(({ data }) => {
      if (active) { url = URL.createObjectURL(data); setSrc(url); }
    }).catch(() => { /* Hidden/removed images intentionally have no public fallback URL. */ });
    return () => { active = false; if (url) URL.revokeObjectURL(url); };
  }, [image.id]);
  return src ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt="Ảnh đánh giá của khách hàng" /></a> : <span>Ảnh không khả dụng</span>;
}
