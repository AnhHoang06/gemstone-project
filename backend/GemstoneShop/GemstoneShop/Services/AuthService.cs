using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;

namespace GemstoneShop.Services
{
    
    public class AuthService
    {
        private readonly GemstoneShopContext _context;
        private readonly IConfiguration _configuration;

        public AuthService(GemstoneShopContext context, IConfiguration configuration)
        {
            _context = context;
            _configuration = configuration;
        }

        private string CreateToken(User user) //Tao Token cho user khi dang nhap thanh cong
        {
            var jwt = _configuration.GetSection("Jwt");

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(ClaimTypes.Name, user.FullName),
                new Claim(ClaimTypes.Email, user.Email),
                new Claim(ClaimTypes.Role, user.Role.Name)
            };

            var key = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwt["Key"]!)
            );

            var credentials = new SigningCredentials(
                key,
                SecurityAlgorithms.HmacSha256
            );

            var token = new JwtSecurityToken(
                issuer: jwt["Issuer"],
                audience: jwt["Audience"],
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(
                    double.Parse(jwt["ExpireMinutes"]!)
                ),
                signingCredentials: credentials
            );

            return new JwtSecurityTokenHandler().WriteToken(token);
        }
        public async Task<AuthResponse?> LoginAsync(LoginRequest request) //Dang nhap va tra ve token neu thanh cong
        {
            var user = await _context.Users
                .Include(u => u.Role)
                .FirstOrDefaultAsync(u => u.Email == request.Email);

            if (user == null || !user.IsActive)
            {
                return null;
            }

            var validPassword = BCrypt.Net.BCrypt.Verify(
                request.Password,
                user.PasswordHash
            );

            if (!validPassword)
            {
                return null;
            }

            var token = CreateToken(user);

            return new AuthResponse
            {
                Token = token,
                UserId = user.Id,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role.Name
            };
        }
        public async Task<bool> RegisterAsync(RegisterRequest request) //Dang ky tai khoan moi
        {
            var exists = await _context.Users
                .AnyAsync(u => u.Email == request.Email);

            if (exists)
            {
                return false;
            }

            var customerRole = await _context.Roles.FirstOrDefaultAsync(r => r.Name == "Customer");

            if (customerRole == null)
            {
                throw new Exception("Customer role not found");
            }

            var user = new User
            {
                RoleId = customerRole.Id,
                FullName = request.FullName,
                Email = request.Email,
                PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
                Phone = request.Phone,
                Address = request.Address,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            _context.Users.Add(user);
            await _context.SaveChangesAsync();

            return true;
        }
        
    }
}