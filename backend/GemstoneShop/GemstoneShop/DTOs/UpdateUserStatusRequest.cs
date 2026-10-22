using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class UpdateUserStatusRequest
{
    // Nullable so an omitted field cannot silently deactivate an account.
    [Required]
    public bool? IsActive { get; set; }
}
