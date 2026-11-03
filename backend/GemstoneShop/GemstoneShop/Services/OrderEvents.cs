using GemstoneShop.Hubs;
using GemstoneShop.Data;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public class OrderEvents(IHubContext<OrdersHub> hub, GemstoneShopContext db, ILogger<OrderEvents> logger)
{
    public async Task Publish(string name, int orderId, int userId)
    {
        // Called only after commit; notification failure must never fail the completed transaction.
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            // Recheck recipients on every publication, including already-connected accounts.
            var recipients = await db.Users.AsNoTracking()
                .Where(u => u.IsActive && (u.Role.Name == "Admin" || (name != "NewOrder" && u.Id == userId)))
                .Select(u => new { u.Id, IsAdmin = u.Role.Name == "Admin" })
                .ToListAsync(timeout.Token);
            var groups = recipients.Where(u => u.IsAdmin).Select(u => OrdersHub.AdminGroup(u.Id)).ToList();
            if (name != "NewOrder" && recipients.Any(u => u.Id == userId))
                groups.Add(OrdersHub.UserGroup(userId));
            if (groups.Count == 0) return;
            await hub.Clients.Groups(groups).SendAsync(name, new { orderId }, timeout.Token);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Order {OrderId} committed; realtime delivery failed", orderId); }
    }
}
