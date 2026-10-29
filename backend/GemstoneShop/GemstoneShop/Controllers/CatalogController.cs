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
        if (request.MinPrice > request.MaxPrice)
            return BadRequest(new { message = "Khoảng giá không hợp lệ." });
        var query = db.Products.AsNoTracking().PubliclyVisible().MatchingSearch(request.Q);
        if (request.CategoryId is int id)
            query = query.Where(p => p.CategoryId == id || p.Category.ParentId == id || (p.Category.Parent != null && p.Category.Parent.ParentId == id));
        if (request.MinPrice.HasValue) query = query.Where(p => p.Price >= request.MinPrice.Value);
        if (request.MaxPrice.HasValue) query = query.Where(p => p.Price <= request.MaxPrice.Value);
        var total = await query.CountAsync(ct);
        var totalPages = (int)Math.Ceiling(total / (double)request.PageSize);
        // Out-of-range pages are clamped to the last page; no results → page 1, totalPages 0.
        var page = Math.Clamp(request.Page, 1, Math.Max(totalPages, 1));
        var sorted = request.Sort switch
        {
            "price-asc" => query.OrderBy(p => p.Price).ThenBy(p => p.Id),
            "price-desc" => query.OrderByDescending(p => p.Price).ThenBy(p => p.Id),
            "name-asc" => query.OrderBy(p => p.Name).ThenBy(p => p.Id),
            _ => query.OrderByDescending(p => p.CreatedAt).ThenByDescending(p => p.Id)
        };
        var items = total == 0 ? new List<CatalogProductDto>() : await sorted.Skip((page - 1) * request.PageSize).Take(request.PageSize).Select(p =>
            new CatalogProductDto(p.Id, p.Name, p.CategoryId, p.Category.Name, p.Price, p.Stock, p.Carat, p.Color, p.Clarity, p.Cut, p.Origin,
                p.Certificate == null ? null : p.Certificate.Authority,
                p.ProductImages.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.Id).Select(i => i.ImageUrl).FirstOrDefault())).ToListAsync(ct);
        return Ok(new { items, total, page, request.PageSize, totalPages });
    }
}
