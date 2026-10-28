using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers;

[Route("api/categories"), ApiController]
[TypeFilter(typeof(CommerceExceptionFilter))]
public class CategoriesController(GemstoneShopContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(bool includeInactive = false)
    {
        if (includeInactive && !User.IsInRole("Admin")) return Forbid();
        var query = db.Categories.AsNoTracking();
        if (!includeInactive) query = query.PubliclyVisible();
        return Ok((await query.OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync()).Select(ToDto));
    }

    [HttpGet("tree")]
    public async Task<IActionResult> Tree()
    {
        var categories = await db.Categories.AsNoTracking().PubliclyVisible().OrderBy(c => c.SortOrder).ThenBy(c => c.Name).ToListAsync();
        object[] Children(int? parent) => categories.Where(c => c.ParentId == parent).Select(c => (object)new
        { c.Id, c.Name, c.ParentId, c.SortOrder, children = Children(c.Id) }).ToArray();
        return Ok(Children(null));
    }

    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetById(int id, bool includeInactive = false)
    {
        if (includeInactive && !User.IsInRole("Admin")) return Forbid();
        var query = db.Categories.AsNoTracking();
        if (!includeInactive) query = query.PubliclyVisible();
        var category = await query.SingleOrDefaultAsync(c => c.Id == id);
        return category == null ? NotFound(new { message = "Không tìm thấy danh mục." }) : Ok(ToDto(category));
    }

    [Authorize(Roles = "Admin"), HttpPost]
    public Task<IActionResult> Create(CategoryCreateDto dto, CancellationToken ct) => Save(null, dto, ct);
    [Authorize(Roles = "Admin"), HttpPut("{id:int}")]
    public Task<IActionResult> Update(int id, CategoryUpdateDto dto, CancellationToken ct) => Save(id, dto.ToCreateDto(), ct);

    private async Task<IActionResult> Save(int? id, CategoryCreateDto dto, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        // Serialize tree validation and writes across backend instances.
        await CommerceLock.Acquire(db, "category-hierarchy", ct);
        var all = await db.Categories.ToListAsync(ct);
        var category = id.HasValue ? all.SingleOrDefault(c => c.Id == id) : new Category { CreatedAt = DateTime.UtcNow };
        if (category == null) return NotFound(new { message = "Không tìm thấy danh mục." });
        if (dto.ParentId.HasValue && !all.Any(c => c.Id == dto.ParentId)) return BadRequest(new { message = "Danh mục cha không tồn tại." });
        var name = dto.Name.Trim();
        // `all` is already loaded under the hierarchy lock; mirror the CI column collation (and its trailing-space rule).
        if (all.Any(c => c.ParentId == dto.ParentId && c.Id != id && string.Equals(c.Name.TrimEnd(), name, StringComparison.InvariantCultureIgnoreCase)))
            return BadRequest(new { message = "Tên danh mục đã tồn tại trong cùng danh mục cha." });
        var candidate = id ?? -1;
        var parents = all.ToDictionary(c => c.Id, c => c.ParentId);
        parents[candidate] = dto.ParentId;
        foreach (var start in parents.Keys)
        {
            var seen = new HashSet<int>();
            int? current = start;
            while (current.HasValue)
            {
                if (!seen.Add(current.Value)) return BadRequest(new { message = "Danh mục không được tạo vòng lặp." });
                if (seen.Count > 3) return BadRequest(new { message = "Danh mục chỉ hỗ trợ tối đa 3 cấp." });
                current = parents[current.Value];
            }
        }
        category.Name = name; category.Description = dto.Description;
        category.IsActive = dto.IsActive; category.ParentId = dto.ParentId; category.SortOrder = dto.SortOrder;
        if (!id.HasValue) db.Categories.Add(category);
        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
        return id.HasValue ? NoContent() : CreatedAtAction(nameof(GetById), new { id = category.Id }, ToDto(category));
    }

    [Authorize(Roles = "Admin"), HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db, "category-hierarchy", ct);
        var category = await db.Categories.FindAsync([id], ct);
        if (category == null) return NotFound();
        if (await db.Categories.AnyAsync(c => c.ParentId == id, ct)) return BadRequest(new { message = "Không thể xóa danh mục còn danh mục con." });
        if (await db.Products.AnyAsync(p => p.CategoryId == id, ct)) return BadRequest(new { message = "Không thể xóa danh mục còn sản phẩm, kể cả sản phẩm đã ngừng bán." });
        db.Categories.Remove(category); await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return NoContent();
    }
    private static CategoryDto ToDto(Category c) => new() { Id = c.Id, Name = c.Name, Description = c.Description, IsActive = c.IsActive,
        CreatedAt = c.CreatedAt, ParentId = c.ParentId, SortOrder = c.SortOrder };
}
