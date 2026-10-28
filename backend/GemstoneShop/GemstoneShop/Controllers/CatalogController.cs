using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/products/catalog")]
public class CatalogController(GemstoneShopContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get([FromQuery] CatalogQuery request, CancellationToken ct)
    {
        if (request.MinPrice > request.MaxPrice || (long)(request.Page - 1) * request.PageSize > int.MaxValue)
            return BadRequest(new { message = "Khoảng giá hoặc trang không hợp lệ." });
        var query = db.Products.AsNoTracking().PubliclyVisible();
        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var normalized = CatalogQueries.NormalizeSearch(request.Q.Trim());
            query = query.Where(p => p.SearchName != null && p.SearchName.Contains(normalized));
        }
        if (request.CategoryId is int id)
            query = query.Where(p => p.CategoryId == id || p.Category.ParentId == id || (p.Category.Parent != null && p.Category.Parent.ParentId == id));
        if (request.MinPrice.HasValue) query = query.Where(p => p.Price >= request.MinPrice.Value);
        if (request.MaxPrice.HasValue) query = query.Where(p => p.Price <= request.MaxPrice.Value);
        var total = await query.CountAsync(ct);
        var sorted = request.Sort switch
        {
            "price-asc" => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price-desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "name-asc" => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
        };
        var items = await sorted.Skip((request.Page - 1) * request.PageSize).Take(request.PageSize).Select(p =>
            new CatalogProductDto(p.Id, p.Name, p.CategoryId, p.Category.Name, p.Price, p.Stock, p.Carat, p.Origin,
                p.Certificate == null ? null : p.Certificate.Authority,
                p.ProductImages.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault())).ToListAsync(ct);
        return Ok(new { items, total, request.Page, request.PageSize, totalPages = (int)Math.Ceiling(total / (double)request.PageSize) });
    }
}
