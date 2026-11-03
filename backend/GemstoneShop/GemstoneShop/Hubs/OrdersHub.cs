using System.Security.Claims;
using GemstoneShop.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Hubs;

[Authorize]
public class OrdersHub(GemstoneShopContext db) : Hub
{
    public static string UserGroup(int userId) => $"orders:user:{userId}";
    public static string AdminGroup(int userId) => $"orders:admin:{userId}";

    public override async Task OnConnectedAsync()
    {
        if (!int.TryParse(Context.User?.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ||
            !await db.Users.AnyAsync(u => u.Id == id && u.IsActive))
        {
            Context.Abort();
            return;
        }
        await Groups.AddToGroupAsync(Context.ConnectionId, UserGroup(id));
        if (Context.User!.IsInRole("Admin"))
            await Groups.AddToGroupAsync(Context.ConnectionId, AdminGroup(id));
        await base.OnConnectedAsync();
    }
    // No client-callable group membership methods. Events contain IDs only; API rechecks access.
}
