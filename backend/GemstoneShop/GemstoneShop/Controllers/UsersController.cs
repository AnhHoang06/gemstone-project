using GemstoneShop.Data;
using GemstoneShop.DTOs;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace GemstoneShop.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class UsersController : ControllerBase
    {
        private readonly GemstoneShopContext _context;

        public UsersController(GemstoneShopContext context)
        {
            _context = context;
        }

        private IQueryable<AdminUserDto> AdminUsers() => _context.Users
            .AsNoTracking()
            .Select(user => new AdminUserDto
            {
                Id = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Phone = user.Phone,
                Address = user.Address,
                Role = user.Role.Name,
                IsActive = user.IsActive
            });

        [Authorize(Roles = "Admin")]
        [HttpGet]
        public async Task<ActionResult<List<AdminUserDto>>> GetUsers()
        {
            return Ok(await AdminUsers().OrderBy(user => user.Id).ToListAsync());
        }

        [Authorize(Roles = "Admin")]
        [HttpGet("{id:int}")]
        public async Task<ActionResult<AdminUserDto>> GetUser(int id)
        {
            var user = await AdminUsers().FirstOrDefaultAsync(user => user.Id == id);
            if (user == null)
                return NotFound(new { message = "User not found." });
            return Ok(user);
        }

        [Authorize(Roles = "Admin")]
        [HttpPut("{id:int}/status")]
        public async Task<ActionResult<AdminUserDto>> UpdateStatus(int id, UpdateUserStatusRequest request)
        {
            if (!int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var currentUserId))
                return Unauthorized();
            if (!request.IsActive.HasValue)
                return BadRequest(new { message = "IsActive is required." });
            if (id == currentUserId && !request.IsActive.Value)
                return BadRequest(new { message = "You cannot deactivate your own account." });

            var user = await _context.Users.FindAsync(id);
            if (user == null)
                return NotFound(new { message = "User not found." });

            user.IsActive = request.IsActive.Value;
            await _context.SaveChangesAsync();
            return Ok(await AdminUsers().SingleAsync(user => user.Id == id));
        }

        [Authorize]
        [HttpGet("me")]
        public async Task<IActionResult> GetMe()
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (userId == null)
            {
                return Unauthorized();
            }

            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Id == int.Parse(userId));

            if (user == null)
            {
                return NotFound();
            }

            return Ok(new
            {
                user.Id,
                user.FullName,
                user.Email,
                user.Phone,
                user.Address,
                Role = user.Role.Name
            });
        }
        [Authorize]
        [HttpPut("me")]
        public async Task<IActionResult> UpdateMe(UpdateProfileRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (userId == null)
            {
                return Unauthorized();
            }

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == int.Parse(userId));

            if (user == null)
            {
                return NotFound();
            }

            user.FullName = request.FullName;
            user.Phone = request.Phone;
            user.Address = request.Address;
            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Profile updated successfully"
            });
        }
        [Authorize]
        [HttpPut("me/password")]
        public async Task<IActionResult> ChangePassword(ChangePasswordRequest request)
        {
            var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (userId == null)
                return Unauthorized();

            var user = await _context.Users
                .FirstOrDefaultAsync(u => u.Id == int.Parse(userId));

            if (user == null)
                return NotFound();

            var validPassword = BCrypt.Net.BCrypt.Verify(
                request.CurrentPassword,
                user.PasswordHash
            );

            if (!validPassword)
            {
                return BadRequest(new
                {
                    message = "Current password is incorrect"
                });
            }

            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(
                request.NewPassword
            );

            user.UpdatedAt = DateTime.UtcNow;

            await _context.SaveChangesAsync();

            return Ok(new
            {
                message = "Password changed successfully"
            });
        }
    }
}
