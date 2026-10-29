namespace GemstoneShop.Models;
public partial class ProductAnswer
{
 public int Id { get; set; }
 public int QuestionId { get; set; }
 public int AdminUserId { get; set; }
 public string Content { get; set; } = "";
 public DateTime CreatedAt { get; set; }
 public DateTime? UpdatedAt { get; set; }
 public ProductQuestion Question { get; set; } = null!;
}
