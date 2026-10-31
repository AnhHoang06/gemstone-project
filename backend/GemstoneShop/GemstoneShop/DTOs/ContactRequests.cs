using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class CreateContactRequest : IValidatableObject
{
    [Required, StringLength(100)]
    public string FullName { get; set; } = "";
    [Required, StringLength(254), EmailAddress]
    public string Email { get; set; } = "";
    [StringLength(20), RegularExpression(@"[+]?[0-9 ()\-]{7,20}")]
    public string? Phone { get; set; }
    [Required, StringLength(100)]
    public string Subject { get; set; } = "";
    [Required, StringLength(4000, MinimumLength = 10)]
    public string Message { get; set; } = "";

    public IEnumerable<ValidationResult> Validate(ValidationContext context)
    {
        if ((Message?.Trim().Length ?? 0) < 10)
            yield return new ValidationResult("Nội dung cần ít nhất 10 ký tự.", new[] { nameof(Message) });
        if (!string.IsNullOrEmpty(Phone) && Phone.Count(char.IsAsciiDigit) < 7)
            yield return new ValidationResult("Số điện thoại không hợp lệ.", new[] { nameof(Phone) });
    }
}

public class UpdateContactRequest
{
    [Required, RegularExpression("^(New|InProgress|Resolved)$")]
    public string Status { get; set; } = "";
    [StringLength(2000)]
    public string? AdminNote { get; set; }
}
