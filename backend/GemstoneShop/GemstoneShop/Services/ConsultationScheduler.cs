using GemstoneShop.Data;
using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public sealed record SlotAvailability(TimeOnly Start, TimeOnly End, int Remaining);
public sealed record DayAvailability(DateOnly Date, bool IsOpen, string? Reason, IReadOnlyList<SlotAvailability> Slots);

public class ConsultationScheduler(GemstoneShopContext db, StoreClock clock)
{
    public const int HorizonDays = 60;
    public static readonly TimeSpan MinimumLead = TimeSpan.FromHours(2);

    public DateOnly Today => clock.Today;
    public DateTime Now => clock.Now;
    public DateOnly LastBookableDate => clock.Today.AddDays(HorizonDays);

    public static bool Blocks(Appointment a) => a.Status is AppointmentStatus.Pending or AppointmentStatus.Confirmed;

    /// <summary>Availability for [from, from + days). Reads current hours, closed dates and Pending/Confirmed appointments.</summary>
    public async Task<List<DayAvailability>> Availability(int durationMinutes, DateOnly from, int days, CancellationToken ct)
    {
        var to = from.AddDays(days);
        var hours = await db.ConsultationHours.AsNoTracking().ToDictionaryAsync(h => h.DayOfWeek, ct);
        var closed = await db.ConsultationClosedDates.AsNoTracking().Where(c => c.Date >= from && c.Date < to)
            .ToDictionaryAsync(c => c.Date, c => c.Reason, ct);
        var rangeStart = from.ToDateTime(TimeOnly.MinValue);
        var rangeEnd = to.ToDateTime(TimeOnly.MinValue);
        var booked = await db.Appointments.AsNoTracking()
            .Where(a => (a.Status == AppointmentStatus.Pending || a.Status == AppointmentStatus.Confirmed)
                && a.StartAt < rangeEnd && a.EndAt > rangeStart)
            .Select(a => new BookedRange(a.StartAt, a.EndAt)).ToListAsync(ct);
        var now = clock.Now;
        var result = new List<DayAvailability>(days);
        for (var date = from; date < to; date = date.AddDays(1))
        {
            hours.TryGetValue((byte)date.DayOfWeek, out var hour);
            var isClosedDate = closed.TryGetValue(date, out var reason);
            result.Add(BuildDay(date, hour, isClosedDate, reason, durationMinutes, booked, now));
        }
        return result;
    }

    public readonly record struct BookedRange(DateTime StartAt, DateTime EndAt);

    public static DayAvailability BuildDay(DateOnly date, ConsultationHour? hour, bool closedDate, string? reason,
        int durationMinutes, IReadOnlyList<BookedRange> booked, DateTime now)
    {
        if (closedDate) return new(date, false, reason, []);
        if (hour == null || !hour.IsOpen) return new(date, false, null, []);
        var today = DateOnly.FromDateTime(now);
        if (date < today || date > today.AddDays(HorizonDays)) return new(date, true, null, []);
        var slotStarts = SlotStarts(date, hour);
        var slot = TimeSpan.FromMinutes(hour.SlotMinutes);
        var occupied = (int)Math.Ceiling(durationMinutes / (double)hour.SlotMinutes);
        var earliest = now + MinimumLead;
        var slots = new List<SlotAvailability>();
        for (var i = 0; i + occupied <= slotStarts.Count; i++)
        {
            var start = slotStarts[i];
            if (start < earliest) continue;
            var remaining = int.MaxValue;
            for (var j = i; j < i + occupied; j++)
            {
                var s = slotStarts[j];
                var e = s + slot;
                var used = booked.Count(b => b.StartAt < e && b.EndAt > s);
                remaining = Math.Min(remaining, hour.CapacityPerSlot - used);
            }
            slots.Add(new(TimeOnly.FromDateTime(start), TimeOnly.FromDateTime(start.AddMinutes(durationMinutes)), Math.Max(0, remaining)));
        }
        return new(date, true, null, slots);
    }

    /// <summary>Slot start times: Open, Open+Slot, ... while the slot ends no later than Close.</summary>
    public static List<DateTime> SlotStarts(DateOnly date, ConsultationHour hour)
    {
        var list = new List<DateTime>();
        if (!hour.IsOpen || hour.SlotMinutes <= 0) return list;
        var close = date.ToDateTime(hour.CloseTime);
        for (var s = date.ToDateTime(hour.OpenTime); s.AddMinutes(hour.SlotMinutes) <= close; s = s.AddMinutes(hour.SlotMinutes))
            list.Add(s);
        return list;
    }

    /// <summary>True when an appointment no longer fits the given configuration (closed day or outside opening hours).</summary>
    public static bool FallsOutside(Appointment a, ConsultationHour? hour, bool closedDate)
    {
        if (closedDate || hour == null || !hour.IsOpen) return true;
        var date = DateOnly.FromDateTime(a.StartAt);
        return a.StartAt < date.ToDateTime(hour.OpenTime) || a.EndAt > date.ToDateTime(hour.CloseTime);
    }
}
