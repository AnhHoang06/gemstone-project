using GemstoneShop.Data;
using GemstoneShop.Hubs;
using Microsoft.AspNetCore.SignalR;

namespace GemstoneShop.Services;

public class ChatEvents(IHubContext<ChatHub> hub, GemstoneShopContext db, ILogger<ChatEvents> logger)
{
    public Task Message(int conversationId, int customerId, object message) =>
        Send("ChatMessage", customerId, new { conversationId, message }, true, true);

    public Task Read(int conversationId, int customerId, string side, long lastReadId) =>
        Send("ChatRead", customerId, new { conversationId, side, lastReadId }, true, true);

    public Task Conversation(int conversationId, int customerId, string status) =>
        Send("ChatConversation", customerId, new { conversationId, status }, true, true);

    // Called only after commit. Recipients are re-checked against the database on every event so
    // locked accounts (or demoted admins) stop receiving even on an already-open connection.
    private async Task Send(string name, int customerId, object payload, bool toCustomer, bool toStaff)
    {
        try
        {
            using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(3));
            var groups = await ChatHub.RecipientGroups(db, customerId, toCustomer, toStaff, timeout.Token);
            if (groups.Count == 0) return;
            await hub.Clients.Groups(groups).SendAsync(name, payload, timeout.Token);
        }
        catch (Exception ex) { logger.LogWarning(ex, "Chat {Event} for customer {CustomerId} committed; realtime delivery failed", name, customerId); }
    }
}
