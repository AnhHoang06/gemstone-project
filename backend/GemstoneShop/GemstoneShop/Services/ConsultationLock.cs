using GemstoneShop.Data;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public static class ConsultationLock
{
    public const string Config = "consult:config";
    public static string Day(DateOnly date) => $"consult:day:{date:yyyy-MM-dd}";
    public static string User(int userId) => $"consult:user:{userId}";

    // Bookings take the configuration lock shared (bookings on different days run in parallel);
    // hours/closed-date changes take it exclusively so they never interleave with a booking check.
    // Lock order everywhere: user -> config -> day. Error 51001 maps to 409 request_busy.
    public static Task AcquireShared(GemstoneShopContext db, string resource, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($@"
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource={resource}, @LockMode='Shared',
                @LockOwner='Transaction', @LockTimeout=10000;
            IF @result < 0 THROW 51001, 'Consultation request is busy. Please retry.', 1;", ct);
}
