using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using static GemstoneShop.DTOs.ConsultationFormat;

namespace GemstoneShop.Controllers;

/// <summary>Public consultation catalogue, opening hours and slot availability (no login required).</summary>
[ApiController, Route("api/consultation")]
public class ConsultationController(GemstoneShopContext db, ConsultationScheduler scheduler) : ControllerBase
{
    [HttpGet("services")]
    public async Task<IActionResult> Services(CancellationToken ct)
    {
        var services = await db.ConsultationServices.AsNoTracking().Where(s => s.IsActive)
            .OrderBy(s => s.SortOrder).ThenBy(s => s.Id).ToListAsync(ct);
        return Ok(services.Select(Service));
    }

    [HttpGet("availability")]
    public async Task<IActionResult> Availability([FromQuery] int? serviceId, [FromQuery] string? from, [FromQuery] int? days, CancellationToken ct)
    {
        if (serviceId == null) return Error(400, "invalid_service", "Vui lòng chọn dịch vụ.");
        var today = scheduler.Today;
        var start = today;
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start))
            return Error(400, "invalid_date", "Ngày không hợp lệ (định dạng yyyy-MM-dd).");
        var count = days ?? 14;
        if (count is < 1 or > 42) return Error(400, "invalid_days", "Số ngày phải từ 1 đến 42.");
        if (start < today.AddDays(-42) || start > scheduler.LastBookableDate)
            return Error(400, "invalid_date", "Ngày bắt đầu nằm ngoài khoảng cho phép.");
        var service = await db.ConsultationServices.AsNoTracking().SingleOrDefaultAsync(s => s.Id == serviceId && s.IsActive, ct);
        if (service == null) return Error(404, "service_not_found", "Dịch vụ không tồn tại hoặc đã ngừng nhận lịch.");
        var result = await scheduler.Availability(service.DurationMinutes, start, count, ct);
        return Ok(new
        {
            serviceId = service.Id, durationMinutes = service.DurationMinutes, today = Date(today),
            lastBookableDate = Date(scheduler.LastBookableDate), minimumLeadMinutes = (int)ConsultationScheduler.MinimumLead.TotalMinutes,
            days = result.Select(d => new
            {
                date = Date(d.Date), d.IsOpen, d.Reason,
                slots = d.Slots.Select(s => new { start = Time(s.Start), end = Time(s.End), s.Remaining })
            })
        });
    }

    [HttpGet("hours")]
    public async Task<IActionResult> Hours(CancellationToken ct)
    {
        var today = scheduler.Today;
        var until = scheduler.LastBookableDate;
        var rows = await db.ConsultationHours.AsNoTracking().ToListAsync(ct);
        var closed = await db.ConsultationClosedDates.AsNoTracking().Where(c => c.Date >= today && c.Date <= until)
            .OrderBy(c => c.Date).ToListAsync(ct);
        return Ok(new
        {
            timeZone = "Asia/Ho_Chi_Minh", today = Date(today), todayDayOfWeek = (int)today.DayOfWeek,
            days = FullWeek(rows).Select(Hour),
            closedDates = closed.Select(c => new { date = Date(c.Date), c.Reason })
        });
    }
}
