import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api, { resolveImageUrl } from "../../api/api";
import "../../styles/admin.css";

function AdminProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);

    function loadProducts() {
        setLoading(true);
        api.get("/products")
            .then((res) => setProducts(res.data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadProducts();
    }, []);

    async function handleDelete(id, name) {
        if (!window.confirm(`Xóa sản phẩm "${name}"? Không thể hoàn tác.`)) return;
        try {
            await api.delete(`/products/${id}`);
            loadProducts();
        } catch (err) {
            alert(err.response?.data?.message || "Không thể xóa sản phẩm này.");
        }
    }

    return (
        <div className="admin-page">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h1>Quản lý sản phẩm</h1>
                <Link to="/admin/products/create" className="btn btn-primary">
                    + Thêm sản phẩm
                </Link>
            </div>

            {loading ? (
                <p>Đang tải...</p>
            ) : products.length === 0 ? (
                <p>Chưa có sản phẩm nào.</p>
            ) : (
                <table className="admin-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Tên sản phẩm</th>
                            <th>Danh mục</th>
                            <th>Giá</th>
                            <th>Tồn kho</th>
                            <th>Trạng thái</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {products.map((p) => {
                            const primaryImage =
                                p.images?.find((img) => img.isPrimary)?.imageUrl ||
                                p.images?.[0]?.imageUrl;
                            return (
                                <tr key={p.id}>
                                    <td>
                                        {primaryImage ? (
                                            <img
                                                className="admin-table-thumb"
                                                src={resolveImageUrl(primaryImage)}
                                                alt={p.name}
                                            />
                                        ) : (
                                            <div className="admin-table-thumb" />
                                        )}
                                    </td>
                                    <td>{p.name}</td>
                                    <td>{p.categoryName}</td>
                                    <td>{p.price?.toLocaleString("vi-VN")}₫</td>
                                    <td>{p.stock}</td>
                                    <td>
                                        <span className={p.isActive ? "badge badge-active" : "badge badge-inactive"}>
                                            {p.isActive ? "Đang bán" : "Ẩn"}
                                        </span>
                                    </td>
                                    <td className="admin-table-actions">
                                        <Link to={`/admin/products/edit/${p.id}`} className="btn btn-sm btn-outline">
                                            Sửa
                                        </Link>
                                        <button
                                            className="btn btn-sm btn-danger"
                                            onClick={() => handleDelete(p.id, p.name)}
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default AdminProducts;
