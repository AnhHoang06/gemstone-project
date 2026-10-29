namespace GemstoneShop.Models;
public partial class ProductQuestion
{
 public int Id { get; set; }
 public int ProductId { get; set; }
 public int UserId { get; set; }
 public string Content { get; set; } = "";
 public bool IsVisible { get; set; } = true;
 public DateTime CreatedAt { get; set; }
 public DateTime? ModeratedAt { get; set; }
 public User User { get; set; } = null!;
 public Product Product { get; set; } = null!;
 public ProductAnswer? Answer { get; set; }
}
