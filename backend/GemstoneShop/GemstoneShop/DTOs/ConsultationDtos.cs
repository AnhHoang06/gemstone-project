using System.Globalization;
using System.Text.RegularExpressions;
using GemstoneShop.Models;
using Microsoft.AspNetCore.Mvc;

namespace GemstoneShop.DTOs;

public class AppointmentCreateRequest
{
    public Guid? RequestId { get; set; }
    public int? ServiceId { get; set; }
    /// <summary>yyyy-MM-dd (store-local date).</summary>
    public string? Date { get; set; }
    /// <summary>HH:mm (store-local time), must be a slot start returned by availability.</summary>
    public string? Start { get; set; }
    public string? ContactName { get; set; }
    public string? Phone { get; set; }
    public string? Note { get; set; }
}

public class AppointmentCancelRequest
{
    public string? Reason { get; set; }
}

public class AppointmentStatusRequest
{
    public string? Status { get; set; }
    public string? Reason { get; set; }
}

public class ConsultationServiceRequest
{
    public string? Name { get; set; }
    public string? Description { get; set; }
    public decimal? Price { get; set; }
    public int? DurationMinutes { get; set; }
    public bool? IsActive { get; set; }
    public int? SortOrder { get; set; }
}

public class ConsultationHourRequest
{
    public int? DayOfWeek { get; set; }
    public bool? IsOpen { get; set; }
    public string? OpenTime { get; set; }
    public string? CloseTime { get; set; }
    public int? SlotMinutes { get; set; }
    public int? CapacityPerSlot { get; set; }
}

public class ConsultationHoursRequest
{
    public List<ConsultationHourRequest>? Days { get; set; }
    public bool? Force { get; set; }
}

public class ClosedDateRequest
{
    public string? Date { get; set; }
    public string? Reason { get; set; }
    public bool? Force { get; set; }
}

public static partial class ConsultationFormat
{
    public static readonly CultureInfo Invariant = CultureInfo.InvariantCulture;
    public static string Date(DateOnly d) => d.ToString("yyyy-MM-dd", Invariant);
    public static string Date(DateTime d) => d.ToString("yyyy-MM-dd", Invariant);
    public static string Time(TimeOnly t) => t.ToString("HH:mm", Invariant);
    public static string Time(DateTime d) => d.ToString("HH:mm", Invariant);

    public static bool TryDate(string? value, out DateOnly date) =>
        DateOnly.TryParseExact(value?.Trim(), "yyyy-MM-dd", Invariant, DateTimeStyles.None, out date);

    public static bool TryTime(string? value, out TimeOnly time) =>
        TimeOnly.TryParseExact(value?.Trim(), new[] { "HH:mm", "H:mm", "HH:mm:ss" }, Invariant, DateTimeStyles.None, out time);

    [GeneratedRegex(@"^\+?[0-9][0-9 .\-]{6,18}[0-9]$")]
    private static partial Regex PhoneRegex();
    public static bool ValidPhone(string value) => PhoneRegex().IsMatch(value) && value.Count(char.IsDigit) is >= 8 and <= 15;

    public static ObjectResult Error(int status, string code, string message, object? extra = null) =>
        new(extra == null ? new { code, message } : new { code, message, details = extra }) { StatusCode = status };

    public static object Service(ConsultationService s) => new
    {
        s.Id, s.Name, s.Description, s.Price, s.DurationMinutes, s.SortOrder, isFree = s.Price == 0
    };

    public static object Hour(ConsultationHour h) => new
    {
        dayOfWeek = (int)h.DayOfWeek, h.IsOpen, openTime = Time(h.OpenTime), closeTime = Time(h.CloseTime),
        h.SlotMinutes, h.CapacityPerSlot
    };

    /// <summary>Missing rows are reported as closed days with neutral defaults.</summary>
    public static List<ConsultationHour> FullWeek(IEnumerable<ConsultationHour> rows)
    {
        var map = rows.ToDictionary(h => h.DayOfWeek);
        return Enumerable.Range(0, 7).Select(d => map.TryGetValue((byte)d, out var h) ? h : new ConsultationHour
        {
            DayOfWeek = (byte)d, IsOpen = false, OpenTime = new TimeOnly(9, 0), CloseTime = new TimeOnly(18, 0),
            SlotMinutes = 60, CapacityPerSlot = 1
        }).ToList();
    }

    public static object Appointment(Appointment a, DateTime now, bool admin = false)
    {
        var active = a.Status is AppointmentStatus.Pending or AppointmentStatus.Confirmed;
        var dto = new Dictionary<string, object?>
        {
            ["id"] = a.Id, ["serviceId"] = a.ServiceId, ["serviceName"] = a.ServiceName, ["price"] = a.Price,
            ["date"] = Date(a.StartAt), ["start"] = Time(a.StartAt), ["end"] = Time(a.EndAt),
            ["startAt"] = a.StartAt, ["endAt"] = a.EndAt, ["durationMinutes"] = (int)(a.EndAt - a.StartAt).TotalMinutes,
            ["status"] = a.Status, ["contactName"] = a.ContactName, ["phone"] = a.Phone, ["note"] = a.Note,
            ["cancelReason"] = a.CancelReason, ["cancelledBy"] = a.CancelledBy,
            ["createdAt"] = a.CreatedAt, ["updatedAt"] = a.UpdatedAt,
            ["isUpcoming"] = a.EndAt > now,
            ["hasStarted"] = a.StartAt <= now,
            ["canCancel"] = active && a.StartAt >= now + Services.ConsultationScheduler.MinimumLead,
        };
        if (admin)
            dto["customer"] = a.User == null ? null : new { a.User.Id, a.User.FullName, a.User.Email, a.User.Phone };
        return dto;
    }

    public static object Affected(Appointment a) => new
    {
        a.Id, date = Date(a.StartAt), start = Time(a.StartAt), end = Time(a.EndAt), a.StartAt, a.EndAt,
        a.ServiceName, a.Status, a.ContactName, a.Phone,
        customer = a.User == null ? null : new { a.User.Id, a.User.FullName, a.User.Email }
    };
}
