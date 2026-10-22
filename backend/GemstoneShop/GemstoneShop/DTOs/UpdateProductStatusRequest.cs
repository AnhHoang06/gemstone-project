using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class UpdateProductStatusRequest
{
    [Required]
    public bool? IsActive { get; set; }
}
