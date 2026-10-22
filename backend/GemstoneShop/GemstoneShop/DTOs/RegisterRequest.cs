using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs
{
    public class RegisterRequest
    {
        [Required, StringLength(100)]
        public string FullName { get; set; } = string.Empty;
        [Required, EmailAddress, StringLength(255)]
        public string Email { get; set; } = string.Empty;
        [Required, MinLength(8)]
        public string Password { get; set; } = string.Empty;

        [StringLength(20)]
        public string? Phone { get; set; }
        [StringLength(500)]
        public string? Address { get; set; }
    }
}