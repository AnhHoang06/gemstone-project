namespace GemstoneShop.DTOs;

public class DashboardSummaryDto
{
    public int TotalCustomers { get; set; }
    public int ActiveCustomers { get; set; }
    public int TotalProducts { get; set; }
    public int ActiveProducts { get; set; }
    public int TotalOrders { get; set; }
    // Unknown, not zero: payment/completion semantics are not implemented.
    public decimal? TotalRevenue { get; set; }
}
