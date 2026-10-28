using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/cart"), Authorize]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class CartController(GemstoneShopContext db) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private async Task<object> Snapshot(CancellationToken ct)
    {
        var items = await db.CartItems.AsNoTracking().Where(i => i.Cart.UserId == UserId)
            .OrderBy(i => i.Id).Select(i => new
            {
                i.ProductId, i.Quantity, i.Product.Name, i.Product.Price, i.Product.Stock,
                IsActive = db.Products.PubliclyVisible().Any(p => p.Id == i.ProductId),
                ImageUrl = i.Product.ProductImages.OrderByDescending(p => p.IsPrimary).ThenBy(p => p.SortOrder)
                    .Select(p => p.ImageUrl).FirstOrDefault(),
                LineTotal = i.Product.Price * i.Quantity
            }).ToListAsync(ct);
        return new { items, totalQuantity = items.Sum(i => i.Quantity), total = items.Sum(i => i.LineTotal) };
    }

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"cart:{UserId}", ct);
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }

    [HttpPost("items/{productId:int}")]
    public Task<IActionResult> Add(int productId, CartQuantityRequest request, CancellationToken ct) =>
        Change(productId, request.Quantity, true, ct);

    [HttpPut("items/{productId:int}")]
    public Task<IActionResult> Set(int productId, CartQuantityRequest request, CancellationToken ct) =>
        Change(productId, request.Quantity, false, ct);

    private async Task<IActionResult> Change(int productId, int quantity, bool add, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"cart:{UserId}", ct);
        var product = await db.Products.AsNoTracking().PubliclyVisible().FirstOrDefaultAsync(p => p.Id == productId, ct);
        if (product == null || !product.IsActive)
            return Conflict(new { message = "Sản phẩm không còn được bán." });
        var cart = await db.Carts.Include(c => c.CartItems).SingleOrDefaultAsync(c => c.UserId == UserId, ct);
        var item = cart?.CartItems.SingleOrDefault(i => i.ProductId == productId);
        if (!add && item == null) return NotFound(new { message = "Sản phẩm không có trong giỏ của bạn." });
        var next = (long)quantity + (add ? item?.Quantity ?? 0 : 0);
        if (next > product.Stock || next > 10000)
            return Conflict(new { message = "Số lượng vượt quá tồn kho hoặc giới hạn 10.000 sản phẩm." });
        if (cart == null)
        {
            cart = new Cart { UserId = UserId, CreatedAt = DateTime.UtcNow };
            db.Carts.Add(cart);
        }
        if (item == null) cart.CartItems.Add(new CartItem { ProductId = productId, Quantity = (int)next });
        else item.Quantity = (int)next;
        cart.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }

    [HttpDelete("items/{productId:int}")]
    public Task<IActionResult> Remove(int productId, CancellationToken ct) => DeleteItems(productId, ct);

    [HttpDelete]
    public Task<IActionResult> Clear(CancellationToken ct) => DeleteItems(null, ct);

    private async Task<IActionResult> DeleteItems(int? productId, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, $"cart:{UserId}", ct);
        var query = db.CartItems.Where(i => i.Cart.UserId == UserId);
        if (productId.HasValue) query = query.Where(i => i.ProductId == productId.Value);
        await query.ExecuteDeleteAsync(ct);
        var result = await Snapshot(ct);
        await tx.CommitAsync(ct);
        return Ok(result);
    }
}
