using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class CategoriesController : ControllerBase
    {
        private readonly GemstoneShopContext _context;

        public CategoriesController(GemstoneShopContext context)
        {
            _context = context;
        }

        // GET /api/categories
        [HttpGet]
        public async Task<ActionResult<IEnumerable<CategoryDto>>> GetAll()
        {
            var categories = await _context.Categories.ToListAsync();
            var result = categories.Select(ToDto).ToList();
            return Ok(result);
        }

        // GET /api/categories/5
        [HttpGet("{id}")]
        public async Task<ActionResult<CategoryDto>> GetById(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { message = $"Không tìm thấy category có id = {id}" });
            }

            return Ok(ToDto(category));
        }

        // POST /api/categories
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<CategoryDto>> Create(CategoryCreateDto dto)
        {
            var nameExists = await _context.Categories.AnyAsync(c => c.Name == dto.Name);
            if (nameExists)
            {
                return BadRequest(new { message = $"Category tên '{dto.Name}' đã tồn tại" });
            }

            var category = new Category
            {
                Name = dto.Name,
                Description = dto.Description,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Categories.Add(category);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetById), new { id = category.Id }, ToDto(category));
        }

        // PUT /api/categories/5
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, CategoryCreateDto dto)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { message = $"Không tìm thấy category có id = {id}" });
            }

            var nameTaken = await _context.Categories
                .AnyAsync(c => c.Name == dto.Name && c.Id != id);
            if (nameTaken)
            {
                return BadRequest(new { message = $"Category tên '{dto.Name}' đã tồn tại" });
            }

            category.Name = dto.Name;
            category.Description = dto.Description;
            category.IsActive = dto.IsActive;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        // DELETE /api/categories/5
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var category = await _context.Categories.FindAsync(id);
            if (category == null)
            {
                return NotFound(new { message = $"Không tìm thấy category có id = {id}" });
            }

            var hasProducts = await _context.Products.AnyAsync(p => p.CategoryId == id);
            if (hasProducts)
            {
                return BadRequest(new { message = "Không thể xóa danh mục còn sản phẩm, kể cả sản phẩm đã ngừng bán. Hãy chuyển sản phẩm sang danh mục khác trước." });
            }

            _context.Categories.Remove(category);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        private static CategoryDto ToDto(Category c)
        {
            return new CategoryDto
            {
                Id = c.Id,
                Name = c.Name,
                Description = c.Description,
                IsActive = c.IsActive,
                CreatedAt = c.CreatedAt
            };
        }
    }
}
