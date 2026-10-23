import { useEffect, useState } from "react";
import api from "../../api/api";
import "../../styles/admin.css";

const emptyForm = { name: "", description: "", isActive: true };

function AdminCategories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null); // null = đang thêm mới, có id = đang sửa

    function loadCategories() {
        setLoading(true);
        api.get("/categories")
            .then((res) => setCategories(res.data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        api.get("/categories")
            .then((res) => setCategories(res.data))
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    function startEdit(category) {
        setEditingId(category.id);
        setForm({
            name: category.name,
            description: category.description || "",
            isActive: category.isActive,
        });
        setError("");
    }

    function cancelEdit() {
        setEditingId(null);
        setForm(emptyForm);
        setError("");
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!form.name.trim()) {
            setError("Vui lòng nhập tên danh mục.");
            return;
        }

        try {
            if (editingId) {
                await api.put(`/categories/${editingId}`, form);
            } else {
                await api.post("/categories", form);
            }
            cancelEdit();
            loadCategories();
        } catch (err) {
            setError(err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.");
        }
    }

    async function handleDelete(id) {
        if (!window.confirm("Xóa danh mục này? Không thể hoàn tác.")) return;
        try {
            await api.delete(`/categories/${id}`);
            loadCategories();
        } catch (err) {
            alert(err.response?.data?.message || "Không thể xóa danh mục này.");
        }
    }

    return (
        <div className="admin-page">
            <h1>Quản lý danh mục</h1>

            <form id="category-edit-form" className="admin-form" onSubmit={handleSubmit}>
                <h2>{editingId ? "Sửa danh mục" : "Thêm danh mục mới"}</h2>

                {error && <div className="admin-error">{error}</div>}

                <div className="form-row">
                    <label>Tên danh mục</label>
                    <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Ví dụ: Ruby, Sapphire..."
                    />
                </div>

                <div className="form-row">
                    <label>Mô tả</label>
                    <textarea
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={2}
                    />
                </div>

                <div className="form-row form-row-checkbox">
                    <label>
                        <input
                            type="checkbox"
                            name="isActive"
                            checked={form.isActive}
                            onChange={handleChange}
                        />
                        Đang hoạt động (hiển thị cho khách hàng)
                    </label>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary">
                        {editingId ? "Cập nhật" : "Thêm danh mục"}
                    </button>
                    {editingId && (
                        <button type="button" className="btn btn-outline" onClick={cancelEdit}>
                            Hủy
                        </button>
                    )}
                </div>
            </form>

            <h2>Danh sách danh mục</h2>

            {loading ? (
                <p className="empty-state" role="status">Đang tải...</p>
            ) : categories.length === 0 ? (
                <p className="empty-state">Chưa có danh mục nào.</p>
            ) : (
                <div className="table-scroll" tabIndex={0} aria-label="Bảng quản lý"><table className="admin-table">
                    <thead>
                        <tr>
                            <th>Tên</th>
                            <th>Mô tả</th>
                            <th>Trạng thái</th>
                            <th><span className="visually-hidden">Thao tác hoặc ảnh</span></th>
                        </tr>
                    </thead>
                    <tbody>
                        {categories.map((c) => (
                            <tr key={c.id} className="category-edit-row" tabIndex={0}
                                aria-label={`Sửa danh mục ${c.name}`} aria-selected={editingId === c.id}
                                aria-controls="category-edit-form" aria-keyshortcuts="Enter Space"
                                onClick={(event) => {
                                    if (event.defaultPrevented || event.target.closest('a, button, input, select, textarea, [role="button"]')) return;
                                    startEdit(c);
                                }}
                                onKeyDown={(event) => {
                                    if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
                                    event.preventDefault();
                                    startEdit(c);
                                }}>
                                <td>{c.name}</td>
                                <td>{c.description}</td>
                                <td>
                                    <span className={c.isActive ? "badge badge-active" : "badge badge-inactive"}>
                                        {c.isActive ? "Hoạt động" : "Ẩn"}
                                    </span>
                                </td>
                                <td className="admin-table-actions">
                                    <button className="btn btn-sm btn-danger" onClick={(event) => { event.stopPropagation(); handleDelete(c.id); }}>
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            )}
        </div>
    );
}

export default AdminCategories;
