import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import PriceRangeFilter from "../components/PriceRangeFilter";
import CategorySidebar from "../components/CategorySidebar";
import ProductCard from "../components/ProductCard";
import useApiData from "../hooks/useApiData";
import { storefrontProduct } from "../utils/catalog";

function Products() {
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [priceQuery, setPriceQuery] = useState("");
  const catalog = useApiData(`/products${priceQuery ? `?${priceQuery}` : ""}`);
  const categoryList = useApiData("/categories");
  const products = useMemo(() => (catalog.data || []).map(storefrontProduct), [catalog.data]);
  const categories = categoryList.data || [];
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("featured");
  const selectedCategory = searchParams.get("category") || "all";

  const visibleProducts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    const filtered = products.filter((product) => {
      const matchesCategory =
        selectedCategory === "all" || product.type.toLowerCase() === selectedCategory.toLowerCase();
      const matchesSearch = product.name.toLowerCase().includes(normalizedSearch);

      return matchesCategory && matchesSearch;
    });

    return [...filtered].sort((a, b) => {
      if (sortBy === "price-asc") return a.price - b.price;
      if (sortBy === "price-desc") return b.price - a.price;
      if (sortBy === "name-asc") return a.name.localeCompare(b.name);
      return 0;
    });
  }, [products, searchTerm, selectedCategory, sortBy]);

  const handleCategoryChange = (nextCategory) => {

    if (nextCategory === "all") {
      setSearchParams({});
      return;
    }

    setSearchParams({ category: nextCategory });
  };

  function applyPrice(event) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (minPrice !== "") params.set("minPrice", minPrice);
    if (maxPrice !== "") params.set("maxPrice", maxPrice);
    setPriceQuery(params.toString());
  }

  function resetFilters() {
    setSearchParams({});
    setSearchTerm("");
    setSortBy("featured");
    setMinPrice("");
    setMaxPrice("");
    setPriceQuery("");
  }

  return (
    <>
      <section className="page-title">
        <div className="container">
          <h1>Bộ sưu tập đá quý</h1>
          <p>Ruby, Sapphire, Emerald, Diamond và các dòng đá màu hiếm cho trang sức cao cấp và bộ sưu tập cá nhân.</p>
        </div>
      </section>
      <section className="products-section">
        <div className="container catalog-layout">
          <CategorySidebar categories={categories} value={selectedCategory} onChange={handleCategoryChange} loading={categoryList.loading} error={categoryList.error}>
            <PriceRangeFilter minPrice={minPrice} maxPrice={maxPrice} onMinChange={setMinPrice}
              onMaxChange={setMaxPrice} onSubmit={applyPrice} disabled={catalog.loading} />
          </CategorySidebar>
          <div className="catalog-main">
          <div className="catalog-banner"><span className="eyebrow">Gem Aurelia · Bộ sưu tập</span><p>Vẻ đẹp trong từng sắc đá</p><p className="catalog-banner-description">Khám phá những viên đá được tuyển chọn theo màu sắc, carat và nguồn gốc.</p></div>
          <div className="shop-controls" aria-label="Bộ lọc sản phẩm">
            <label>
              Tìm kiếm
              <input
                type="search"
                placeholder="Nhập tên sản phẩm"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label>
            <label>
              Sắp xếp
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} aria-label="Sắp xếp sản phẩm">
                <option value="featured">Mặc định</option>
                <option value="price-asc">Giá thấp đến cao</option>
                <option value="price-desc">Giá cao đến thấp</option>
                <option value="name-asc">Tên A-Z</option>
              </select>
            </label>
          </div>
          <div className="shop-toolbar">
            <span>{catalog.loading ? "Đang tải sản phẩm..." : catalog.error ? catalog.error : `${visibleProducts.length} sản phẩm phù hợp`}</span>
          </div>
          {catalog.loading || catalog.error ? null : visibleProducts.length > 0 ? (
            <div className="product-grid">
              {visibleProducts.map((product) => (
                <ProductCard product={product} key={product.id} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <p>Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.</p>
              <button type="button" className="btn btn-outline catalog-reset" onClick={resetFilters}>Xem tất cả đá quý</button>
            </div>
          )}
          </div>
        </div>
      </section>
    </>
  );
}

export default Products;
