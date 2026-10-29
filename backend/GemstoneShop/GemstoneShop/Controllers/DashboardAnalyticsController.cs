using System.Data;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController, Route("api/dashboard/analytics"), Authorize(Roles = "Admin")]
public class DashboardAnalyticsController(GemstoneShopContext db) : ControllerBase
{
    [HttpGet("options")]
    public async Task<IActionResult> Options(CancellationToken ct) => Ok(new
    {
        categories = await db.Categories.AsNoTracking().OrderBy(c => c.SortOrder).ThenBy(c => c.Name)
            .Select(c => new { c.Id, c.Name, c.ParentId, c.IsActive }).ToListAsync(ct),
        products = await db.Products.AsNoTracking().OrderBy(p => p.Name).ThenBy(p => p.Id)
            .Select(p => new { p.Id, p.Name, p.IsActive, p.CategoryId, parentId = p.Category.ParentId,
                grandparentId = p.Category.Parent == null ? null : p.Category.Parent.ParentId }).ToListAsync(ct)
    });

    [HttpGet]
    public async Task<ActionResult<DashboardAnalyticsDto>> Get([FromQuery] DashboardAnalyticsQuery request, CancellationToken ct)
    {
        // UTC creation-date cohorts, not an invented payment/completion timestamp.
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var end = request.Range == "custom" ? request.End : today;
        var start = request.Range switch
        {
            "7d" => today.AddDays(-6), "30d" => today.AddDays(-29),
            "3m" => today.AddMonths(-3).AddDays(1), "6m" => today.AddMonths(-6).AddDays(1),
            "1y" => today.AddYears(-1).AddDays(1), _ => request.Start
        };
        if (start == null || end == null || start > end || end > today || end.Value.DayNumber - start.Value.DayNumber > 365)
            return BadRequest(new { message = "Chọn khoảng ngày hợp lệ, tối đa 366 ngày và không vượt quá hôm nay (UTC)." });
        if (request.Range != "custom" && (request.Start != null || request.End != null))
            return BadRequest(new { message = "Ngày bắt đầu/kết thúc chỉ dùng với khoảng tùy chọn." });

        // Keep the three aggregate reads consistent during concurrent order/category edits.
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        var categoryId = request.CategoryId;
        if (categoryId.HasValue && !await db.Categories.AnyAsync(c => c.Id == categoryId, ct))
            return NotFound(new { message = "Danh mục không tồn tại." });
        if (request.ProductId is int productId)
        {
            var productCategory = await db.Products.Where(p => p.Id == productId).Select(p => (int?)p.CategoryId).SingleOrDefaultAsync(ct);
            if (productCategory == null) return NotFound(new { message = "Sản phẩm không tồn tại." });
            if (categoryId.HasValue && !await db.Products.InCategory(categoryId.Value).AnyAsync(p => p.Id == productId, ct))
                return BadRequest(new { message = "Sản phẩm không thuộc danh mục đã chọn." });
            // A product chosen from All categories still gets a useful sibling comparison.
            categoryId ??= productCategory;
        }
        var from = start.Value.ToDateTime(TimeOnly.MinValue);
        var until = end.Value.AddDays(1).ToDateTime(TimeOnly.MinValue);
        var sales = db.OrderDetails.AsNoTracking().Where(d => d.Order.Status.Name == "Completed" &&
            d.Order.PaymentStatus == "Paid" && d.Order.CreatedAt >= from && d.Order.CreatedAt < until);
        if (categoryId is int category)
            sales = sales.Where(d => db.Products.InCategory(category).Any(p => p.Id == d.ProductId));
        var selected = request.ProductId.HasValue ? sales.Where(d => d.ProductId == request.ProductId) : sales;
        var totals = await selected.GroupBy(d => 1).Select(g => new
        {
            Revenue = g.Sum(d => d.UnitPrice * d.Quantity), Units = g.Sum(d => (long)d.Quantity),
            Orders = g.Select(d => d.OrderId).Distinct().Count()
        }).SingleOrDefaultAsync(ct);
        var daily = await selected.GroupBy(d => d.Order.CreatedAt.Date).Select(g => new
        {
            Date = g.Key, Revenue = g.Sum(d => d.UnitPrice * d.Quantity), Units = g.Sum(d => (long)d.Quantity),
            Orders = g.Select(d => d.OrderId).Distinct().Count()
        }).ToListAsync(ct);
        var composition = await sales.GroupBy(d => categoryId != null ? d.ProductId :
            (d.Product.Category.Parent == null ? d.Product.CategoryId :
                d.Product.Category.Parent.ParentId ?? d.Product.Category.ParentId!.Value))
            .Select(g => new { Id = g.Key, Revenue = g.Sum(d => d.UnitPrice * d.Quantity), Units = g.Sum(d => (long)d.Quantity) })
            .ToListAsync(ct);
        var ids = composition.Select(c => c.Id).ToList();
        var names = categoryId.HasValue
            ? await db.Products.Where(p => ids.Contains(p.Id)).ToDictionaryAsync(p => p.Id, p => p.Name, ct)
            : await db.Categories.Where(c => ids.Contains(c.Id)).ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        await tx.CommitAsync(ct);

        var days = end.Value.DayNumber - start.Value.DayNumber + 1;
        var grouping = days <= 31 ? "daily" : days <= 100 ? "weekly" : "monthly";
        var buckets = new List<AnalyticsBucket>();
        for (var cursor = start.Value; cursor <= end.Value;)
        {
            var next = grouping == "daily" ? cursor.AddDays(1) : grouping == "weekly" ? cursor.AddDays(7) :
                new DateOnly(cursor.Year, cursor.Month, 1).AddMonths(1);
            var last = next.AddDays(-1) < end.Value ? next.AddDays(-1) : end.Value;
            var rows = daily.Where(d => DateOnly.FromDateTime(d.Date) >= cursor && DateOnly.FromDateTime(d.Date) <= last).ToList();
            buckets.Add(new(cursor, last, rows.Sum(r => r.Revenue), rows.Sum(r => r.Units), rows.Sum(r => r.Orders)));
            cursor = next;
        }
        return Ok(new DashboardAnalyticsDto(new(start.Value, end.Value, grouping, categoryId, request.ProductId),
            new(totals?.Revenue ?? 0, totals?.Orders ?? 0, totals?.Units ?? 0,
                totals == null || totals.Orders == 0 ? 0 : totals.Revenue / totals.Orders), buckets,
            composition.OrderByDescending(c => c.Revenue).ThenBy(c => c.Id)
                .Select(c => new AnalyticsSlice(c.Id, names[c.Id], categoryId.HasValue ? "product" : "category", c.Revenue, c.Units)).ToList()));
    }
}
