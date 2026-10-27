import { useEffect, useState } from "react";
import api from "../api/api";
import "../styles/products.css";
import ProductCard from "../components/ProductCard";
import PriceRangeFilter from "../components/PriceRangeFilter";
import CategorySidebar from "../components/CategorySidebar";
import { storefrontProduct } from "../utils/catalog";

function ProductListApi() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);

    const [search, setSearch] = useState("");
    const [categoryId, setCategoryId] = useState("");
    const [minPrice, setMinPrice] = useState("");
    const [maxPrice, setMaxPrice] = useState("");

    useEffect(() => {
        api.get("/categories")
            .then((res) => setCategories(res.data))
            .catch((err) => console.error(err));
    }, []);

    const fetchProducts = (overrideParams) => {
        setLoading(true);

        const params = overrideParams ?? {
            ...(search && { search }),
            ...(categoryId && { categoryId }),
            ...(minPrice && { minPrice }),
            ...(maxPrice && { maxPrice }),
        };

        api.get("/products", { params })
            .then((res) => setProducts(res.data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        api.get("/products", { params: {} })
            .then((res) => setProducts(res.data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    const handleSubmit = (e) => {
        e.preventDefault();
        fetchProducts();
    };

    const handleReset = () => {
        setSearch("");
        setCategoryId("");
        setMinPrice("");
        setMaxPrice("");
        fetchProducts({});
    };

    return (
        <div className="gs-page">
            <div className="gs-header">
                <h1>Bộ sưu tập đá quý</h1>
                <p>Chọn lọc từ ruby, sapphire, emerald đến kim cương tự nhiên</p>
            </div>

            <div className="container catalog-layout">
            <CategorySidebar categories={categories} value={categoryId} onChange={setCategoryId} byId>
              <PriceRangeFilter minPrice={minPrice} maxPrice={maxPrice} onMinChange={setMinPrice}
                onMaxChange={setMaxPrice} onSubmit={handleSubmit} disabled={loading} />
            </CategorySidebar>
            <div className="catalog-main">
            <form className="gs-filters row g-3 align-items-end" onSubmit={handleSubmit}>
                <div className="col-md-4">
                    <label htmlFor="gem-search">Tên đá quý</label>
                    <input
                        id="gem-search"
                        type="text"
                        className="form-control"
                        placeholder="Tìm theo tên sản phẩm..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>

                <div className="col-md-1 d-grid">
                    <button type="submit" className="gs-btn-gold">
                        Lọc
                    </button>
                </div>

                <div className="col-12">
                    <button type="button" className="gs-link-reset" onClick={handleReset}>
                        Xóa bộ lọc
                    </button>
                </div>
            </form>

            {!loading && <div className="shop-toolbar"><span>{products.length} sản phẩm phù hợp</span></div>}
            <div className="gs-grid">
                {loading ? (
                    <p className="gs-empty-state">Đang tải...</p>
                ) : products.length === 0 ? (
                    <div className="gs-empty-state"><p>Không tìm thấy sản phẩm nào.</p><button type="button" className="btn btn-outline catalog-reset" onClick={handleReset}>Xem tất cả đá quý</button></div>
                ) : (
                    <div className="product-grid">
                        {products.map(product => <ProductCard key={product.id} product={storefrontProduct(product)} detailPath={`/products/${product.id}`} />)}
                    </div>
                )}
            </div>
            </div>
            </div>
        </div>
    );
}

export default ProductListApi;
