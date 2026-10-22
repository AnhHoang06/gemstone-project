using GemstoneShop.Data;
using GemstoneShop.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[ApiController]
[Route("api/dashboard")]
[Authorize(Roles = "Admin")]
public class DashboardController : ControllerBase
{
    private readonly GemstoneShopContext _context;

    public DashboardController(GemstoneShopContext context) => _context = context;

    [HttpGet("summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetSummary(CancellationToken cancellationToken)
    {
        var customers = await _context.Users
            .Where(user => user.Role.Name == "Customer")
            .GroupBy(user => 1)
            .Select(group => new { Total = group.Count(), Active = group.Count(user => user.IsActive) })
            .SingleOrDefaultAsync(cancellationToken);

        var products = await _context.Products
            .GroupBy(product => 1)
            .Select(group => new { Total = group.Count(), Active = group.Count(product => product.IsActive) })
            .SingleOrDefaultAsync(cancellationToken);

        var totalOrders = await _context.Orders.CountAsync(cancellationToken);

        return Ok(new DashboardSummaryDto
        {
            TotalCustomers = customers?.Total ?? 0,
            ActiveCustomers = customers?.Active ?? 0,
            TotalProducts = products?.Total ?? 0,
            ActiveProducts = products?.Active ?? 0,
            TotalOrders = totalOrders,
            TotalRevenue = null
        });
    }
}
