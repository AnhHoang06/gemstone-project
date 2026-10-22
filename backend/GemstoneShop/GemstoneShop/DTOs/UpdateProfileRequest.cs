using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs
{
    public class UpdateProfileRequest
    {
        [Required, StringLength(100)]
        public string FullName { get; set; } = string.Empty;
        [StringLength(20)]
        public string? Phone { get; set; }
        [StringLength(500)]
        public string? Address { get; set; }
    }
}