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

[ApiController, Authorize(Roles = "Admin"), Route("api/admin/chat")]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class AdminChatController(GemstoneShopContext db, ChatService chat, StoreClock clock) : ControllerBase
{
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private IQueryable<object> Summaries(IQueryable<ChatConversation> query)
    {
        var now = clock.Now;
        return query.Select(c => new
        {
            c.Id, c.Status, c.LastMessageAt, c.CreatedAt, c.CustomerLastReadId, c.StaffLastReadId,
            customer = new { c.Customer.Id, c.Customer.FullName, c.Customer.Email, c.Customer.Phone, c.Customer.IsActive },
            unreadCount = c.Messages.Count(m => m.SenderRole == ChatMessage.Customer && m.Id > c.StaffLastReadId),
            lastMessage = c.Messages.OrderByDescending(m => m.Id)
                .Select(m => new { m.Id, m.SenderRole, m.Body, m.ProductId, m.CreatedAt }).FirstOrDefault(),
            orderCount = db.Orders.Count(o => o.UserId == c.CustomerId),
            upcomingAppointmentCount = db.Appointments.Count(a => a.UserId == c.CustomerId && a.EndAt > now &&
                (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
        });
    }

    [HttpGet("conversations")]
    public async Task<IActionResult> Conversations([FromQuery] string? status, [FromQuery] string? q, [FromQuery] int? take, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(status) && status is not (ChatConversation.Open or ChatConversation.Closed))
            return Error(400, "invalid_status", "Trạng thái phải là Open hoặc Closed.");
        var size = take ?? 50;
        if (size is < 1 or > 200) return Error(400, "invalid_take", "take phải từ 1 đến 200.");
        if (q?.Length > 100) return Error(400, "invalid_query", "Từ khóa tối đa 100 ký tự.");
        var query = db.ChatConversations.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(c => c.Status == status);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(c => c.Customer.FullName.Contains(term) || c.Customer.Email.Contains(term) ||
                (c.Customer.Phone != null && c.Customer.Phone.Contains(term)));
        }
        query = query.OrderByDescending(c => c.LastMessageAt).ThenByDescending(c => c.Id).Take(size);
        return Ok(await Summaries(query).ToListAsync(ct));
    }

    [HttpGet("conversations/{id:int}")]
    public async Task<IActionResult> Conversation(int id, CancellationToken ct)
    {
        var summary = await Summaries(db.ChatConversations.AsNoTracking().Where(c => c.Id == id)).SingleOrDefaultAsync(ct);
        return summary == null ? Error(404, "not_found", "Không tìm thấy hội thoại.") : Ok(summary);
    }

    [HttpGet("conversations/{id:int}/messages")]
    public async Task<IActionResult> Messages(int id, [FromQuery] long? before, [FromQuery] int? take, CancellationToken ct)
    {
        if (ChatService.ValidatePaging(before, take, out var size) is { } invalid) return invalid;
        var summary = await Summaries(db.ChatConversations.AsNoTracking().Where(c => c.Id == id)).SingleOrDefaultAsync(ct);
        if (summary == null) return Error(404, "not_found", "Không tìm thấy hội thoại.");
        var (messages, hasMore) = await chat.Page(id, before, size, ct);
        return Ok(new { conversation = summary, messages, hasMore });
    }

    [HttpPost("conversations/{id:int}/messages")]
    public async Task<IActionResult> Send(int id, ChatSendRequest request, CancellationToken ct) =>
        await chat.Send(UserId, true, id, request, ct);

    [HttpPost("conversations/{id:int}/read")]
    public async Task<IActionResult> Read(int id, ChatReadRequest request, CancellationToken ct)
    {
        if (request.LastMessageId is null or < 0) return Error(400, "invalid_last_message_id", "lastMessageId không hợp lệ.");
        var c = await db.ChatConversations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (c == null) return Error(404, "not_found", "Không tìm thấy hội thoại.");
        return Ok(await chat.MarkRead(c, true, request.LastMessageId.Value, ct));
    }

    [HttpPut("conversations/{id:int}/status")]
    public async Task<IActionResult> Status(int id, ChatStatusRequest request, CancellationToken ct)
    {
        var target = request.Status?.Trim();
        if (target is not (ChatConversation.Open or ChatConversation.Closed))
            return Error(400, "invalid_status", "Trạng thái phải là Open hoặc Closed.");
        var c = await db.ChatConversations.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
        if (c == null) return Error(404, "not_found", "Không tìm thấy hội thoại.");
        var changed = await db.ChatConversations.Where(x => x.Id == id && x.Status != target)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, target), ct);
        if (changed == 1) await chat.Status(id, c.CustomerId, target);
        return Ok(new { id, status = target });
    }
}
