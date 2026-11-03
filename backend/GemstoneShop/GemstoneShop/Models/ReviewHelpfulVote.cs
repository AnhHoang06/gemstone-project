namespace GemstoneShop.Models;
public partial class ReviewHelpfulVote
{
 public int ReviewId { get; set; }
 public int UserId { get; set; }
 public DateTime CreatedAt { get; set; }
 public ProductReview Review { get; set; } = null!;
}
