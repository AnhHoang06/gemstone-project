using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class DashboardAnalyticsQuery
{
    [RegularExpression("^(7d|30d|3m|6m|1y|custom)$")]
    public string Range { get; set; } = "30d";
    public DateOnly? Start { get; set; }
    public DateOnly? End { get; set; }
    [Range(1, int.MaxValue)] public int? CategoryId { get; set; }
    [Range(1, int.MaxValue)] public int? ProductId { get; set; }
}

public record AnalyticsSummary(decimal Revenue, int CompletedOrders, long UnitsSold, decimal AverageOrderValue);
public record AnalyticsBucket(DateOnly StartDate, DateOnly EndDate, decimal Revenue, long UnitsSold, int Orders);
public record AnalyticsSlice(int Id, string Name, string Type, decimal Revenue, long UnitsSold);
public record AnalyticsFilters(DateOnly Start, DateOnly End, string Grouping, int? CategoryId, int? ProductId);
public record DashboardAnalyticsDto(AnalyticsFilters Filters, AnalyticsSummary Summary,
    IReadOnlyList<AnalyticsBucket> Trend, IReadOnlyList<AnalyticsSlice> Breakdown);
