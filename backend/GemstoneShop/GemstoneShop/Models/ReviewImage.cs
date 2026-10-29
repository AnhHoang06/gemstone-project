namespace GemstoneShop.Models;
public partial class ReviewImage
{
 public int Id { get; set; }
 public int ReviewId { get; set; }
 public string FileName { get; set; } = "";
 public int SortOrder { get; set; }
 public ProductReview Review { get; set; } = null!;
}
