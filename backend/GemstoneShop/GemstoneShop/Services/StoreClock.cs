namespace GemstoneShop.Services;

/// <summary>
/// Store-local clock (Asia/Ho_Chi_Minh). All "now" comparisons for consultation booking use this.
/// TimeProvider is injected so tests can substitute a fixed clock.
/// </summary>
public sealed class StoreClock(TimeProvider time)
{
    public static TimeZoneInfo Zone { get; } = ResolveZone();

    private static TimeZoneInfo ResolveZone()
    {
        foreach (var id in new[] { "Asia/Ho_Chi_Minh", "SE Asia Standard Time" })
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(id); }
            catch (TimeZoneNotFoundException) { }
            catch (InvalidTimeZoneException) { }
        }
        // Vietnam has no DST; a fixed +07:00 zone is equivalent if the OS has no tz database.
        return TimeZoneInfo.CreateCustomTimeZone("Store+07", TimeSpan.FromHours(7), "Giờ Việt Nam", "Giờ Việt Nam");
    }

    public DateTime UtcNow => time.GetUtcNow().UtcDateTime;

    /// <summary>Store-local wall-clock time, Kind=Unspecified (matches Appointments.StartAt).</summary>
    public DateTime Now => DateTime.SpecifyKind(TimeZoneInfo.ConvertTimeFromUtc(UtcNow, Zone), DateTimeKind.Unspecified);

    public DateOnly Today => DateOnly.FromDateTime(Now);
}
