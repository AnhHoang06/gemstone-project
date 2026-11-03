using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static GemstoneShop.DTOs.ConsultationFormat;

namespace GemstoneShop.Controllers;

/// <summary>Customer side of the chat. Admin accounts use /api/admin/chat instead (403 here).</summary>
[ApiController, Route("api/chat"), Authorize]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class ChatController(GemstoneShopContext db, ChatService chat) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    private bool IsStaff => User.IsInRole("Admin");
    private static ObjectResult StaffForbidden() =>
        Error(403, "staff_use_inbox", "Tài khoản quản trị dùng hộp thư tại trang quản trị.");

    [HttpGet("me")]
    public async Task<IActionResult> Me([FromQuery] long? before, [FromQuery] int? take, CancellationToken ct)
    {
        if (IsStaff) return StaffForbidden();
        if (ChatService.ValidatePaging(before, take, out var size) is { } invalid) return invalid;
        var userId = UserId;
        // Viewing never creates a conversation; the first sent message does.
        var c = await db.ChatConversations.AsNoTracking().Where(x => x.CustomerId == userId).Select(x => new
        {
            x.Id, x.Status, x.LastMessageAt, x.CreatedAt, x.CustomerLastReadId, x.StaffLastReadId,
            unreadCount = x.Messages.Count(m => m.SenderRole == ChatMessage.Staff && m.Id > x.CustomerLastReadId)
        }).SingleOrDefaultAsync(ct);
        if (c == null) return Ok(new { conversation = (object?)null, messages = Array.Empty<ChatMessageDto>(), hasMore = false });
        var (messages, hasMore) = await chat.Page(c.Id, before, size, ct);
        return Ok(new { conversation = c, messages, hasMore });
    }

    [HttpPost("me/messages")]
    public async Task<IActionResult> Send(ChatSendRequest request, CancellationToken ct) =>
        IsStaff ? StaffForbidden() : await chat.Send(UserId, false, null, request, ct);

    [HttpPost("me/read")]
    public async Task<IActionResult> Read(ChatReadRequest request, CancellationToken ct)
    {
        if (IsStaff) return StaffForbidden();
        if (request.LastMessageId is null or < 0) return Error(400, "invalid_last_message_id", "lastMessageId không hợp lệ.");
        var userId = UserId;
        var c = await db.ChatConversations.AsNoTracking().SingleOrDefaultAsync(x => x.CustomerId == userId, ct);
        if (c == null) return Ok(new { conversationId = (int?)null, side = ChatMessage.Customer, lastReadId = 0L });
        return Ok(await chat.MarkRead(c, false, request.LastMessageId.Value, ct));
    }

    /// <summary>Customer: staff messages not yet read. Admin: conversations with unread customer messages.</summary>
    [HttpGet("unread")]
    public async Task<IActionResult> Unread(CancellationToken ct)
    {
        if (IsStaff)
            return Ok(new
            {
                count = await db.ChatConversations.CountAsync(c =>
                    c.Messages.Any(m => m.SenderRole == ChatMessage.Customer && m.Id > c.StaffLastReadId), ct)
            });
        var userId = UserId;
        var count = await db.ChatConversations.Where(c => c.CustomerId == userId)
            .Select(c => c.Messages.Count(m => m.SenderRole == ChatMessage.Staff && m.Id > c.CustomerLastReadId))
            .SingleOrDefaultAsync(ct);
        return Ok(new { count });
    }
}
