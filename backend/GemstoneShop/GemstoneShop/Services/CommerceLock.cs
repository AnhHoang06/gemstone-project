using GemstoneShop.Data;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public static class CommerceLock
{
    // SQL transaction-owned locks work across API processes, not just one server instance.
    public static Task Acquire(GemstoneShopContext db, string resource, CancellationToken ct) =>
        db.Database.ExecuteSqlInterpolatedAsync($@"
            DECLARE @result int;
            EXEC @result = sys.sp_getapplock @Resource={resource}, @LockMode='Exclusive',
                @LockOwner='Transaction', @LockTimeout=10000;
            IF @result < 0 THROW 51001, 'Commerce request is busy. Please retry.', 1;", ct);
}
