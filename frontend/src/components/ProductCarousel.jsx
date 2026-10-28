import { useEffect, useRef, useState } from 'react';
import ProductCard from './ProductCard';

export default function ProductCarousel({ products }) {
  const ref = useRef(null);
  const [bounds, setBounds] = useState({ start: true, end: true });
  useEffect(() => {
    const track = ref.current;
    const update = () => setBounds({ start: track.scrollLeft < 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    const frame = requestAnimationFrame(update);
    const observer = new ResizeObserver(update); observer.observe(track);
    track.addEventListener('scroll', update);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); track.removeEventListener('scroll', update); };
  }, [products]);
  const move = direction => {
    const track = ref.current;
    const card = track.firstElementChild;
    if (!card) return;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0')),
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div className="product-carousel" role="region" aria-roledescription="carousel" aria-label="Sản phẩm nổi bật"
    onKeyDown={event => { if (event.target.closest('input, textarea') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }}>
    {!(bounds.start && bounds.end) && <button className="carousel-prev" aria-label="Sản phẩm trước" disabled={bounds.start} onClick={() => move(-1)}>‹</button>}
    <div className="carousel-track" ref={ref} tabIndex={0}>{products.map(product => <ProductCard key={product.id} product={product} />)}</div>
    {!(bounds.start && bounds.end) && <button className="carousel-next" aria-label="Sản phẩm tiếp theo" disabled={bounds.end} onClick={() => move(1)}>›</button>}
  </div>;
}
