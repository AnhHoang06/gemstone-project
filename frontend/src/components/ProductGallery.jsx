import ProductPlaceholder from "./ProductPlaceholder";
import { useState } from "react";
import { resolveImageUrl } from "../api/api";

export default function ProductGallery({ product }) {
  const images = product.images || [];
  const [selected, setSelected] = useState(null);
  const image = images.find(item => item.imageUrl === selected)?.imageUrl
    || images.find(item => item.isPrimary)?.imageUrl || images[0]?.imageUrl || product.imageUrl;
  return <div className="product-gallery">
    <div className="catalog-detail-image">{image ? <img src={resolveImageUrl(image)} alt={product.name} loading="lazy" decoding="async" /> : <ProductPlaceholder />}</div>
    {images.length > 1 && <div className="gs-thumb-row">{images.map((item, index) =>
      <button type="button" className="gs-thumbnail-button" key={item.id ?? item.imageUrl}
        aria-label={`Xem ảnh ${index + 1} của ${product.name}`} aria-pressed={image === item.imageUrl}
        onClick={() => setSelected(item.imageUrl)}><img className="gs-thumb" src={resolveImageUrl(item.imageUrl)} alt="" loading="lazy" decoding="async" /></button>)}</div>}
  </div>;
}
