namespace GemstoneShop.DTOs;

// Card fields only; never serialize user/entity navigation properties.
public class WishlistProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = null!;
    public string CategoryName { get; set; } = null!;
    public decimal Price { get; set; }
    public int Stock { get; set; }
    public decimal? Carat { get; set; }
    public string? Color { get; set; }
    public string? Origin { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsActive { get; set; }
}
