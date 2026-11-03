using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/contact")]
public class ContactController(GemstoneShopContext db, ILogger<ContactController> logger) : ControllerBase
{
    [AllowAnonymous, HttpPost]
    [RequestSizeLimit(32768)]
    public async Task<IActionResult> Create(CreateContactRequest request, CancellationToken ct)
    {
        // Anonymous access is intentional, but an invalid supplied session must not become a guest.
        var authentication = await HttpContext.AuthenticateAsync(JwtBearerDefaults.AuthenticationScheme);
        if (authentication.Failure != null || (Request.Headers.ContainsKey("Authorization") && !authentication.Succeeded))
            return Unauthorized();
        int? userId = null;
        if (authentication.Succeeded)
        {
            if (!int.TryParse(authentication.Principal?.FindFirstValue(ClaimTypes.NameIdentifier), out var id))
                return Unauthorized();
            userId = id;
        }
        var message = new ContactMessage
        {
            UserId = userId, FullName = request.FullName.Trim(), Email = request.Email.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Subject = request.Subject.Trim(), Message = request.Message.Trim(),
            Status = "New", CreatedAt = DateTime.UtcNow
        };
        db.ContactMessages.Add(message);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception)
        {
            logger.LogError(exception, "Contact submission could not be stored.");
            return StatusCode(503, new { message = "Chưa thể gửi liên hệ. Vui lòng thử lại sau." });
        }
        // No entity serialization: never return sender details, status or internal notes publicly.
        return StatusCode(201, new { message = "Đã gửi yêu cầu liên hệ" });
    }
}
