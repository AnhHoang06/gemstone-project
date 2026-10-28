using GemstoneShop.Data;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

/// <summary>
/// Startup repair for Products.SearchName: fills NULLs and rewrites values that no longer match
/// NormalizeSearch(Name), e.g. rows inserted or renamed directly in SQL. Never throws.
/// </summary>
public static class SearchNameBackfill
{
    private const int BatchSize = 500;

    public static async Task RunAsync(IServiceProvider services, ILogger logger, CancellationToken ct = default)
    {
        try
        {
            await using var scope = services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<GemstoneShopContext>();
            int lastId = 0, scanned = 0, updated = 0;
            while (true)
            {
                var batch = await db.Products.AsNoTracking().Where(p => p.Id > lastId).OrderBy(p => p.Id).Take(BatchSize)
                    .Select(p => new { p.Id, p.Name, p.SearchName }).ToListAsync(ct);
                if (batch.Count == 0) break;
                foreach (var row in batch)
                {
                    var expected = CatalogQueries.NormalizeSearch(row.Name);
                    if (string.Equals(row.SearchName, expected, StringComparison.Ordinal)) continue;
                    // Compare-and-set on Name so a concurrent rename through the API is not overwritten.
                    updated += await db.Products.Where(p => p.Id == row.Id && p.Name == row.Name)
                        .ExecuteUpdateAsync(s => s.SetProperty(p => p.SearchName, expected), ct);
                }
                scanned += batch.Count;
                lastId = batch[^1].Id;
            }
            logger.LogInformation("SearchName backfill: scanned {Scanned} products, updated {Updated}.", scanned, updated);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            logger.LogWarning(ex, "SearchName backfill failed; catalog search falls back to Name for NULL rows.");
        }
    }
}
