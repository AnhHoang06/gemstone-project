using GemstoneShop.Data;
using GemstoneShop.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Authorize(Roles = "Admin"), Route("api/admin/contacts")]
public class AdminContactsController(GemstoneShopContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> List(CancellationToken ct, string? status = null, int page = 1)
    {
        if (page < 1 || page > 100000 || (status != null && status is not ("New" or "InProgress" or "Resolved")))
            return BadRequest(new { message = "Bộ lọc không hợp lệ." });
        var query = db.ContactMessages.AsNoTracking();
        if (status != null) query = query.Where(x => x.Status == status);
        return Ok(new
        {
            total = await query.CountAsync(ct), page,
            items = await query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
                .Skip((page - 1) * 20).Take(20)
                .Select(x => new { x.Id, x.FullName, x.Email, x.Subject, x.Status, x.CreatedAt }).ToListAsync(ct)
        });
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id, CancellationToken ct)
    {
        var message = await db.ContactMessages.AsNoTracking().Where(x => x.Id == id)
            .Select(x => new { x.Id, x.UserId, x.FullName, x.Email, x.Phone, x.Subject,
                x.Message, x.Status, x.CreatedAt, x.UpdatedAt, x.AdminNote }).SingleOrDefaultAsync(ct);
        return message == null ? NotFound() : Ok(message);
    }

    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, UpdateContactRequest request, CancellationToken ct)
    {
        // Single UPDATE changes only the two admin-editable fields and modification time.
        var changed = await db.ContactMessages.Where(x => x.Id == id).ExecuteUpdateAsync(s => s
            .SetProperty(x => x.Status, request.Status)
            .SetProperty(x => x.AdminNote, string.IsNullOrWhiteSpace(request.AdminNote) ? null : request.AdminNote.Trim())
            .SetProperty(x => x.UpdatedAt, DateTime.UtcNow), ct);
        return changed == 0 ? NotFound() : NoContent();
    }
}
