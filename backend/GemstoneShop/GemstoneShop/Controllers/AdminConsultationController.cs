using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using static GemstoneShop.DTOs.ConsultationFormat;

namespace GemstoneShop.Controllers;

[ApiController, Authorize(Roles = "Admin"), Route("api/admin")]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class AdminConsultationController(GemstoneShopContext db, StoreClock clock,
    AppointmentEvents events) : ControllerBase
{
    // ── Appointments ────────────────────────────────────────────────────────────

    [HttpGet("appointments")]
    public async Task<IActionResult> Appointments([FromQuery] string? from, [FromQuery] string? to, [FromQuery] string? status,
        [FromQuery] string? q, CancellationToken ct)
    {
        var today = clock.Today;
        var start = today;
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start)) return Error(400, "invalid_date", "Ngày bắt đầu không hợp lệ.");
        var end = start.AddDays(6);
        if (!string.IsNullOrWhiteSpace(to) && !TryDate(to, out end)) return Error(400, "invalid_date", "Ngày kết thúc không hợp lệ.");
        if (end < start || end.DayNumber - start.DayNumber > 366) return Error(400, "invalid_range", "Khoảng ngày không hợp lệ (tối đa 1 năm).");
        if (!string.IsNullOrWhiteSpace(status) && !AppointmentStatus.IsValid(status)) return Error(400, "invalid_status", "Trạng thái không hợp lệ.");
        if (q?.Length > 100) return Error(400, "invalid_query", "Từ khóa tối đa 100 ký tự.");
        var rangeStart = start.ToDateTime(TimeOnly.MinValue);
        var rangeEnd = end.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var query = db.Appointments.AsNoTracking().Include(a => a.User)
            .Where(a => a.StartAt >= rangeStart && a.StartAt < rangeEnd);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(a => a.Status == status);
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = q.Trim();
            query = query.Where(a => a.ContactName.Contains(term) || a.Phone.Contains(term) ||
                a.User.Email.Contains(term) || a.User.FullName.Contains(term) || (a.User.Phone != null && a.User.Phone.Contains(term)));
        }
        var list = await query.OrderBy(a => a.StartAt).ThenBy(a => a.Id).Take(1000).ToListAsync(ct);
        var now = clock.Now;
        return Ok(new { from = Date(start), to = Date(end), items = list.Select(a => Appointment(a, now, true)) });
    }

    [HttpGet("appointments/{id:int}")]
    public async Task<IActionResult> AppointmentDetail(int id, CancellationToken ct)
    {
        var a = await db.Appointments.AsNoTracking().Include(x => x.User).SingleOrDefaultAsync(x => x.Id == id, ct);
        return a == null ? Error(404, "not_found", "Không tìm thấy lịch hẹn.") : Ok(Appointment(a, clock.Now, true));
    }

    [HttpPut("appointments/{id:int}/status")]
    public async Task<IActionResult> AppointmentStatusChange(int id, AppointmentStatusRequest request, CancellationToken ct)
    {
        var target = request.Status?.Trim();
        if (!AppointmentStatus.IsValid(target) || target == AppointmentStatus.Pending)
            return Error(400, "invalid_status", "Trạng thái không hợp lệ.");
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (reason?.Length > 300) return Error(400, "invalid_reason", "Lý do tối đa 300 ký tự.");
        int owner;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            await CommerceLock.Acquire(db, $"appointment:{id}", ct);
            var a = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id, ct);
            if (a == null) return Error(404, "not_found", "Không tìm thấy lịch hẹn.");
            owner = a.UserId;
            if (a.Status == target)
            {
                var same = await db.Appointments.AsNoTracking().Include(x => x.User).SingleAsync(x => x.Id == id, ct);
                return Ok(Appointment(same, clock.Now, true)); // idempotent retry
            }
            var allowed = (a.Status, target) switch
            {
                (AppointmentStatus.Pending, AppointmentStatus.Confirmed or AppointmentStatus.Cancelled) => true,
                (AppointmentStatus.Confirmed, AppointmentStatus.Completed or AppointmentStatus.NoShow or AppointmentStatus.Cancelled) => true,
                _ => false
            };
            if (!allowed) return Error(409, "invalid_transition", "Trạng thái lịch hẹn đã thay đổi hoặc không cho phép thao tác này. Hãy tải lại.");
            if (target is AppointmentStatus.Completed or AppointmentStatus.NoShow && a.StartAt > clock.Now)
                return Error(409, "not_started", "Chỉ đánh dấu Hoàn tất/Vắng mặt sau giờ bắt đầu của lịch hẹn.");
            var now = clock.UtcNow;
            var cancel = target == AppointmentStatus.Cancelled;
            var changed = await db.Appointments.Where(x => x.Id == id && x.Status == a.Status)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, target)
                    .SetProperty(x => x.CancelReason, x => cancel ? reason : x.CancelReason)
                    .SetProperty(x => x.CancelledBy, x => cancel ? "Staff" : x.CancelledBy)
                    .SetProperty(x => x.UpdatedAt, now), ct);
            if (changed != 1) return Error(409, "conflict", "Lịch hẹn vừa được cập nhật. Vui lòng tải lại.");
            await tx.CommitAsync(ct);
        }
        await events.Changed(id, owner);
        var fresh = await db.Appointments.AsNoTracking().Include(x => x.User).SingleAsync(x => x.Id == id, ct);
        return Ok(Appointment(fresh, clock.Now, true));
    }

    // ── Services ────────────────────────────────────────────────────────────────

    [HttpGet("consultation/services")]
    public async Task<IActionResult> Services(CancellationToken ct)
    {
        var now = clock.Now;
        var list = await db.ConsultationServices.AsNoTracking().OrderBy(s => s.SortOrder).ThenBy(s => s.Id)
            .Select(s => new
            {
                s.Id, s.Name, s.Description, s.Price, s.DurationMinutes, s.IsActive, s.SortOrder, s.CreatedAt, s.UpdatedAt,
                isFree = s.Price == 0,
                appointmentCount = db.Appointments.Count(a => a.ServiceId == s.Id),
                upcomingCount = db.Appointments.Count(a => a.ServiceId == s.Id && a.EndAt > now &&
                    (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
            }).ToListAsync(ct);
        return Ok(list);
    }

    private static ObjectResult? ValidateService(ConsultationServiceRequest r, out string name, out string? description)
    {
        name = r.Name?.Trim() ?? "";
        description = string.IsNullOrWhiteSpace(r.Description) ? null : r.Description.Trim();
        if (name.Length is < 1 or > 150) return Error(400, "invalid_name", "Tên dịch vụ bắt buộc, tối đa 150 ký tự.");
        if (description?.Length > 500) return Error(400, "invalid_description", "Mô tả tối đa 500 ký tự.");
        if (r.Price is null or < 0 or > 1_000_000_000_000m || decimal.Round(r.Price.Value, 2) != r.Price.Value)
            return Error(400, "invalid_price", "Giá phải từ 0 (miễn phí) trở lên.");
        if (r.DurationMinutes is null or < 15 or > 240) return Error(400, "invalid_duration", "Thời lượng phải từ 15 đến 240 phút.");
        if (r.SortOrder is < -100000 or > 100000) return Error(400, "invalid_sort_order", "Thứ tự không hợp lệ.");
        return null;
    }

    private static bool IsUniqueViolation(DbUpdateException ex) =>
        (ex.InnerException as SqlException)?.Number is 2601 or 2627;

    [HttpPost("consultation/services")]
    public async Task<IActionResult> CreateService(ConsultationServiceRequest request, CancellationToken ct)
    {
        if (ValidateService(request, out var name, out var description) is { } invalid) return invalid;
        if (await db.ConsultationServices.AnyAsync(s => s.Name == name, ct))
            return Error(409, "duplicate_name", "Đã có dịch vụ cùng tên.");
        var service = new ConsultationService
        {
            Name = name, Description = description, Price = request.Price!.Value, DurationMinutes = request.DurationMinutes!.Value,
            IsActive = request.IsActive ?? true, SortOrder = request.SortOrder ?? 0, CreatedAt = clock.UtcNow
        };
        db.ConsultationServices.Add(service);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Error(409, "duplicate_name", "Đã có dịch vụ cùng tên."); }
        return StatusCode(201, AdminService(service));
    }

    [HttpPut("consultation/services/{id:int}")]
    public async Task<IActionResult> UpdateService(int id, ConsultationServiceRequest request, CancellationToken ct)
    {
        if (ValidateService(request, out var name, out var description) is { } invalid) return invalid;
        var service = await db.ConsultationServices.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (service == null) return Error(404, "not_found", "Không tìm thấy dịch vụ.");
        if (await db.ConsultationServices.AnyAsync(s => s.Name == name && s.Id != id, ct))
            return Error(409, "duplicate_name", "Đã có dịch vụ cùng tên.");
        // Existing appointments keep their snapshot name/price/end time.
        service.Name = name; service.Description = description; service.Price = request.Price!.Value;
        service.DurationMinutes = request.DurationMinutes!.Value; service.IsActive = request.IsActive ?? service.IsActive;
        service.SortOrder = request.SortOrder ?? service.SortOrder; service.UpdatedAt = clock.UtcNow;
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex)) { return Error(409, "duplicate_name", "Đã có dịch vụ cùng tên."); }
        return Ok(AdminService(service));
    }

    [HttpDelete("consultation/services/{id:int}")]
    public async Task<IActionResult> DeleteService(int id, CancellationToken ct)
    {
        var service = await db.ConsultationServices.SingleOrDefaultAsync(s => s.Id == id, ct);
        if (service == null) return Error(404, "not_found", "Không tìm thấy dịch vụ.");
        if (!await db.Appointments.AnyAsync(a => a.ServiceId == id, ct))
        {
            db.ConsultationServices.Remove(service);
            try
            {
                await db.SaveChangesAsync(ct);
                return Ok(new { id, deleted = true, isActive = false });
            }
            catch (DbUpdateException ex) when ((ex.InnerException as SqlException)?.Number == 547)
            {
                // A booking landed concurrently: fall back to hiding.
                db.ChangeTracker.Clear();
            }
        }
        var hidden = await db.ConsultationServices.Where(s => s.Id == id)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.IsActive, false).SetProperty(x => x.UpdatedAt, clock.UtcNow), ct);
        return hidden == 1 ? Ok(new { id, deleted = false, isActive = false }) : Error(404, "not_found", "Không tìm thấy dịch vụ.");
    }

    private static object AdminService(ConsultationService s) => new
    {
        s.Id, s.Name, s.Description, s.Price, s.DurationMinutes, s.IsActive, s.SortOrder, s.CreatedAt, s.UpdatedAt, isFree = s.Price == 0
    };

    // ── Hours and closed dates ─────────────────────────────────────────────────

    [HttpGet("consultation/hours")]
    public async Task<IActionResult> Hours(CancellationToken ct)
    {
        var rows = await db.ConsultationHours.AsNoTracking().ToListAsync(ct);
        return Ok(new { timeZone = "Asia/Ho_Chi_Minh", today = Date(clock.Today), days = FullWeek(rows).Select(Hour) });
    }

    private async Task<List<Appointment>> FutureActive(CancellationToken ct)
    {
        var now = clock.Now;
        return await db.Appointments.AsNoTracking().Include(a => a.User)
            .Where(a => a.EndAt > now && (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed))
            .OrderBy(a => a.StartAt).ThenBy(a => a.Id).ToListAsync(ct);
    }

    [HttpPut("consultation/hours")]
    public async Task<IActionResult> UpdateHours(ConsultationHoursRequest request, [FromQuery] bool force, CancellationToken ct)
    {
        force |= request.Force == true;
        if (request.Days is not { Count: 7 } || request.Days.Select(d => d.DayOfWeek).Distinct().Count() != 7 ||
            request.Days.Any(d => d.DayOfWeek is null or < 0 or > 6))
            return Error(400, "invalid_week", "Cần đủ 7 ngày trong tuần (dayOfWeek 0 = Chủ nhật … 6 = Thứ Bảy).");
        var rows = new List<ConsultationHour>();
        foreach (var d in request.Days.OrderBy(d => d.DayOfWeek))
        {
            if (!TryTime(d.OpenTime, out var open) || !TryTime(d.CloseTime, out var close))
                return Error(400, "invalid_time", $"Giờ mở/đóng cửa không hợp lệ (ngày {d.DayOfWeek}).");
            if (d.SlotMinutes is null or < 15 or > 240) return Error(400, "invalid_slot_minutes", "Độ dài slot phải từ 15 đến 240 phút.");
            if (d.CapacityPerSlot is null or < 1 or > 20) return Error(400, "invalid_capacity", "Số khách mỗi slot phải từ 1 đến 20.");
            var isOpen = d.IsOpen == true;
            if (isOpen && (open >= close || (close - open).TotalMinutes < d.SlotMinutes))
                return Error(400, "invalid_range", $"Giờ mở phải sớm hơn giờ đóng và đủ ít nhất một slot (ngày {d.DayOfWeek}).");
            rows.Add(new ConsultationHour
            {
                DayOfWeek = (byte)d.DayOfWeek!.Value, IsOpen = isOpen, OpenTime = open, CloseTime = close,
                SlotMinutes = d.SlotMinutes.Value, CapacityPerSlot = d.CapacityPerSlot.Value
            });
        }
        List<Appointment> affected;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            await CommerceLock.Acquire(db, ConsultationLock.Config, ct);
            var byDay = rows.ToDictionary(r => r.DayOfWeek);
            var future = await FutureActive(ct);
            var dates = future.Select(a => DateOnly.FromDateTime(a.StartAt)).Distinct().ToList();
            var closed = await ClosedSet(dates, ct);
            affected = future.Where(a =>
            {
                var date = DateOnly.FromDateTime(a.StartAt);
                return ConsultationScheduler.FallsOutside(a, byDay[(byte)date.DayOfWeek], closed.Contains(date));
            }).ToList();
            // Appointments already outside the current configuration are not "newly" affected.
            var current = (await db.ConsultationHours.AsNoTracking().ToListAsync(ct)).ToDictionary(h => h.DayOfWeek);
            affected = affected.Where(a =>
            {
                var date = DateOnly.FromDateTime(a.StartAt);
                current.TryGetValue((byte)date.DayOfWeek, out var old);
                return !ConsultationScheduler.FallsOutside(a, old, closed.Contains(date));
            }).ToList();
            if (affected.Count > 0 && !force)
                return Conflict(new
                {
                    code = "affects_appointments",
                    message = $"Thay đổi này làm {affected.Count} lịch hẹn sắp tới nằm ngoài giờ làm việc. Xác nhận lại để vẫn lưu (lịch hẹn không tự hủy).",
                    appointments = affected.Select(Affected)
                });
            var existing = await db.ConsultationHours.ToDictionaryAsync(h => h.DayOfWeek, ct);
            foreach (var r in rows)
            {
                if (existing.TryGetValue(r.DayOfWeek, out var e))
                {
                    e.IsOpen = r.IsOpen; e.OpenTime = r.OpenTime; e.CloseTime = r.CloseTime;
                    e.SlotMinutes = r.SlotMinutes; e.CapacityPerSlot = r.CapacityPerSlot;
                }
                else db.ConsultationHours.Add(r);
            }
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        return Ok(new { days = rows.Select(Hour), affected = affected.Select(Affected) });
    }

    private async Task<HashSet<DateOnly>> ClosedSet(List<DateOnly> dates, CancellationToken ct)
    {
        if (dates.Count == 0) return [];
        var min = dates.Min();
        var max = dates.Max();
        return (await db.ConsultationClosedDates.AsNoTracking().Where(c => c.Date >= min && c.Date <= max)
            .Select(c => c.Date).ToListAsync(ct)).ToHashSet();
    }

    [HttpGet("consultation/closed-dates")]
    public async Task<IActionResult> ClosedDates([FromQuery] string? from, CancellationToken ct)
    {
        var start = clock.Today;
        if (!string.IsNullOrWhiteSpace(from) && !TryDate(from, out start)) return Error(400, "invalid_date", "Ngày không hợp lệ.");
        var list = await db.ConsultationClosedDates.AsNoTracking().Where(c => c.Date >= start).OrderBy(c => c.Date).Take(500).ToListAsync(ct);
        return Ok(list.Select(c => new { date = Date(c.Date), c.Reason }));
    }

    [HttpPost("consultation/closed-dates")]
    public async Task<IActionResult> AddClosedDate(ClosedDateRequest request, [FromQuery] bool force, CancellationToken ct)
    {
        force |= request.Force == true;
        if (!TryDate(request.Date, out var date)) return Error(400, "invalid_date", "Ngày không hợp lệ (định dạng yyyy-MM-dd).");
        if (date < clock.Today) return Error(400, "past_date", "Không thể đặt ngày nghỉ trong quá khứ.");
        var reason = string.IsNullOrWhiteSpace(request.Reason) ? null : request.Reason.Trim();
        if (reason?.Length > 200) return Error(400, "invalid_reason", "Lý do tối đa 200 ký tự.");
        List<Appointment> affected;
        var created = false;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            await CommerceLock.Acquire(db, ConsultationLock.Config, ct);
            var dayStart = date.ToDateTime(TimeOnly.MinValue);
            var dayEnd = date.AddDays(1).ToDateTime(TimeOnly.MinValue);
            var row = await db.ConsultationClosedDates.SingleOrDefaultAsync(c => c.Date == date, ct);
            affected = row != null ? [] : (await FutureActive(ct)).Where(a => a.StartAt >= dayStart && a.StartAt < dayEnd).ToList();
            if (affected.Count > 0 && !force)
                return Conflict(new
                {
                    code = "affects_appointments",
                    message = $"Ngày {date:dd/MM/yyyy} đang có {affected.Count} lịch hẹn. Xác nhận lại để vẫn đóng cửa (lịch hẹn không tự hủy).",
                    appointments = affected.Select(Affected)
                });
            if (row == null) { db.ConsultationClosedDates.Add(new ConsultationClosedDate { Date = date, Reason = reason }); created = true; }
            else row.Reason = reason;
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        var body = new { date = Date(date), reason, affected = affected.Select(Affected) };
        return created ? StatusCode(201, body) : Ok(body);
    }

    [HttpDelete("consultation/closed-dates/{date}")]
    public async Task<IActionResult> RemoveClosedDate(string date, CancellationToken ct)
    {
        if (!TryDate(date, out var d)) return Error(400, "invalid_date", "Ngày không hợp lệ (định dạng yyyy-MM-dd).");
        var removed = await db.ConsultationClosedDates.Where(c => c.Date == d).ExecuteDeleteAsync(ct);
        return removed == 1 ? NoContent() : Error(404, "not_found", "Không có ngày nghỉ này.");
    }
}
