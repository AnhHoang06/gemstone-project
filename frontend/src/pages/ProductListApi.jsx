import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { resolveImageUrl } from "../api/api";
import "../styles/products.css";

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
        fetchProducts({});
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const getThumbnail = (product) => {
        if (!product.images || product.images.length === 0) return null;
        const primary = product.images.find((img) => img.isPrimary);
        return resolveImageUrl(primary ? primary.imageUrl : product.images[0].imageUrl);
    };

    return (
        <div className="gs-page">
            <div className="gs-header">
                <h1>Bộ sưu tập đá quý</h1>
                <p>Chọn lọc từ ruby, sapphire, emerald đến kim cương tự nhiên</p>
            </div>

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

                <div className="col-md-3">
                    <label htmlFor="gem-category">Danh mục</label>
                    <select
                        id="gem-category"
                        className="form-select"
                        value={categoryId}
                        onChange={(e) => setCategoryId(e.target.value)}
                    >
                        <option value="">Tất cả danh mục</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="col-md-2">
                    <label htmlFor="gem-min">Giá từ (₫)</label>
                    <input
                        id="gem-min"
                        type="number"
                        className="form-control"
                        placeholder="Giá từ"
                        value={minPrice}
                        onChange={(e) => setMinPrice(e.target.value)}
                    />
                </div>

                <div className="col-md-2">
                    <label htmlFor="gem-max">Giá đến (₫)</label>
                    <input
                        id="gem-max"
                        type="number"
                        className="form-control"
                        placeholder="Giá đến"
                        value={maxPrice}
                        onChange={(e) => setMaxPrice(e.target.value)}
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

            <div className="gs-grid">
                {loading ? (
                    <p className="gs-empty-state">Đang tải...</p>
                ) : products.length === 0 ? (
                    <p className="gs-empty-state">Không tìm thấy sản phẩm nào.</p>
                ) : (
                    <div className="row row-cols-1 row-cols-md-3 g-4">
                        {products.map((product) => (
                            <div className="col" key={product.id}>
                                <Link to={`/products/${product.id}`} className="gs-card">
                                    {getThumbnail(product) ? (
                                        <img
                                            src={getThumbnail(product)}
                                            className="gs-card-image"
                                            alt={product.name}
                                        />
                                    ) : (
                                        <div className="gs-card-image-placeholder">Chưa có ảnh</div>
                                    )}
                                    <div className="gs-card-body">
                                        <p className="gs-card-category">{product.categoryName}</p>
                                        <h3 className="gs-card-name">{product.name}</h3>
                                        <p className="gs-card-meta">{[product.carat != null ? `${product.carat} ct` : null, product.origin].filter(Boolean).join(" · ")}</p>
                                        <p className="gs-card-price">
                                            {product.price.toLocaleString("vi-VN")} đ
                                        </p>
                                    </div>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default ProductListApi;
