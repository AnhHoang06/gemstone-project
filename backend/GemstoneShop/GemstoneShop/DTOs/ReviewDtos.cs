using System.ComponentModel.DataAnnotations;
namespace GemstoneShop.DTOs;
public class ReviewRequest {
    [Range(1,5, ErrorMessage="Vui lòng chọn từ 1 đến 5 sao.")] public int Rating { get; set; }
    [Required, StringLength(2000, MinimumLength=1)] public string Content { get; set; } = "";
}
public class EngagementContentRequest {
    [Required, StringLength(2000, MinimumLength=1)] public string Content { get; set; } = "";
}
public class VisibilityRequest { [Required] public bool? IsVisible { get; set; } }
public class ReviewDto {
    public int Id { get; set; }
    public int ProductId { get; set; }
    public string ProductName { get; set; } = "";
    public string CustomerName { get; set; } = "";
    public int Rating { get; set; }
    public string Content { get; set; } = "";
    public bool IsVisible { get; set; }
    public bool VerifiedPurchase { get; set; }
    public bool IsOwn { get; set; }
    public bool HelpfulByMe { get; set; }
    public int HelpfulCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public DateTime? ModeratedAt { get; set; }
    public List<ReviewImageDto> Images { get; set; } = new();
}
public class ReviewImageDto {
    public int Id { get; set; }
    public string ImageUrl { get; set; } = "";
}
