import { useId } from "react";

export default function PriceRangeFilter({ minPrice, maxPrice, onMinChange, onMaxChange, onSubmit, disabled }) {
  const id = useId();
  return <form className="catalog-price-filter" onSubmit={onSubmit}>
    <fieldset>
      <legend>Khoảng giá</legend>
      <label htmlFor={`${id}-min`}>Giá từ (₫)</label>
      <input id={`${id}-min`} type="number" min="0" step="any" inputMode="decimal"
        placeholder="Không giới hạn" value={minPrice} onChange={e => onMinChange(e.target.value)} />
      <label htmlFor={`${id}-max`}>Giá đến (₫)</label>
      <input id={`${id}-max`} type="number" min={minPrice || "0"} step="any" inputMode="decimal"
        placeholder="Không giới hạn" value={maxPrice} onChange={e => onMaxChange(e.target.value)} />
    </fieldset>
    <button className="btn btn-outline catalog-filter-apply" type="submit" disabled={disabled}>Lọc</button>
  </form>;
}
