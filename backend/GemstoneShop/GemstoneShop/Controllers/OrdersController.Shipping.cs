using GemstoneShop.DTOs;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

public partial class OrdersController
{
    [HttpPut("{id:int}/shipping-info")]
    public Task<IActionResult> UpdateMyShipping(int id, UpdateOrderShippingRequest request, CancellationToken ct) =>
        UpdateShipping(id, request, false, ct);

    [Authorize(Roles = "Admin"), HttpPut("admin/{id:int}/shipping-info")]
    public Task<IActionResult> UpdateAdminShipping(int id, UpdateOrderShippingRequest request, CancellationToken ct) =>
        UpdateShipping(id, request, true, ct);

    private async Task<IActionResult> UpdateShipping(int id, UpdateOrderShippingRequest request, bool admin, CancellationToken ct)
    {
        int owner;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // Serializes with shipping/status/cancellation (and payment when that feature lands).
            await CommerceLock.Acquire(db, $"order:{id}", ct);
            var order = await db.Orders.AsNoTracking().Include(o => o.Status)
                .SingleOrDefaultAsync(o => o.Id == id && (admin || o.UserId == UserId), ct);
            if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });
            if (order.Status.Name is not ("Pending" or "Confirmed"))
                return Conflict(new { code = "shipping_locked", message = order.Status.Name == "Shipping"
                    ? "Đơn hàng đã chuyển sang giai đoạn giao hàng và không thể chỉnh sửa thông tin giao nhận."
                    : "Đơn hàng đã hoàn tất hoặc đã hủy và không thể chỉnh sửa thông tin giao nhận." });
            owner = order.UserId;
            if (order.RecipientName == request.RecipientName && order.RecipientPhone == request.RecipientPhone &&
                order.ShippingAddress == request.ShippingAddress && order.Note == request.Note)
                return Ok(new { order.Id }); // No-op replay does not alter audit time or publish.
            var updatedAt = DateTime.UtcNow;
            var changed = await db.Orders.Where(o => o.Id == id && o.StatusId == order.StatusId)
                .ExecuteUpdateAsync(set => set.SetProperty(o => o.RecipientName, request.RecipientName!)
                    .SetProperty(o => o.RecipientPhone, request.RecipientPhone!)
                    .SetProperty(o => o.ShippingAddress, request.ShippingAddress!)
                    .SetProperty(o => o.Note, request.Note).SetProperty(o => o.UpdatedAt, updatedAt), ct);
            if (changed != 1) return Conflict(new { code = "shipping_locked", message = "Đơn hàng vừa thay đổi. Vui lòng tải lại trước khi chỉnh sửa." });
            await tx.CommitAsync(ct);
        }
        await events.Publish("OrderUpdated", id, owner);
        return Ok(new { id });
    }
}
