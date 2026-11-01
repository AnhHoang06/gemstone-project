using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

public partial class OrdersController
{
    [HttpPost("{id:int}/payment-reported")]
    public Task<IActionResult> ReportPayment(int id, CancellationToken ct) => UpdatePayment(id, false, ct);

    [Authorize(Roles = "Admin"), HttpPost("admin/{id:int}/confirm-payment")]
    public Task<IActionResult> ConfirmPayment(int id, CancellationToken ct) => UpdatePayment(id, true, ct);

    private async Task<IActionResult> UpdatePayment(int id, bool confirm, CancellationToken ct)
    {
        int owner;
        object result;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // Same database lock as cancel/status: works across backend instances.
            await CommerceLock.Acquire(db, $"order:{id}", ct);
            var order = await db.Orders.AsNoTracking().Include(o => o.Status)
                .SingleOrDefaultAsync(o => o.Id == id && (confirm || o.UserId == UserId), ct);
            if (order == null) return NotFound(new { message = "Không tìm thấy đơn hàng." });
            owner = order.UserId;
            if (order.PaymentMethod != "BankTransfer" || order.Status.Name == "Cancelled")
                return Conflict(new { message = "Thao tác chỉ áp dụng cho đơn chuyển khoản chưa hủy." });
            object Snapshot(bool replayed) => new { order.Id, Status = order.Status.Name,
                order.PaymentStatus, order.PaidAt, order.PaymentReportedAt, replayed };
            // Lost-response/double-click retries never change timestamps or publish duplicate events.
            if (order.PaymentStatus == "Paid" && order.Status.Name is "Confirmed" or "Shipping" or "Completed")
                return Ok(Snapshot(true));
            if (order.Status.Name != "Pending" || order.PaymentStatus != "Unpaid")
                return Conflict(new { message = "Trạng thái đơn không cho phép xác nhận thanh toán. Vui lòng tải lại." });
            if (!confirm && order.PaymentReportedAt != null) return Ok(Snapshot(true));
            var now = DateTime.UtcNow;
            var query = db.Orders.Where(o => o.Id == id && o.StatusId == order.StatusId && o.PaymentStatus == "Unpaid");
            int changed;
            if (confirm)
            {
                var status = await db.OrderStatuses.SingleOrDefaultAsync(s => s.Name == "Confirmed", ct);
                if (status == null) return StatusCode(503, new { message = "Chưa cấu hình trạng thái đơn hàng." });
                changed = await query.ExecuteUpdateAsync(set => set
                    .SetProperty(o => o.PaymentStatus, "Paid").SetProperty(o => o.PaidAt, now)
                    .SetProperty(o => o.StatusId, status.Id).SetProperty(o => o.UpdatedAt, now), ct);
                result = new { order.Id, Status = "Confirmed", PaymentStatus = "Paid", PaidAt = now, order.PaymentReportedAt, replayed = false };
            }
            else
            {
                changed = await query.Where(o => o.PaymentReportedAt == null).ExecuteUpdateAsync(set => set
                    .SetProperty(o => o.PaymentReportedAt, now).SetProperty(o => o.UpdatedAt, now), ct);
                result = new { order.Id, Status = "Pending", PaymentStatus = "Unpaid", order.PaidAt, PaymentReportedAt = now, replayed = false };
            }
            if (changed != 1) return Conflict(new { message = "Đơn vừa thay đổi. Vui lòng tải lại." });
            await tx.CommitAsync(ct);
        }
        // Existing secure event tells owner/admin clients to refetch authoritative state.
        await events.Publish("OrderStatusChanged", id, owner);
        return Ok(result);
    }
}
