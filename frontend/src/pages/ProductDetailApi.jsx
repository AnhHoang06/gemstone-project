import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api, { resolveImageUrl } from "../api/api";
import "../styles/products.css";

function ProductDetailApi() {
    const { id } = useParams();
    const [product, setProduct] = useState(null);
    const [activeImage, setActiveImage] = useState(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);

    useEffect(() => {
        setLoading(true);
        setNotFound(false);

        api.get(`/products/${id}`)
            .then((res) => {
                setProduct(res.data);
                const primary = res.data.images?.find((img) => img.isPrimary);
                setActiveImage(primary ? primary.imageUrl : res.data.images?.[0]?.imageUrl || null);
            })
            .catch((err) => {
                if (err.response && err.response.status === 404) {
                    setNotFound(true);
                } else {
                    console.error(err);
                }
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="gs-page">
                <p className="gs-empty-state">Đang tải...</p>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="gs-page">
                <div className="gs-detail">
                    <p className="gs-empty-state">Không tìm thấy sản phẩm này.</p>
                    <Link to="/products" className="gs-back-link">
                        ← Quay lại danh sách
                    </Link>
                </div>
            </div>
        );
    }

    if (!product) return null;

    return (
        <div className="gs-page">
            <div className="gs-detail">
                <Link to="/products" className="gs-back-link">
                    ← Quay lại danh sách
                </Link>

                <div className="row g-5">
                    <div className="col-md-6">
                        {activeImage ? (
                            <img src={resolveImageUrl(activeImage)} alt={product.name} className="gs-detail-main-image" />
                        ) : (
                            <div className="gs-card-image-placeholder">Chưa có ảnh</div>
                        )}

                        {product.images && product.images.length > 1 && (
                            <div className="gs-thumb-row">
                                {product.images.map((img) => (
                                    <img
                                        key={img.id}
                                        src={resolveImageUrl(img.imageUrl)}
                                        alt=""
                                        onClick={() => setActiveImage(img.imageUrl)}
                                        className={`gs-thumb ${activeImage === img.imageUrl ? "active" : ""}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="col-md-6">
                        <p className="gs-detail-category">{product.categoryName}</p>
                        <h2 className="gs-detail-name">{product.name}</h2>
                        <p className="gs-detail-price">{product.price.toLocaleString("vi-VN")} đ</p>

                        {product.description && <p className="gs-detail-desc">{product.description}</p>}

                        <table className="gs-spec-table">
                            <tbody>
                                {product.carat != null && (
                                    <tr>
                                        <th>Trọng lượng (Carat)</th>
                                        <td>{product.carat}</td>
                                    </tr>
                                )}
                                {product.color && (
                                    <tr>
                                        <th>Màu sắc</th>
                                        <td>{product.color}</td>
                                    </tr>
                                )}
                                {product.clarity && (
                                    <tr>
                                        <th>Độ tinh khiết (Clarity)</th>
                                        <td>{product.clarity}</td>
                                    </tr>
                                )}
                                {product.cut && (
                                    <tr>
                                        <th>Kiểu cắt (Cut)</th>
                                        <td>{product.cut}</td>
                                    </tr>
                                )}
                                {product.origin && (
                                    <tr>
                                        <th>Xuất xứ</th>
                                        <td>{product.origin}</td>
                                    </tr>
                                )}
                                <tr>
                                    <th>Tình trạng kho</th>
                                    <td>{product.stock > 0 ? `Còn ${product.stock} sản phẩm` : "Hết hàng"}</td>
                                </tr>
                            </tbody>
                        </table>

                        {product.certificate && (
                            <div className="gs-cert-box">
                                <h6>Giấy chứng nhận</h6>
                                <p>Số hiệu: {product.certificate.certificateNumber}</p>
                                <p>Đơn vị cấp: {product.certificate.authority}</p>
                                {product.certificate.issueDate && (
                                    <p>Ngày cấp: {product.certificate.issueDate}</p>
                                )}
                                {product.certificate.certificateUrl && (
                                    <a href={product.certificate.certificateUrl} target="_blank" rel="noreferrer">
                                        Xem file chứng nhận
                                    </a>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default ProductDetailApi;
