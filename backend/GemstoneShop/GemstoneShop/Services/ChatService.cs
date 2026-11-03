using System.Linq.Expressions;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static GemstoneShop.DTOs.ConsultationFormat;

namespace GemstoneShop.Services;

public class ChatService(GemstoneShopContext db, StoreClock clock, ChatEvents events)
{
    public const int MaxBody = 2000, RateLimitCount = 8, DefaultTake = 30, MaxTake = 100;
    public static readonly TimeSpan RateWindow = TimeSpan.FromSeconds(30);

    public Expression<Func<ChatMessage, ChatMessageDto>> Projection() => m => new ChatMessageDto
    {
        Id = m.Id, ConversationId = m.ConversationId, SenderRole = m.SenderRole, Body = m.Body, ProductId = m.ProductId,
        ClientMessageId = m.ClientMessageId, CreatedAt = m.CreatedAt,
        Product = m.Product == null ? null : new ChatProductDto
        {
            Id = m.Product.Id, Name = m.Product.Name, Price = m.Product.Price,
            ImageUrl = m.Product.ProductImages.OrderByDescending(i => i.IsPrimary).ThenBy(i => i.SortOrder).ThenBy(i => i.Id)
                .Select(i => i.ImageUrl).FirstOrDefault(),
            IsAvailable = db.Products.PubliclyVisible().Any(p => p.Id == m.ProductId)
        }
    };

    public async Task<(List<ChatMessageDto> Messages, bool HasMore)> Page(int conversationId, long? before, int take, CancellationToken ct)
    {
        var query = db.ChatMessages.AsNoTracking().Where(m => m.ConversationId == conversationId);
        if (before is > 0) query = query.Where(m => m.Id < before);
        var rows = await query.OrderByDescending(m => m.Id).Take(take + 1).Select(Projection()).ToListAsync(ct);
        var hasMore = rows.Count > take;
        if (hasMore) rows.RemoveAt(rows.Count - 1);
        rows.Reverse();
        return (rows, hasMore);
    }

    public static ObjectResult? ValidatePaging(long? before, int? take, out int size)
    {
        size = take ?? DefaultTake;
        if (size is < 1 or > MaxTake) return Error(400, "invalid_take", $"take phải từ 1 đến {MaxTake}.");
        if (before is < 0) return Error(400, "invalid_before", "before không hợp lệ.");
        return null;
    }

    /// <summary>
    /// Persists a message (idempotent by ClientMessageId within the conversation), applies the per-sender rate limit,
    /// reopens a Closed conversation when the customer writes, then publishes ChatMessage/ChatRead/ChatConversation after commit.
    /// Customer: conversationId == null (own conversation, created on first message). Staff: conversationId required.
    /// </summary>
    public async Task<ObjectResult> Send(int senderId, bool staff, int? conversationId, ChatSendRequest request, CancellationToken ct)
    {
        if (request.ClientMessageId is null || request.ClientMessageId == Guid.Empty)
            return Error(400, "invalid_client_message_id", "Mã tin nhắn không hợp lệ.");
        var body = request.Body?.Trim() ?? "";
        if (body.Length == 0) return Error(400, "invalid_body", "Vui lòng nhập nội dung tin nhắn.");
        if (body.Length > MaxBody) return Error(400, "invalid_body", $"Tin nhắn tối đa {MaxBody} ký tự.");
        if (request.ProductId != null && !await db.Products.PubliclyVisible().AnyAsync(p => p.Id == request.ProductId, ct))
            return Error(400, "invalid_product", "Sản phẩm đính kèm không tồn tại hoặc đã ngừng bán.");
        var clientId = request.ClientMessageId.Value;
        var role = staff ? ChatMessage.Staff : ChatMessage.Customer;
        ChatConversation? conversation;
        ChatMessage message;
        var reopened = false;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // Per-sender lock: serializes the rate-limit count, idempotency check and first-conversation creation.
            await CommerceLock.Acquire(db, $"chat:sender:{senderId}", ct);
            conversation = staff
                ? await db.ChatConversations.SingleOrDefaultAsync(c => c.Id == conversationId, ct)
                : await db.ChatConversations.SingleOrDefaultAsync(c => c.CustomerId == senderId, ct);
            if (staff && conversation == null) return Error(404, "not_found", "Không tìm thấy hội thoại.");
            if (conversation != null)
            {
                var prior = await db.ChatMessages.AsNoTracking()
                    .Where(m => m.ConversationId == conversation.Id && m.ClientMessageId == clientId)
                    .Select(m => new { m.Id, m.SenderUserId, m.Body, m.ProductId }).SingleOrDefaultAsync(ct);
                if (prior != null)
                {
                    if (prior.SenderUserId != senderId || prior.Body != body || prior.ProductId != request.ProductId)
                        return Error(409, "request_mismatch", "Mã tin nhắn đã dùng cho nội dung khác.");
                    var replay = await db.ChatMessages.AsNoTracking().Where(m => m.Id == prior.Id).Select(Projection()).SingleAsync(ct);
                    return new OkObjectResult(replay); // retry of a stored message: no duplicate, no new events
                }
            }
            var utcNow = clock.UtcNow;
            var windowStart = utcNow - RateWindow;
            var recent = await db.ChatMessages.CountAsync(m => m.SenderUserId == senderId && m.CreatedAt > windowStart, ct);
            if (recent >= RateLimitCount)
            {
                var oldest = await db.ChatMessages.Where(m => m.SenderUserId == senderId && m.CreatedAt > windowStart)
                    .OrderBy(m => m.CreatedAt).Select(m => m.CreatedAt).FirstAsync(ct);
                var retry = Math.Max(1, (int)Math.Ceiling((oldest + RateWindow - utcNow).TotalSeconds));
                return new ObjectResult(new
                {
                    code = "rate_limited", retryAfterSeconds = retry,
                    message = $"Bạn gửi tin quá nhanh. Vui lòng đợi {retry} giây rồi thử lại."
                }) { StatusCode = 429 };
            }
            if (conversation == null)
            {
                conversation = new ChatConversation
                {
                    CustomerId = senderId, Status = ChatConversation.Open, LastMessageAt = utcNow, CreatedAt = utcNow
                };
                db.ChatConversations.Add(conversation);
                await db.SaveChangesAsync(ct);
            }
            else if (!staff && conversation.Status == ChatConversation.Closed)
            {
                conversation.Status = ChatConversation.Open;
                reopened = true;
            }
            message = new ChatMessage
            {
                ConversationId = conversation.Id, SenderUserId = senderId, SenderRole = role, Body = body,
                ProductId = request.ProductId, ClientMessageId = clientId, CreatedAt = utcNow
            };
            db.ChatMessages.Add(message);
            conversation.LastMessageAt = utcNow;
            await db.SaveChangesAsync(ct);
            // Writing implies having read everything up to one's own message.
            if (staff) conversation.StaffLastReadId = Math.Max(conversation.StaffLastReadId, message.Id);
            else conversation.CustomerLastReadId = Math.Max(conversation.CustomerLastReadId, message.Id);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        var dto = await db.ChatMessages.AsNoTracking().Where(m => m.Id == message.Id).Select(Projection()).SingleAsync(ct);
        await events.Message(conversation.Id, conversation.CustomerId, dto);
        if (reopened) await events.Conversation(conversation.Id, conversation.CustomerId, ChatConversation.Open);
        await events.Read(conversation.Id, conversation.CustomerId, role, message.Id);
        return new ObjectResult(dto) { StatusCode = 201 };
    }

    /// <summary>Moves the side's read pointer forward (never backward, never past the last message).</summary>
    public async Task<object> MarkRead(ChatConversation conversation, bool staff, long lastMessageId, CancellationToken ct)
    {
        var maxId = await db.ChatMessages.Where(m => m.ConversationId == conversation.Id).MaxAsync(m => (long?)m.Id, ct) ?? 0;
        var target = Math.Min(lastMessageId, maxId);
        var changed = staff
            ? await db.ChatConversations.Where(c => c.Id == conversation.Id && c.StaffLastReadId < target)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.StaffLastReadId, target), ct)
            : await db.ChatConversations.Where(c => c.Id == conversation.Id && c.CustomerLastReadId < target)
                .ExecuteUpdateAsync(s => s.SetProperty(c => c.CustomerLastReadId, target), ct);
        var current = await db.ChatConversations.AsNoTracking().Where(c => c.Id == conversation.Id)
            .Select(c => staff ? c.StaffLastReadId : c.CustomerLastReadId).SingleAsync(ct);
        var side = staff ? ChatMessage.Staff : ChatMessage.Customer;
        if (changed == 1) await events.Read(conversation.Id, conversation.CustomerId, side, current);
        return new { conversationId = conversation.Id, side, lastReadId = current };
    }

    public Task Status(int conversationId, int customerId, string status) => events.Conversation(conversationId, customerId, status);
}
