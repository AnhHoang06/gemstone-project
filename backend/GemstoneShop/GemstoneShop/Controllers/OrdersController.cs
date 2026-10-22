using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/orders"), Authorize]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class OrdersController(GemstoneShopContext db, OrderEvents events) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private IQueryable<Order> Visible(bool admin) => db.Orders.AsNoTracking()
        .Where(o => admin || o.UserId == UserId);

    private async Task<IActionResult> List(bool admin, string? status, CancellationToken ct)
    {
        var query = Visible(admin);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(o => o.Status.Name == status);
        var orders = await query.OrderByDescending(o => o.Id).Select(o => new
        {
            o.Id, o.UserId, o.RecipientName, o.TotalAmount, o.CreatedAt, Status = o.Status.Name,
            ItemCount = o.OrderDetails.Sum(d => d.Quantity)
        }).ToListAsync(ct);
        return Ok(orders);
    }

    private async Task<IActionResult> Detail(int id, bool admin, CancellationToken ct)
    {
        var order = await Visible(admin).Where(o => o.Id == id).Select(o => new
        {
            o.Id, o.UserId, o.RecipientName, o.RecipientPhone, o.ShippingAddress, o.Note,
            o.TotalAmount, o.CreatedAt, o.UpdatedAt, Status = o.Status.Name,
            Items = o.OrderDetails.OrderBy(d => d.Id).Select(d => new
            { d.ProductId, d.ProductName, d.Quantity, d.UnitPrice, LineTotal = d.UnitPrice * d.Quantity }).ToList()
        }).SingleOrDefaultAsync(ct);
        return order == null ? NotFound(new { message = "Không tìm thấy đơn hàng." }) : Ok(order);
    }

    [HttpGet] public Task<IActionResult> Mine(CancellationToken ct) => List(false, null, ct);
    [HttpGet("{id:int}")] public Task<IActionResult> MineDetail(int id, CancellationToken ct) => Detail(id, false, ct);
    [Authorize(Roles = "Admin"), HttpGet("admin")]
    public Task<IActionResult> AdminList([FromQuery] string? status, CancellationToken ct) => List(true, status, ct);
    [Authorize(Roles = "Admin"), HttpGet("admin/{id:int}")]
    public Task<IActionResult> AdminDetail(int id, CancellationToken ct) => Detail(id, true, ct);
    [HttpGet("statuses")]
    public async Task<IActionResult> Statuses(CancellationToken ct) =>
        Ok(await db.OrderStatuses.AsNoTracking().OrderBy(s => s.Id).Select(s => new { s.Id, s.Name }).ToListAsync(ct));

    [HttpPost]
    public async Task<IActionResult> Checkout(CheckoutRequest request, CancellationToken ct)
    {
        if (request.RequestId == Guid.Empty) return BadRequest(new { message = "Mã yêu cầu không hợp lệ." });
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new
        {
            Name = request.RecipientName.Trim(), Phone = request.RecipientPhone.Trim(),
            Address = request.ShippingAddress.Trim(), Note = request.Note?.Trim()
        }))));
        int orderId;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // Same lock as every cart mutation: checkout cannot race cart additions/changes.
            await CommerceLock.Acquire(db, $"cart:{UserId}", ct);
            var receipt = await db.CheckoutReceipts.SingleOrDefaultAsync(r => r.UserId == UserId && r.RequestId == request.RequestId, ct);
            if (receipt != null)
            {
                if (receipt.RequestHash != hash) return Conflict(new { message = "Mã yêu cầu đã dùng với thông tin khác. Kiểm tra lịch sử đơn trước khi đặt lại." });
                return Ok(new { orderId = receipt.OrderId, replayed = true });
            }
            var cart = await db.Carts.Include(c => c.CartItems).ThenInclude(i => i.Product)
                .SingleOrDefaultAsync(c => c.UserId == UserId, ct);
            if (cart == null || cart.CartItems.Count == 0)
                return Conflict(new { message = "Giỏ hàng trống. Hãy kiểm tra lịch sử nếu bạn vừa đặt hàng." });
            var pending = await db.OrderStatuses.SingleOrDefaultAsync(s => s.Name == "Pending", ct);
            if (pending == null) return StatusCode(503, new { message = "Chưa cấu hình trạng thái đơn hàng." });
            var order = new Order
            {
                UserId = UserId, StatusId = pending.Id, RecipientName = request.RecipientName.Trim(),
                RecipientPhone = request.RecipientPhone.Trim(), ShippingAddress = request.ShippingAddress.Trim(),
                Note = request.Note?.Trim(), CreatedAt = DateTime.UtcNow
            };
            foreach (var item in cart.CartItems.OrderBy(i => i.ProductId))
            {
                var p = item.Product;
                if (item.Quantity <= 0 || p.Price < 0) return Conflict(new { message = "Giỏ hàng không hợp lệ." });
                // Compare the snapshot price/name as well; a concurrent admin edit must not silently alter checkout.
                var updated = await db.Products.Where(p2 => p2.Id == p.Id && p2.IsActive && p2.Stock >= item.Quantity && p2.Price == p.Price && p2.Name == p.Name)
                    .ExecuteUpdateAsync(set => set.SetProperty(p2 => p2.Stock, p2 => p2.Stock - item.Quantity)
                        .SetProperty(p2 => p2.UpdatedAt, DateTime.UtcNow), ct);
                if (updated != 1) return Conflict(new { message = $"{p.Name} đã thay đổi, ngừng bán hoặc không đủ tồn kho. Vui lòng kiểm tra giỏ." });
                order.OrderDetails.Add(new OrderDetail { ProductId = p.Id, ProductName = p.Name, Quantity = item.Quantity, UnitPrice = p.Price });
                order.TotalAmount += p.Price * item.Quantity;
            }
            db.Orders.Add(order);
            db.CartItems.RemoveRange(cart.CartItems);
            cart.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
            db.CheckoutReceipts.Add(new CheckoutReceipt { UserId = UserId, RequestId = request.RequestId!.Value, RequestHash = hash, OrderId = order.Id });
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
            orderId = order.Id;
        }
        await events.Publish("NewOrder", orderId, UserId);
        return Ok(new { orderId, replayed = false });
    }

    [HttpPut("{id:int}/cancel")]
    public Task<IActionResult> Cancel(int id, CancellationToken ct) => Transition(id, "Cancelled", false, ct);
    [Authorize(Roles = "Admin"), HttpPut("admin/{id:int}/status")]
    public Task<IActionResult> ChangeStatus(int id, OrderStatusRequest request, CancellationToken ct) => Transition(id, request.Status, true, ct);

    private async Task<IActionResult> Transition(int id, string target, bool admin, CancellationToken ct)
    {
        int owner;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            await CommerceLock.Acquire(db, $"order:{id}", ct);
            var order = await db.Orders.AsNoTracking().Include(o => o.Status).Include(o => o.OrderDetails)
                .SingleOrDefaultAsync(o => o.Id == id && (admin || o.UserId == UserId), ct);
            if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });
            owner = order.UserId;
            var current = order.Status.Name;
            if (current == target) return Ok(new { status = current }); // idempotent retry, no stock change
            var allowed = target == "Cancelled" ? current == "Pending" || (admin && current == "Confirmed")
                : admin && ((current == "Pending" && target == "Confirmed") ||
                    (current == "Confirmed" && target == "Shipping") || (current == "Shipping" && target == "Completed"));
            if (!allowed) return Conflict(new { message = "Trạng thái đơn đã thay đổi hoặc không cho phép thao tác này. Hãy tải lại đơn." });
            var status = await db.OrderStatuses.SingleOrDefaultAsync(s => s.Name == target, ct);
            if (status == null) return BadRequest(new { message = "Trạng thái không hợp lệ." });
            var changed = await db.Orders.Where(o => o.Id == id && o.StatusId == order.StatusId)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.StatusId, status.Id).SetProperty(o => o.UpdatedAt, DateTime.UtcNow), ct);
            if (changed != 1) return Conflict(new { message = "Đơn vừa được cập nhật. Vui lòng tải lại." });
            if (target == "Cancelled")
                foreach (var item in order.OrderDetails.OrderBy(d => d.ProductId))
                    await db.Products.Where(p => p.Id == item.ProductId)
                        .ExecuteUpdateAsync(set => set.SetProperty(p => p.Stock, p => p.Stock + item.Quantity)
                            .SetProperty(p => p.UpdatedAt, DateTime.UtcNow), ct);
            await tx.CommitAsync(ct);
        }
        await events.Publish("OrderStatusChanged", id, owner);
        return Ok(new { status = target });
    }
}
