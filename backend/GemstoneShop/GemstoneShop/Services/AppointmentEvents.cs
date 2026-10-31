using GemstoneShop.Data;
using GemstoneShop.Hubs;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public class AppointmentEvents(IHubContext<OrdersHub> orders, IHubContext<ChatHub> chat, GemstoneShopContext db,
    ILogger<AppointmentEvents> logger)
{
    /// <summary>
    /// Sends AppointmentChanged {appointmentId} to the owner and every active admin over both /hubs/orders and /hubs/chat.
    /// Called only after commit; failures are logged and never fail the request. Clients refetch over HTTP.
    /// </summary>
    public async Task Changed(int appointmentId, int ownerId)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var recipients = await db.Users.AsNoTracking()
                .Where(u => u.IsActive && (u.Role.Name == "Admin" || u.Id == ownerId))
                .Select(u => new { u.Id, IsAdmin = u.Role.Name == "Admin" })
                .ToListAsync(timeout.Token);
            if (recipients.Count == 0) return;
            var payload = new { appointmentId };
            var orderGroups = recipients.Where(u => u.IsAdmin).Select(u => OrdersHub.AdminGroup(u.Id)).ToList();
            var chatGroups = recipients.Where(u => u.IsAdmin).Select(u => ChatHub.StaffGroup(u.Id)).ToList();
            var owner = recipients.FirstOrDefault(u => u.Id == ownerId);
            if (owner != null)
            {
                orderGroups.Add(OrdersHub.UserGroup(ownerId));
                if (!owner.IsAdmin) chatGroups.Add(ChatHub.CustomerGroup(ownerId));
            }
            await Task.WhenAll(
                orders.Clients.Groups(orderGroups.Distinct().ToList()).SendAsync("AppointmentChanged", payload, timeout.Token),
                chat.Clients.Groups(chatGroups.Distinct().ToList()).SendAsync("AppointmentChanged", payload, timeout.Token));
        }
        catch (Exception ex) { logger.LogWarning(ex, "Appointment {AppointmentId} committed; realtime delivery failed", appointmentId); }
    }
}
