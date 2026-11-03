namespace GemstoneShop.Models;
public partial class ProductReview
{
 public int Id { get; set; }
 public int UserId { get; set; }
 public int ProductId { get; set; }
 public int Rating { get; set; }
 public string Content { get; set; } = "";
 public bool IsVisible { get; set; } = true;
 public DateTime CreatedAt { get; set; }
 public DateTime? UpdatedAt { get; set; }
 public DateTime? ModeratedAt { get; set; }
 public User User { get; set; } = null!;
 public Product Product { get; set; } = null!;
 public ICollection<ReviewImage> Images { get; set; } = new List<ReviewImage>();
 public ICollection<ReviewHelpfulVote> Votes { get; set; } = new List<ReviewHelpfulVote>();
}
