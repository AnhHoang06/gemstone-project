namespace GemstoneShop.Models;

public partial class Category
{
    public int? ParentId { get; set; }
    public int SortOrder { get; set; }
    public virtual Category? Parent { get; set; }
    public virtual ICollection<Category> Children { get; set; } = new List<Category>();
}
