using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/wishlist"), Authorize]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class WishlistController(GemstoneShopContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private Task<List<WishlistProductDto>> Snapshot(CancellationToken ct) =>
        db.WishlistItems.AsNoTracking().Where(w => w.UserId == UserId && w.Product.IsActive)
            .OrderByDescending(w => w.CreatedAt).ThenBy(w => w.ProductId)
            .Select(w => new WishlistProductDto
            {
                Id = w.ProductId, Name = w.Product.Name, CategoryName = w.Product.Category.Name,
                Price = w.Product.Price, Stock = w.Product.Stock, Carat = w.Product.Carat,
                Color = w.Product.Color, Origin = w.Product.Origin, IsActive = w.Product.IsActive,
                ImageUrl = w.Product.ProductImages.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
                    .Select(i => i.ImageUrl).FirstOrDefault()
            }).ToListAsync(ct);

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"wishlist:{UserId}", ct);
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }

    [HttpPost("{productId:int:min(1)}")]
    public async Task<IActionResult> Add(int productId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"wishlist:{UserId}", ct);
        var product = await db.Products.AsNoTracking().Where(p => p.Id == productId)
            .Select(p => new { p.IsActive }).SingleOrDefaultAsync(ct);
        if (product == null) return NotFound(new { message = "Không tìm thấy sản phẩm." });
        if (!product.IsActive) return Conflict(new { message = "Sản phẩm đã ngừng bán." });
        if (!await db.WishlistItems.AnyAsync(w => w.UserId == UserId && w.ProductId == productId, ct))
        {
            db.WishlistItems.Add(new WishlistItem { UserId = UserId, ProductId = productId, CreatedAt = DateTime.UtcNow });
            await db.SaveChangesAsync(ct);
        }
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }

    [HttpDelete("{productId:int:min(1)}")]
    public async Task<IActionResult> Remove(int productId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"wishlist:{UserId}", ct);
        // Removing an absent/inactive favorite is deliberately idempotent.
        await db.WishlistItems.Where(w => w.UserId == UserId && w.ProductId == productId).ExecuteDeleteAsync(ct);
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }
}
