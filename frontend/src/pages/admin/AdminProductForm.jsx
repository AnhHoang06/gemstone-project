import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import api, { resolveImageUrl } from "../../api/api";
import "../../styles/admin.css";

const emptyForm = {
    categoryId: "",
    name: "",
    description: "",
    price: "",
    stock: "",
    carat: "",
    color: "",
    clarity: "",
    cut: "",
    origin: "",
    isActive: true,
};

const emptyCertificate = {
    certificateNumber: "",
    authority: "",
    issueDate: "",
    certificateUrl: "",
    notes: "",
};

function AdminProductForm() {
    const { id } = useParams(); // có id -> đang sửa, không có -> đang thêm mới
    const isEditing = Boolean(id);
    const navigate = useNavigate();

    const [categories, setCategories] = useState([]);
    const [form, setForm] = useState(emptyForm);
    const [images, setImages] = useState([]); // ảnh đã lưu trên server (chỉ có khi sửa)
    const [newFiles, setNewFiles] = useState([]); // file mới chọn, chưa upload
    const [certificate, setCertificate] = useState(emptyCertificate);
    const [hasCertificate, setHasCertificate] = useState(false); // sản phẩm đã có chứng nhận trên server chưa
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        api.get("/categories")
            .then((res) => setCategories(res.data))
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        if (!isEditing) return;
        api.get(`/products/${id}`, { params: { includeInactive: true } })
            .then((res) => {
                const p = res.data;
                setForm({
                    categoryId: p.categoryId,
                    name: p.name,
                    description: p.description || "",
                    price: p.price,
                    stock: p.stock,
                    carat: p.carat ?? "",
                    color: p.color || "",
                    clarity: p.clarity || "",
                    cut: p.cut || "",
                    origin: p.origin || "",
                    isActive: p.isActive,
                });
                setImages(p.images || []);
                if (p.certificate) {
                    setCertificate({
                        certificateNumber: p.certificate.certificateNumber || "",
                        authority: p.certificate.authority || "",
                        issueDate: p.certificate.issueDate || "",
                        certificateUrl: p.certificate.certificateUrl || "",
                        notes: p.certificate.notes || "",
                    });
                    setHasCertificate(true);
                }
            })
            .catch((err) => console.error(err))
            .finally(() => setLoading(false));
    }, [id, isEditing]);

    function handleChange(e) {
        const { name, value, type, checked } = e.target;
        setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
    }

    function handleCertificateChange(e) {
        const { name, value } = e.target;
        setCertificate((prev) => ({ ...prev, [name]: value }));
    }

    function handleFilesSelected(e) {
        setNewFiles(Array.from(e.target.files));
    }

    // Upload ảnh mới chọn lên server — dùng cho cả 2 trường hợp thêm mới (sau khi tạo sản phẩm) và sửa
    async function uploadNewFiles(productId) {
        if (newFiles.length === 0) return;
        const formData = new FormData();
        newFiles.forEach((file) => formData.append("files", file));
        await api.post(`/products/${productId}/images`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        setNewFiles([]);
    }

    async function handleDeleteImage(imageId) {
        if (!window.confirm("Xóa ảnh này?")) return;
        try {
            await api.delete(`/products/${id}/images/${imageId}`);
            setImages((prev) => prev.filter((img) => img.id !== imageId));
        } catch (err) {
            alert(err.response?.data?.message || "Không thể xóa ảnh.");
        }
    }

    async function handleSetPrimary(imageId) {
        try {
            await api.put(`/products/${id}/images/${imageId}/set-primary`);
            setImages((prev) => prev.map((img) => ({ ...img, isPrimary: img.id === imageId })));
        } catch (err) {
            alert(err.response?.data?.message || "Không thể đặt ảnh đại diện.");
        }
    }

    // Lưu chứng nhận — chỉ gọi khi admin có nhập ít nhất số hiệu + đơn vị cấp (certificate là tùy chọn)
    async function saveCertificate(productId) {
        const hasInput = certificate.certificateNumber.trim() || certificate.authority.trim();
        if (!hasInput) return;

        if (!certificate.certificateNumber.trim() || !certificate.authority.trim()) {
            throw new Error("Đã nhập chứng nhận thì cần đủ Số hiệu và Đơn vị cấp.");
        }

        await api.put(`/products/${productId}/certificate`, {
            certificateNumber: certificate.certificateNumber.trim(),
            authority: certificate.authority.trim(),
            issueDate: certificate.issueDate || null,
            certificateUrl: certificate.certificateUrl || null,
            notes: certificate.notes || null,
        });
    }

    async function handleDeleteCertificate() {
        if (!window.confirm("Xóa chứng nhận của sản phẩm này?")) return;
        try {
            await api.delete(`/products/${id}/certificate`);
            setCertificate(emptyCertificate);
            setHasCertificate(false);
        } catch (err) {
            alert(err.response?.data?.message || "Không thể xóa chứng nhận.");
        }
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");

        if (!form.categoryId) {
            setError("Vui lòng chọn danh mục.");
            return;
        }
        if (!form.name.trim()) {
            setError("Vui lòng nhập tên sản phẩm.");
            return;
        }
        if (form.price === "" || Number(form.price) < 0) {
            setError("Giá sản phẩm không hợp lệ.");
            return;
        }

        const payload = {
            categoryId: Number(form.categoryId),
            name: form.name.trim(),
            description: form.description || null,
            price: Number(form.price),
            stock: Number(form.stock) || 0,
            carat: form.carat === "" ? null : Number(form.carat),
            color: form.color || null,
            clarity: form.clarity || null,
            cut: form.cut || null,
            origin: form.origin || null,
            isActive: form.isActive,
        };

        setSaving(true);
        try {
            if (isEditing) {
                await api.put(`/products/${id}`, payload);
                await uploadNewFiles(id);
                await saveCertificate(id);
            } else {
                const res = await api.post("/products", payload);
                const newId = res.data.id;
                await uploadNewFiles(newId);
                await saveCertificate(newId);
            }
            navigate("/admin/products");
        } catch (err) {
            setError(err.response?.data?.message || err.message || "Có lỗi xảy ra, vui lòng thử lại.");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="admin-page">
                <p>Đang tải...</p>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <h1>{isEditing ? "Sửa sản phẩm" : "Thêm sản phẩm mới"}</h1>

            <form className="admin-form" onSubmit={handleSubmit}>
                {error && <div className="admin-error">{error}</div>}

                <div className="form-row">
                    <label>Danh mục</label>
                    <select name="categoryId" value={form.categoryId} onChange={handleChange}>
                        <option value="">-- Chọn danh mục --</option>
                        {categories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-row">
                    <label>Tên sản phẩm</label>
                    <input type="text" name="name" value={form.name} onChange={handleChange} />
                </div>

                <div className="form-row">
                    <label>Mô tả</label>
                    <textarea name="description" value={form.description} onChange={handleChange} rows={3} />
                </div>

                <div className="form-grid-2">
                    <div className="form-row">
                        <label>Giá (₫)</label>
                        <input type="number" name="price" value={form.price} onChange={handleChange} min="0" />
                    </div>
                    <div className="form-row">
                        <label>Tồn kho</label>
                        <input type="number" name="stock" value={form.stock} onChange={handleChange} min="0" />
                    </div>
                </div>

                <div className="form-grid-2">
                    <div className="form-row">
                        <label>Trọng lượng (Carat)</label>
                        <input type="number" step="0.01" name="carat" value={form.carat} onChange={handleChange} />
                    </div>
                    <div className="form-row">
                        <label>Màu sắc</label>
                        <input type="text" name="color" value={form.color} onChange={handleChange} />
                    </div>
                </div>

                <div className="form-grid-2">
                    <div className="form-row">
                        <label>Độ tinh khiết (Clarity)</label>
                        <input type="text" name="clarity" value={form.clarity} onChange={handleChange} />
                    </div>
                    <div className="form-row">
                        <label>Kiểu cắt (Cut)</label>
                        <input type="text" name="cut" value={form.cut} onChange={handleChange} />
                    </div>
                </div>

                <div className="form-row">
                    <label>Xuất xứ</label>
                    <input type="text" name="origin" value={form.origin} onChange={handleChange} />
                </div>

                <div className="form-row form-row-checkbox">
                    <label>
                        <input type="checkbox" name="isActive" checked={form.isActive} onChange={handleChange} />
                        Đang bán (hiển thị cho khách hàng)
                    </label>
                </div>

                {/* ---- Ảnh sản phẩm ---- */}
                <div className="form-row">
                    <label>Ảnh sản phẩm</label>

                    {isEditing && images.length > 0 && (
                        <div className="admin-image-list">
                            {images.map((img) => (
                                <div key={img.id} className={`admin-image-item ${img.isPrimary ? "is-primary" : ""}`}>
                                    {img.isPrimary && <span className="primary-tag">Đại diện</span>}
                                    <img src={resolveImageUrl(img.imageUrl)} alt="" />
                                    <div className="image-actions">
                                        {!img.isPrimary && (
                                            <button type="button" onClick={() => handleSetPrimary(img.id)}>
                                                Đặt đại diện
                                            </button>
                                        )}
                                        <button type="button" onClick={() => handleDeleteImage(img.id)}>
                                            Xóa
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={handleFilesSelected} />
                    {!isEditing && newFiles.length > 0 && (
                        <p style={{ fontSize: "0.8rem", color: "var(--gs-ink-soft)", marginTop: "0.4rem" }}>
                            {newFiles.length} ảnh sẽ được upload sau khi tạo sản phẩm.
                        </p>
                    )}
                    <p style={{ fontSize: "0.78rem", color: "var(--gs-ink-soft)", marginTop: "0.3rem" }}>
                        Chấp nhận jpg, jpeg, png, webp — tối đa 5MB mỗi ảnh.
                    </p>
                </div>

                {/* ---- Chứng nhận (tùy chọn, quan hệ 1-1) ---- */}
                <div className="form-row">
                    <label>
                        Giấy chứng nhận{" "}
                        <span style={{ fontWeight: 400, color: "var(--gs-ink-soft)" }}>(không bắt buộc)</span>
                    </label>

                    <div className="form-grid-2">
                        <div className="form-row">
                            <label>Số hiệu chứng nhận</label>
                            <input
                                type="text"
                                name="certificateNumber"
                                value={certificate.certificateNumber}
                                onChange={handleCertificateChange}
                                placeholder="Ví dụ: GIA-2145789632"
                            />
                        </div>
                        <div className="form-row">
                            <label>Đơn vị cấp</label>
                            <input
                                type="text"
                                name="authority"
                                value={certificate.authority}
                                onChange={handleCertificateChange}
                                placeholder="Ví dụ: GIA, PNJLab..."
                            />
                        </div>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-row">
                            <label>Ngày cấp</label>
                            <input
                                type="date"
                                name="issueDate"
                                value={certificate.issueDate}
                                onChange={handleCertificateChange}
                            />
                        </div>
                        <div className="form-row">
                            <label>Link ảnh/PDF chứng nhận</label>
                            <input
                                type="text"
                                name="certificateUrl"
                                value={certificate.certificateUrl}
                                onChange={handleCertificateChange}
                                placeholder="https://..."
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <label>Ghi chú</label>
                        <textarea
                            name="notes"
                            value={certificate.notes}
                            onChange={handleCertificateChange}
                            rows={2}
                        />
                    </div>

                    {isEditing && hasCertificate && (
                        <button type="button" className="btn btn-sm btn-danger" onClick={handleDeleteCertificate}>
                            Xóa chứng nhận
                        </button>
                    )}
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary" disabled={saving}>
                        {saving ? "Đang lưu..." : isEditing ? "Cập nhật sản phẩm" : "Tạo sản phẩm"}
                    </button>
                    <Link to="/admin/products" className="btn btn-outline">
                        Hủy
                    </Link>
                </div>
            </form>
        </div>
    );
}

export default AdminProductForm;
