using System;
using System.Collections.Generic;

namespace GemstoneShop.DTOs
{
    // Dùng cho cả GET danh sách và GET chi tiết sản phẩm.
    // Không trả thẳng entity Product ra ngoài vì Product <-> Category <-> ProductImage
    // tham chiếu qua lại nhau, serialize thẳng sẽ bị lỗi vòng lặp (hoặc lộ dữ liệu thừa).
    public class ProductDto
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public string CategoryName { get; set; } = null!;

        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int Stock { get; set; }

        public decimal? Carat { get; set; }
        public string? Color { get; set; }
        public string? Clarity { get; set; }
        public string? Cut { get; set; }
        public string? Origin { get; set; }

        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }

        public List<ProductImageDto> Images { get; set; } = new();

        // Certificate là quan hệ 1-1 tùy chọn (Product.Certificate có thể null)
        public CertificateDto? Certificate { get; set; }
    }

    public class ProductImageDto
    {
        public int Id { get; set; }
        public string ImageUrl { get; set; } = null!;
        public bool IsPrimary { get; set; }
        public int SortOrder { get; set; }
    }

    public class CertificateDto
    {
        public int Id { get; set; }
        public string CertificateNumber { get; set; } = null!;
        public string Authority { get; set; } = null!;
        public DateOnly? IssueDate { get; set; }
        public string? CertificateUrl { get; set; }
        public string? Notes { get; set; }
    }

    // Dùng khi admin thêm/sửa chứng nhận cho sản phẩm (PUT /api/products/{id}/certificate).
    // Certificate là quan hệ 1-1 tùy chọn nên dùng chung 1 DTO cho cả tạo mới và cập nhật (upsert).
    public class CertificateUpsertDto
    {
        public string CertificateNumber { get; set; } = null!;
        public string Authority { get; set; } = null!;
        public DateOnly? IssueDate { get; set; }
        public string? CertificateUrl { get; set; }
        public string? Notes { get; set; }
    }

    // Dùng khi tạo mới sản phẩm (POST). Client gửi lên các trường này, không tự gửi Id/CreatedAt.
    public class ProductCreateDto
    {
        public int CategoryId { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public decimal Price { get; set; }
        public int Stock { get; set; }
        public decimal? Carat { get; set; }
        public string? Color { get; set; }
        public string? Clarity { get; set; }
        public string? Cut { get; set; }
        public string? Origin { get; set; }
        public bool IsActive { get; set; } = true;
    }

    // Dùng khi sửa sản phẩm (PUT). Cùng các trường như tạo mới.
    public class ProductUpdateDto : ProductCreateDto
    {
    }
}
