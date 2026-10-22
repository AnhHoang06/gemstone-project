import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import api, { resolveImageUrl } from "../../api/api";
import ProductDeleteDialog from "../../components/ProductDeleteDialog";
import "../../styles/admin.css";

function AdminProducts() {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pendingDelete, setPendingDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState("");
    const deletingRef = useRef(false);
    const headingRef = useRef(null);

    useEffect(() => {
        let active = true;
        api.get("/products")
            .then((res) => { if (active) setProducts(res.data); })
            .catch((err) => console.error(err))
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, []);

    function cancelDelete() {
        if (deletingRef.current) return;
        setPendingDelete(null);
        setDeleteError("");
    }

    async function handleDelete() {
        if (!pendingDelete || deletingRef.current) return;
        const id = pendingDelete.id;
        deletingRef.current = true;
        setDeleting(true);
        setDeleteError("");
        try {
            await api.delete(`/products/${id}`);
            setProducts((previous) => previous.filter((product) => product.id !== id));
            setPendingDelete(null);
        } catch (err) {
            setDeleteError(err.response?.data?.message || "Không thể xóa sản phẩm này. Vui lòng thử lại.");
        } finally {
            deletingRef.current = false;
            setDeleting(false);
        }
    }

    return (
        <div className="admin-page">
            <div className="admin-page-heading">
                <h1 ref={headingRef} tabIndex={-1}>Quản lý sản phẩm</h1>
                <Link to="/admin/products/create" className="btn btn-primary">
                    + Thêm sản phẩm
                </Link>
            </div>

            {loading ? (
                <p className="empty-state" role="status">Đang tải...</p>
            ) : products.length === 0 ? (
                <p className="empty-state">Chưa có sản phẩm nào.</p>
            ) : (
                <div className="table-scroll" tabIndex={0} aria-label="Bảng quản lý"><table className="admin-table">
                    <thead>
                        <tr>
                            <th><span className="visually-hidden">Thao tác hoặc ảnh</span></th>
                            <th>Tên sản phẩm</th>
                            <th>Danh mục</th>
                            <th>Giá</th>
                            <th>Tồn kho</th>
                            <th>Trạng thái</th>
                            <th><span className="visually-hidden">Thao tác hoặc ảnh</span></th>
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
                                            onClick={() => { setDeleteError(""); setPendingDelete(p); }}
                                        >
                                            Xóa
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table></div>
            )}
            {pendingDelete && <ProductDeleteDialog product={pendingDelete} deleting={deleting}
                error={deleteError} onCancel={cancelDelete} onConfirm={handleDelete} fallbackFocus={headingRef} />}
        </div>
    );
}

export default AdminProducts;
