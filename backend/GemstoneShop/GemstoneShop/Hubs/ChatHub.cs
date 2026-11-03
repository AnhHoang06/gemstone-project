using System.Collections.Concurrent;
using System.Security.Claims;
using GemstoneShop.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Hubs;

/// <summary>
/// Realtime channel for customer/staff chat. Groups are server-managed only:
/// customers join chat:customer:{userId}; admins join chat:staff:{userId} (per admin so that every event can
/// re-check that the admin is still active). Messages are sent over HTTP; this hub only pushes events and relays Typing.
/// </summary>
[Authorize]
public class ChatHub(GemstoneShopContext db) : Hub
{
    public static string CustomerGroup(int userId) => $"chat:customer:{userId}";
    public static string StaffGroup(int userId) => $"chat:staff:{userId}";
    private static readonly ConcurrentDictionary<string, long> LastTyping = new();
    private static readonly TimeSpan TypingThrottle = TimeSpan.FromMilliseconds(1500);

    public static async Task<List<string>> RecipientGroups(GemstoneShopContext db, int customerId, bool toCustomer, bool toStaff, CancellationToken ct)
    {
        var users = await db.Users.AsNoTracking()
            .Where(u => u.IsActive && ((toStaff && u.Role.Name == "Admin") || (toCustomer && u.Id == customerId)))
            .Select(u => new { u.Id, IsAdmin = u.Role.Name == "Admin" })
            .ToListAsync(ct);
        var groups = new List<string>();
        foreach (var u in users)
        {
            if (u.IsAdmin) { if (toStaff) groups.Add(StaffGroup(u.Id)); }
            else if (toCustomer && u.Id == customerId) groups.Add(CustomerGroup(u.Id));
        }
        return groups;
    }

    private async Task<(int Id, bool IsAdmin)?> CurrentUser()
    {
        if (!int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id)) return null;
        var user = await db.Users.AsNoTracking().Where(u => u.Id == id && u.IsActive)
            .Select(u => new { u.Id, IsAdmin = u.Role.Name == "Admin" }).SingleOrDefaultAsync(Context.ConnectionAborted);
        return user == null ? null : (user.Id, user.IsAdmin);
    }

    public override async Task OnConnectedAsync()
    {
        var user = await CurrentUser();
        if (user == null)
        {
            Context.Abort();
            return;
        }
        Context.Items["chat:staff"] = user.Value.IsAdmin;
        await Groups.AddToGroupAsync(Context.ConnectionId,
            user.Value.IsAdmin ? StaffGroup(user.Value.Id) : CustomerGroup(user.Value.Id));
        await base.OnConnectedAsync();
    }

    public override Task OnDisconnectedAsync(Exception? exception)
    {
        LastTyping.TryRemove(Context.ConnectionId, out _);
        return base.OnDisconnectedAsync(exception);
    }

    /// <summary>Client → server: "I am typing in this conversation". Throttled per connection; silently ignored when not allowed.</summary>
    public async Task Typing(int conversationId)
    {
        var now = Environment.TickCount64;
        if (LastTyping.TryGetValue(Context.ConnectionId, out var last) && now - last < TypingThrottle.TotalMilliseconds) return;
        LastTyping[Context.ConnectionId] = now;
        try
        {
            var user = await CurrentUser();
            var joinedAsStaff = Context.Items.TryGetValue("chat:staff", out var flag) && flag is true;
            if (user == null || user.Value.IsAdmin != joinedAsStaff) return;
            var customerId = await db.ChatConversations.AsNoTracking().Where(c => c.Id == conversationId)
                .Select(c => (int?)c.CustomerId).SingleOrDefaultAsync(Context.ConnectionAborted);
            if (customerId == null) return;
            if (user.Value.IsAdmin)
            {
                var groups = await RecipientGroups(db, customerId.Value, true, false, Context.ConnectionAborted);
                if (groups.Count > 0) await Clients.Groups(groups).SendAsync("Typing", new { conversationId, side = "Staff" });
            }
            else if (customerId == user.Value.Id)
            {
                var groups = await RecipientGroups(db, customerId.Value, false, true, Context.ConnectionAborted);
                if (groups.Count > 0) await Clients.Groups(groups).SendAsync("Typing", new { conversationId, side = "Customer" });
            }
        }
        catch (OperationCanceledException) { }
    }
}
