using System;
using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs
{
    public class CategoryDto
    {
        public int Id { get; set; }
        public int? ParentId { get; set; }
        public int SortOrder { get; set; }
        public string Name { get; set; } = null!;
        public string? Description { get; set; }
        public bool IsActive { get; set; }
        public DateTime CreatedAt { get; set; }
    }

    // Dùng khi tạo mới (POST) và sửa (PUT) category
    public class CategoryCreateDto
    {
        public int? ParentId { get; set; }
        [Range(0, int.MaxValue)] public int SortOrder { get; set; }
        [Required, StringLength(100)]
        public string Name { get; set; } = null!;
        [StringLength(500)]
        public string? Description { get; set; }
        public bool IsActive { get; set; } = true;
    }
}
