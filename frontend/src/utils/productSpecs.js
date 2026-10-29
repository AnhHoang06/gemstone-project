// Spec rows shown in the product-card overlay. Works with catalog, wishlist and detail DTOs; older APIs may omit
// color/clarity/cut/certificate fields, so every row is optional and blank values are dropped.
function text(value) {
  return value == null ? '' : String(value).trim();
}

export function getProductSpecs(product) {
  const carat = text(product?.carat);
  return [
    ['Carat', carat && `${carat} ct`],
    ['Màu sắc', text(product?.color)],
    ['Độ tinh khiết', text(product?.clarity)],
    ['Giác cắt', text(product?.cut)],
    ['Xuất xứ', text(product?.origin)],
    ['Kiểm định', text(product?.certificateAuthority) || text(product?.certificate?.authority)],
  ].filter(([, value]) => value);
}
