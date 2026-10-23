using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization;

namespace GemstoneShop.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class ProductsController : ControllerBase
    {
        private readonly GemstoneShopContext _context;
        private readonly IWebHostEnvironment _env;

        private static readonly string[] AllowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
        private const long MaxFileSizeBytes = 5 * 1024 * 1024; // 5MB / ảnh

        public ProductsController(GemstoneShopContext context, IWebHostEnvironment env)
        {
            _context = context;
            _env = env;
        }

        // GET /api/products
        // GET /api/products?search=ruby
        // GET /api/products?categoryId=1
        // GET /api/products?minPrice=100&maxPrice=500
        // Các điều kiện có thể kết hợp với nhau cùng lúc.
        [HttpGet]
        public async Task<ActionResult<IEnumerable<ProductDto>>> GetAll(
            [FromQuery] string? search,
            [FromQuery] int? categoryId,
            [FromQuery] decimal? minPrice,
            [FromQuery] decimal? maxPrice,
            [FromQuery] bool includeInactive = false)
        {
            if (includeInactive && !User.IsInRole("Admin")) return Forbid();

            var query = _context.Products
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Certificate)
                .AsQueryable();

            if (!includeInactive) query = query.Where(p => p.IsActive);

            if (!string.IsNullOrWhiteSpace(search))
            {
                query = query.Where(p => p.Name.Contains(search));
            }

            if (categoryId.HasValue)
            {
                query = query.Where(p => p.CategoryId == categoryId.Value);
            }

            if (minPrice.HasValue)
            {
                query = query.Where(p => p.Price >= minPrice.Value);
            }

            if (maxPrice.HasValue)
            {
                query = query.Where(p => p.Price <= maxPrice.Value);
            }

            var products = await query
                .OrderByDescending(p => p.CreatedAt)
                .ToListAsync();

            var result = products.Select(ToDto).ToList();

            return Ok(result);
        }

        // GET /api/products/5
        [HttpGet("{id}")]
        public async Task<ActionResult<ProductDto>> GetById(int id, [FromQuery] bool includeInactive = false)
        {
            if (includeInactive && !User.IsInRole("Admin")) return Forbid();

            var product = await _context.Products
                .Include(p => p.Category)
                .Include(p => p.ProductImages)
                .Include(p => p.Certificate)
                .FirstOrDefaultAsync(p => p.Id == id && (includeInactive || p.IsActive));

            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }

            return Ok(ToDto(product));
        }

        // POST /api/products
        [Authorize(Roles = "Admin")]
        [HttpPost]
        public async Task<ActionResult<ProductDto>> Create(ProductCreateDto dto)
        {
            var categoryExists = await _context.Categories.AnyAsync(c => c.Id == dto.CategoryId);
            if (!categoryExists)
            {
                return BadRequest(new { message = $"CategoryId = {dto.CategoryId} không tồn tại" });
            }

            var product = new Product
            {
                CategoryId = dto.CategoryId,
                Name = dto.Name,
                Description = dto.Description,
                Price = dto.Price,
                Stock = dto.Stock,
                Carat = dto.Carat,
                Color = dto.Color,
                Clarity = dto.Clarity,
                Cut = dto.Cut,
                Origin = dto.Origin,
                IsActive = dto.IsActive,
                CreatedAt = DateTime.UtcNow
            };

            _context.Products.Add(product);
            await _context.SaveChangesAsync();

            // Load lại kèm Category để trả DTO đầy đủ
            await _context.Entry(product).Reference(p => p.Category).LoadAsync();

            return CreatedAtAction(nameof(GetById), new { id = product.Id }, ToDto(product));
        }

        // PUT /api/products/5
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}")]
        public async Task<IActionResult> Update(int id, ProductUpdateDto dto)
        {
            var product = await _context.Products.FirstOrDefaultAsync(p => p.Id == id && p.IsActive);
            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }

            var categoryExists = await _context.Categories.AnyAsync(c => c.Id == dto.CategoryId);
            if (!categoryExists)
            {
                return BadRequest(new { message = $"CategoryId = {dto.CategoryId} không tồn tại" });
            }

            product.CategoryId = dto.CategoryId;
            product.Name = dto.Name;
            product.Description = dto.Description;
            product.Price = dto.Price;
            product.Stock = dto.Stock;
            product.Carat = dto.Carat;
            product.Color = dto.Color;
            product.Clarity = dto.Clarity;
            product.Cut = dto.Cut;
            product.Origin = dto.Origin;
            product.IsActive = dto.IsActive;
            product.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return NoContent();
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/status")]
        public async Task<IActionResult> UpdateStatus(int id, UpdateProductStatusRequest request)
        {
            if (!request.IsActive.HasValue)
                return BadRequest(new { message = "IsActive is required." });

            var product = await _context.Products.FindAsync(id);
            if (product == null)
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });

            product.IsActive = request.IsActive.Value;
            product.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // DELETE /api/products/5 — compatibility: stop selling, never remove history.
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}")]
        public async Task<IActionResult> Delete(int id)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }

            product.IsActive = false;
            product.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // PUT /api/products/5/certificate — tạo mới nếu sản phẩm chưa có chứng nhận, cập nhật nếu đã có
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/certificate")]
        public async Task<ActionResult<CertificateDto>> UpsertCertificate(int id, CertificateUpsertDto dto)
        {
            var product = await _context.Products
                .Include(p => p.Certificate)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }

            if (string.IsNullOrWhiteSpace(dto.CertificateNumber))
            {
                return BadRequest(new { message = "Số hiệu chứng nhận không được để trống." });
            }
            if (string.IsNullOrWhiteSpace(dto.Authority))
            {
                return BadRequest(new { message = "Đơn vị cấp không được để trống." });
            }

            var numberTaken = await _context.Certificates
                .AnyAsync(c => c.CertificateNumber == dto.CertificateNumber && c.ProductId != id);
            if (numberTaken)
            {
                return BadRequest(new { message = $"Số hiệu chứng nhận '{dto.CertificateNumber}' đã được dùng cho sản phẩm khác." });
            }

            if (product.Certificate == null)
            {
                product.Certificate = new Certificate { ProductId = id };
                _context.Certificates.Add(product.Certificate);
            }

            product.Certificate.CertificateNumber = dto.CertificateNumber;
            product.Certificate.Authority = dto.Authority;
            product.Certificate.IssueDate = dto.IssueDate;
            product.Certificate.CertificateUrl = dto.CertificateUrl;
            product.Certificate.Notes = dto.Notes;

            await _context.SaveChangesAsync();

            var c = product.Certificate;
            return Ok(new CertificateDto
            {
                Id = c.Id,
                CertificateNumber = c.CertificateNumber,
                Authority = c.Authority,
                IssueDate = c.IssueDate,
                CertificateUrl = c.CertificateUrl,
                Notes = c.Notes
            });
        }

        // DELETE /api/products/5/certificate
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}/certificate")]
        public async Task<IActionResult> DeleteCertificate(int id)
        {
            var product = await _context.Products
                .Include(p => p.Certificate)
                .FirstOrDefaultAsync(p => p.Id == id);

            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }
            if (product.Certificate == null)
            {
                return NotFound(new { message = "Sản phẩm này chưa có chứng nhận." });
            }

            _context.Certificates.Remove(product.Certificate);
            await _context.SaveChangesAsync();

            return NoContent();
        }

        // ── Quản lý ảnh sản phẩm ─────────────────────────────────

        // POST /api/products/5/images
        // multipart/form-data, field "files" — cho phép chọn nhiều ảnh cùng lúc
        [Authorize(Roles = "Admin")]
        [HttpPost("{id}/images")]
        [RequestSizeLimit(20_000_000)] // tổng tối đa 20MB / lần upload
        public async Task<ActionResult<List<ProductImageDto>>> UploadImages(int id, [FromForm] List<IFormFile> files)
        {
            var product = await _context.Products.FindAsync(id);
            if (product == null)
            {
                return NotFound(new { message = $"Không tìm thấy sản phẩm có id = {id}" });
            }

            if (files == null || files.Count == 0)
            {
                return BadRequest(new { message = "Chưa chọn file ảnh nào." });
            }

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                if (!AllowedExtensions.Contains(ext))
                {
                    return BadRequest(new { message = $"File '{file.FileName}' không đúng định dạng (chỉ nhận jpg, jpeg, png, webp)." });
                }
                if (file.Length == 0 || file.Length > MaxFileSizeBytes)
                {
                    return BadRequest(new { message = $"File '{file.FileName}' vượt quá dung lượng cho phép (tối đa 5MB)." });
                }
            }

            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var uploadDir = Path.Combine(webRoot, "uploads", "products", id.ToString());
            Directory.CreateDirectory(uploadDir);

            var hasPrimaryAlready = await _context.ProductImages.AnyAsync(pi => pi.ProductId == id && pi.IsPrimary);
            var nextSortOrder = await _context.ProductImages.Where(pi => pi.ProductId == id).CountAsync();

            var created = new List<ProductImage>();

            foreach (var file in files)
            {
                var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
                var fileName = $"{Guid.NewGuid():N}{ext}";
                var filePath = Path.Combine(uploadDir, fileName);

                using (var stream = new FileStream(filePath, FileMode.Create))
                {
                    await file.CopyToAsync(stream);
                }

                var image = new ProductImage
                {
                    ProductId = id,
                    ImageUrl = $"/uploads/products/{id}/{fileName}",
                    IsPrimary = !hasPrimaryAlready && created.Count == 0,
                    SortOrder = nextSortOrder++
                };

                created.Add(image);
                _context.ProductImages.Add(image);
            }

            await _context.SaveChangesAsync();

            var result = created.Select(i => new ProductImageDto
            {
                Id = i.Id,
                ImageUrl = i.ImageUrl,
                IsPrimary = i.IsPrimary,
                SortOrder = i.SortOrder
            }).ToList();

            return CreatedAtAction(nameof(GetById), new { id }, result);
        }

        // DELETE /api/products/5/images/12
        [Authorize(Roles = "Admin")]
        [HttpDelete("{id}/images/{imageId}")]
        public async Task<IActionResult> DeleteImage(int id, int imageId)
        {
            var image = await _context.ProductImages.FirstOrDefaultAsync(i => i.Id == imageId && i.ProductId == id);
            if (image == null)
            {
                return NotFound(new { message = $"Không tìm thấy ảnh id = {imageId} của sản phẩm id = {id}" });
            }

            var wasPrimary = image.IsPrimary;

            // Xóa file vật lý nếu tồn tại
            var webRoot = _env.WebRootPath ?? Path.Combine(Directory.GetCurrentDirectory(), "wwwroot");
            var relativePath = image.ImageUrl.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
            var fullPath = Path.Combine(webRoot, relativePath);
            if (System.IO.File.Exists(fullPath))
            {
                System.IO.File.Delete(fullPath);
            }

            _context.ProductImages.Remove(image);
            await _context.SaveChangesAsync();

            // Nếu vừa xóa ảnh đại diện, tự gán ảnh còn lại đầu tiên làm đại diện mới
            if (wasPrimary)
            {
                var nextImage = await _context.ProductImages
                    .Where(pi => pi.ProductId == id)
                    .OrderBy(pi => pi.SortOrder)
                    .FirstOrDefaultAsync();

                if (nextImage != null)
                {
                    nextImage.IsPrimary = true;
                    await _context.SaveChangesAsync();
                }
            }

            return NoContent();
        }

        // PUT /api/products/5/images/12/set-primary
        [Authorize(Roles = "Admin")]
        [HttpPut("{id}/images/{imageId}/set-primary")]
        public async Task<IActionResult> SetPrimaryImage(int id, int imageId)
        {
            var images = await _context.ProductImages.Where(pi => pi.ProductId == id).ToListAsync();
            var target = images.FirstOrDefault(i => i.Id == imageId);
            if (target == null)
            {
                return NotFound(new { message = $"Không tìm thấy ảnh id = {imageId} của sản phẩm id = {id}" });
            }

            foreach (var img in images)
            {
                img.IsPrimary = img.Id == imageId;
            }

            await _context.SaveChangesAsync();
            return NoContent();
        }

        // Hàm dùng chung để map Product (entity) -> ProductDto (trả về cho client)
        private static ProductDto ToDto(Product p)
        {
            return new ProductDto
            {
                Id = p.Id,
                CategoryId = p.CategoryId,
                CategoryName = p.Category?.Name ?? "",
                Name = p.Name,
                Description = p.Description,
                Price = p.Price,
                Stock = p.Stock,
                Carat = p.Carat,
                Color = p.Color,
                Clarity = p.Clarity,
                Cut = p.Cut,
                Origin = p.Origin,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                UpdatedAt = p.UpdatedAt,
                Images = p.ProductImages
                    .OrderBy(i => i.SortOrder)
                    .Select(i => new ProductImageDto
                    {
                        Id = i.Id,
                        ImageUrl = i.ImageUrl,
                        IsPrimary = i.IsPrimary,
                        SortOrder = i.SortOrder
                    }).ToList(),
                Certificate = p.Certificate == null ? null : new CertificateDto
                {
                    Id = p.Certificate.Id,
                    CertificateNumber = p.Certificate.CertificateNumber,
                    Authority = p.Certificate.Authority,
                    IssueDate = p.Certificate.IssueDate,
                    CertificateUrl = p.Certificate.CertificateUrl,
                    Notes = p.Certificate.Notes
                }
            };
        }
    }
}
