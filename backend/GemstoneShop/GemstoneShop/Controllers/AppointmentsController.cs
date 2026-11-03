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

[ApiController, Route("api/appointments"), Authorize]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class AppointmentsController(GemstoneShopContext db, ConsultationScheduler scheduler, StoreClock clock,
    AppointmentEvents events) : ControllerBase
{
    public const int MaxUpcoming = 3;
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> Mine(CancellationToken ct)
    {
        var now = clock.Now;
        var list = await db.Appointments.AsNoTracking().Where(a => a.UserId == UserId)
            .OrderByDescending(a => a.StartAt).Take(200).ToListAsync(ct);
        // Upcoming first (soonest first), then past (most recent first).
        var ordered = list.Where(a => a.EndAt > now).OrderBy(a => a.StartAt).ThenBy(a => a.Id)
            .Concat(list.Where(a => a.EndAt <= now).OrderByDescending(a => a.StartAt).ThenByDescending(a => a.Id));
        return Ok(ordered.Select(a => Appointment(a, now)));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> Detail(int id, CancellationToken ct)
    {
        var a = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == UserId, ct);
        return a == null ? Error(404, "not_found", "Không tìm thấy lịch hẹn.") : Ok(Appointment(a, clock.Now));
    }

    [HttpPost]
    public async Task<IActionResult> Create(AppointmentCreateRequest request, CancellationToken ct)
    {
        if (request.RequestId is null || request.RequestId == Guid.Empty) return Error(400, "invalid_request_id", "Mã yêu cầu không hợp lệ.");
        if (request.ServiceId is null) return Error(400, "invalid_service", "Vui lòng chọn dịch vụ.");
        if (!TryDate(request.Date, out var date) || !TryTime(request.Start, out var start))
            return Error(400, "invalid_slot", "Ngày hoặc giờ hẹn không hợp lệ.");
        var name = request.ContactName?.Trim() ?? "";
        var phone = request.Phone?.Trim() ?? "";
        var note = string.IsNullOrWhiteSpace(request.Note) ? null : request.Note.Trim();
        if (name.Length is < 1 or > 100) return Error(400, "invalid_contact_name", "Vui lòng nhập họ tên (tối đa 100 ký tự).");
        if (phone.Length > 20 || !ValidPhone(phone)) return Error(400, "invalid_phone", "Số điện thoại không hợp lệ.");
        if (note?.Length > 500) return Error(400, "invalid_note", "Ghi chú tối đa 500 ký tự.");
        var startAt = date.ToDateTime(start);
        var userId = UserId;
        Appointment created;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            // user -> config (shared) -> day: serializes this user's requests (idempotency, limit) and every booking on the day.
            await CommerceLock.Acquire(db, ConsultationLock.User(userId), ct);
            var existing = await db.Appointments.AsNoTracking()
                .SingleOrDefaultAsync(a => a.UserId == userId && a.RequestId == request.RequestId, ct);
            if (existing != null)
            {
                var same = existing.ServiceId == request.ServiceId && existing.StartAt == startAt &&
                    existing.ContactName == name && existing.Phone == phone && existing.Note == note;
                if (!same) return Error(409, "request_mismatch", "Mã yêu cầu đã dùng với thông tin khác. Kiểm tra lịch hẹn của bạn trước khi đặt lại.");
                var replay = (Dictionary<string, object?>)Appointment(existing, clock.Now);
                replay["replayed"] = true;
                return Ok(replay);
            }
            await ConsultationLock.AcquireShared(db, ConsultationLock.Config, ct);
            await CommerceLock.Acquire(db, ConsultationLock.Day(date), ct);
            var service = await db.ConsultationServices.AsNoTracking().SingleOrDefaultAsync(s => s.Id == request.ServiceId, ct);
            if (service == null) return Error(404, "service_not_found", "Dịch vụ không tồn tại.");
            if (!service.IsActive) return Error(409, "service_unavailable", "Dịch vụ này đã ngừng nhận lịch.");
            var endAt = startAt.AddMinutes(service.DurationMinutes);
            var now = clock.Now;
            var upcoming = await db.Appointments.CountAsync(a => a.UserId == userId && a.EndAt > now &&
                (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed), ct);
            if (upcoming >= MaxUpcoming)
                return Error(409, "limit_reached", $"Bạn đã có {MaxUpcoming} lịch hẹn sắp tới. Vui lòng hủy bớt hoặc chờ hoàn tất trước khi đặt thêm.");
            var overlap = await db.Appointments.AnyAsync(a => a.UserId == userId && a.StartAt < endAt && a.EndAt > startAt &&
                (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed), ct);
            if (overlap) return Error(409, "overlap", "Bạn đã có lịch hẹn khác trùng khung giờ này.");
            var day = (await scheduler.Availability(service.DurationMinutes, date, 1, ct))[0];
            var slot = day.Slots.FirstOrDefault(s => s.Start == start);
            if (slot == null) return Error(409, "slot_unavailable", "Khung giờ này không còn nhận đặt lịch. Vui lòng chọn giờ khác.");
            if (slot.Remaining <= 0) return Error(409, "slot_full", "Khung giờ này vừa hết chỗ. Vui lòng chọn giờ khác.");
            created = new Appointment
            {
                UserId = userId, ServiceId = service.Id, ServiceName = service.Name, Price = service.Price,
                StartAt = startAt, EndAt = endAt, Status = AppointmentStatus.Pending, ContactName = name, Phone = phone,
                Note = note, RequestId = request.RequestId.Value, CreatedAt = clock.UtcNow
            };
            db.Appointments.Add(created);
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        await events.Changed(created.Id, userId);
        var dto = (Dictionary<string, object?>)Appointment(created, clock.Now);
        dto["replayed"] = false;
        return StatusCode(201, dto);
    }

    [HttpPut("{id:int}/cancel")]
    public async Task<IActionResult> Cancel(int id, AppointmentCancelRequest? request, CancellationToken ct)
    {
        var reason = string.IsNullOrWhiteSpace(request?.Reason) ? null : request!.Reason!.Trim();
        if (reason?.Length > 300) return Error(400, "invalid_reason", "Lý do tối đa 300 ký tự.");
        var userId = UserId;
        Appointment? a;
        await using (var tx = await db.Database.BeginTransactionAsync(ct))
        {
            await CommerceLock.Acquire(db, $"appointment:{id}", ct);
            a = await db.Appointments.AsNoTracking().SingleOrDefaultAsync(x => x.Id == id && x.UserId == userId, ct);
            if (a == null) return Error(404, "not_found", "Không tìm thấy lịch hẹn.");
            if (a.Status == AppointmentStatus.Cancelled) return Ok(Appointment(a, clock.Now)); // idempotent retry
            if (a.Status is not (AppointmentStatus.Pending or AppointmentStatus.Confirmed))
                return Error(409, "invalid_transition", "Lịch hẹn đã kết thúc, không thể hủy.");
            if (a.StartAt < clock.Now + ConsultationScheduler.MinimumLead)
                return Error(409, "too_late", "Chỉ có thể hủy lịch trước giờ hẹn ít nhất 2 giờ. Vui lòng liên hệ cửa hàng.");
            var now = clock.UtcNow;
            var changed = await db.Appointments.Where(x => x.Id == id && x.Status == a.Status)
                .ExecuteUpdateAsync(s => s.SetProperty(x => x.Status, AppointmentStatus.Cancelled)
                    .SetProperty(x => x.CancelReason, reason).SetProperty(x => x.CancelledBy, "Customer")
                    .SetProperty(x => x.UpdatedAt, now), ct);
            if (changed != 1) return Error(409, "conflict", "Lịch hẹn vừa được cập nhật. Vui lòng tải lại.");
            await tx.CommitAsync(ct);
        }
        await events.Changed(id, userId);
        var fresh = await db.Appointments.AsNoTracking().SingleAsync(x => x.Id == id, ct);
        return Ok(Appointment(fresh, clock.Now));
    }
}
