import { useEffect, useRef, useState } from 'react';
import ProductCard from './ProductCard';
import { ChevronIcon } from './Icons';

export default function ProductCarousel({ products }) {
  const ref = useRef(null);
  const [bounds, setBounds] = useState({ start: true, end: true });
  useEffect(() => {
    const track = ref.current;
    const update = () => setBounds({ start: track.scrollLeft < 2, end: track.scrollLeft + track.clientWidth >= track.scrollWidth - 2 });
    const frame = requestAnimationFrame(update);
    // jsdom and old browsers have no ResizeObserver: fall back to window resize.
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(update) : null;
    if (observer) observer.observe(track); else window.addEventListener('resize', update);
    track.addEventListener('scroll', update);
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); window.removeEventListener('resize', update); track.removeEventListener('scroll', update); };
  }, [products]);
  const move = direction => {
    const track = ref.current;
    const card = track.firstElementChild;
    if (!card || typeof track.scrollBy !== 'function') return;
    track.scrollBy({ left: direction * (card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || '0')),
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  };
  return <div className={`product-carousel${bounds.start && bounds.end ? '' : ' has-controls'}`} role="region" aria-roledescription="carousel" aria-label="Sản phẩm nổi bật"
    onKeyDown={event => { if (event.target.closest('input, textarea') || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return; event.preventDefault(); move(event.key === 'ArrowLeft' ? -1 : 1); }}>
    {!(bounds.start && bounds.end) && <button type="button" className="carousel-prev" aria-label="Sản phẩm trước" disabled={bounds.start} onClick={() => move(-1)}><ChevronIcon direction="left" size={16} /></button>}
    <div className="carousel-track" ref={ref} tabIndex={0}>{products.map(product => <ProductCard key={product.id} product={product} variant="compact" />)}</div>
    {!(bounds.start && bounds.end) && <button type="button" className="carousel-next" aria-label="Sản phẩm tiếp theo" disabled={bounds.end} onClick={() => move(1)}><ChevronIcon direction="right" size={16} /></button>}
  </div>;
}
