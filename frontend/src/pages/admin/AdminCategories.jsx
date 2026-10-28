import { buildCategoryTree, flattenCategories } from "../../utils/categoryTree";
import { useEffect, useRef, useState } from "react";
import api from "../../api/api";
import "../../styles/admin.css";

const emptyForm = { name: "", description: "", isActive: true, parentId: "", sortOrder: 0 };

function AdminCategories() {
    const [busy, setBusy] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [form, setForm] = useState(emptyForm);
    const [editingId, setEditingId] = useState(null); // null = đang thêm mới, có id = đang sửa

    function loadCategories() {
        setLoading(true);
        return api.get("/categories?includeInactive=true")
            .then((res) => setCategories(res.data))
            .catch(() => setError("Không tải được danh mục. Vui lòng thử lại."))
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        api.get("/categories?includeInactive=true")
            .then((res) => setCategories(res.data))
            .catch(() => setError("Không tải được danh mục. Vui lòng thử lại."))
            .finally(() => setLoading(false));
    }, []);

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    function startEdit(category) {
        if (busy) return;
        setEditingId(category.id);
        setForm({
            name: category.name,
            description: category.description || "",
            isActive: category.isActive,
            parentId: category.parentId ?? "",
            sortOrder: category.sortOrder ?? 0,
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
        if (busy) return;
        setError("");

        if (!form.name.trim()) {
            setError("Vui lòng nhập tên danh mục.");
            return;
        }

        if (!Number.isInteger(Number(form.sortOrder)) || Number(form.sortOrder) < 0 || form.sortOrder === "") { setError("Thứ tự hiển thị phải là số nguyên không âm."); return; }
        setBusy(true);
        const payload = { ...form, parentId: form.parentId === "" ? null : Number(form.parentId), sortOrder: Number(form.sortOrder) };
        try {
            if (editingId) {
                await api.put(`/categories/${editingId}`, payload);
            } else {
                await api.post("/categories", payload);
            }
            cancelEdit();
            await loadCategories();
        } catch (err) {
            setError(err.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại.");
        } finally { setBusy(false); }
    }

    async function handleDelete(id) {
        if (busy) return;
        setBusy(true); setError("");
        try {
            await api.delete(`/categories/${id}`);
            setDeleting(null);
            if (editingId === id) cancelEdit();
            loadCategories();
        } catch (err) {
            setError(err.response?.data?.message || "Không thể xóa danh mục này.");
        } finally { setBusy(false); }
    }

    const rows = flattenCategories(buildCategoryTree(categories));
    const parents = rows.filter(c => c.depth < 2 && !c.path.some(node => node.id === editingId));
    return (
        <div className="admin-page category-admin-page">
            <h1>Quản lý danh mục</h1>

            <form id="category-edit-form" className="admin-form" noValidate onSubmit={handleSubmit}>
                <h2>{editingId ? "Sửa danh mục" : "Thêm danh mục mới"}</h2>

                {error && <div className="admin-error" role="alert">{error}</div>}

                <div className="form-row">
                    <label htmlFor="category-name">Tên danh mục</label>
                    <input
                        id="category-name" maxLength={100} required
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleChange}
                        placeholder="Ví dụ: Ruby, Sapphire..."
                    />
                </div>

                <div className="form-row">
                    <label htmlFor="category-description">Mô tả</label>
                    <textarea id="category-description" maxLength={500}
                        name="description"
                        value={form.description}
                        onChange={handleChange}
                        rows={2}
                    />
                </div>

                <div className="form-row"><label htmlFor="category-parent">Danh mục cha</label><select id="category-parent" name="parentId" value={form.parentId} onChange={handleChange}><option value="">Không có (cấp 1)</option>{parents.map(c => <option key={c.id} value={c.id}>{"— ".repeat(c.depth)}{c.name}{!c.isActive ? " (Ẩn)" : ""}</option>)}</select></div>
                <div className="form-row"><label htmlFor="category-sort">Thứ tự hiển thị</label><input id="category-sort" type="number" min="0" step="1" name="sortOrder" value={form.sortOrder} onChange={handleChange} required /></div>
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
                    <button disabled={busy} type="submit" className="btn btn-primary">
                        {editingId ? "Cập nhật" : "Thêm danh mục"}
                    </button>
                    {editingId && (
                        <button disabled={busy} type="button" className="btn btn-outline" onClick={cancelEdit}>
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
                        {rows.map((c) => (
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
                                <td><span style={{ paddingInlineStart: `${c.depth * 16}px` }}>{c.depth > 0 ? "↳ " : ""}{c.name}</span></td>
                                <td>{c.description}</td>
                                <td>
                                    <span className={c.isActive ? "badge badge-active" : "badge badge-inactive"}>
                                        {c.isActive ? "Hoạt động" : "Ẩn"}
                                    </span>
                                </td>
                                <td className="admin-table-actions">
                                    <button disabled={busy} className="btn btn-sm btn-danger" onClick={(event) => { event.stopPropagation(); setError(""); setDeleting(c); }}>
                                        Xóa
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table></div>
            )}
            {deleting && <DeleteCategoryDialog category={deleting} busy={busy} error={error} onClose={() => setDeleting(null)} onConfirm={() => handleDelete(deleting.id)} />}
        </div>
    );
}

export default AdminCategories;

function DeleteCategoryDialog({ category, busy, error, onClose, onConfirm }) {
    const ref = useRef(null);
    useEffect(() => { const dialog = ref.current, previous = document.activeElement; dialog.showModal(); return () => { dialog.close(); if (previous?.isConnected) previous.focus(); }; }, []);
    return <dialog ref={ref} className="admin-delete-dialog" aria-labelledby="category-delete-title" onCancel={e => { e.preventDefault(); if (!busy) onClose(); }}><h2 id="category-delete-title">Xóa danh mục?</h2><p>{category.name}</p><p>Không thể xóa danh mục còn danh mục con hoặc sản phẩm.</p>{error && <p role="alert" className="admin-error">{error}</p>}<div className="admin-delete-actions"><button className="btn btn-outline" disabled={busy} onClick={onClose}>Hủy</button><button className="btn btn-danger" disabled={busy} onClick={onConfirm}>{busy ? 'Đang xóa…' : 'Xóa'}</button></div></dialog>;
}
