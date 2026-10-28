using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class CatalogQuery
{
    [StringLength(200)] public string? Q { get; set; }
    [Range(1, int.MaxValue)] public int? CategoryId { get; set; }
    [Range(typeof(decimal), "0", "9999999999999999")] public decimal? MinPrice { get; set; }
    [Range(typeof(decimal), "0", "9999999999999999")] public decimal? MaxPrice { get; set; }
    [RegularExpression("^(newest|price-asc|price-desc|name-asc)$")] public string Sort { get; set; } = "newest";
    [Range(1, int.MaxValue)] public int Page { get; set; } = 1;
    [Range(1, 48)] public int PageSize { get; set; } = 12;
}

public record CatalogProductDto(int Id, string Name, int CategoryId, string CategoryName, decimal Price,
    int Stock, decimal? Carat, string? Origin, string? CertificateAuthority, string? ImageUrl);
