// Presentation adapter for the existing storefront; API field names stay unchanged.
export function storefrontProduct(product) {
  return {
    ...product,
    type: product.categoryName,
    certification: product.certificate
      ? `${product.certificate.authority} · ${product.certificate.certificateNumber}`
      : "Chưa có thông tin chứng nhận",
    imageUrl: product.images?.find((image) => image.isPrimary)?.imageUrl || product.images?.[0]?.imageUrl || product.imageUrl,
  };
}
