using GemstoneShop.DTOs;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Mvc;

namespace GemstoneShop.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase
    {
        private readonly AuthService _authService;

        public AuthController(AuthService authService)
        {
            _authService = authService;
        }

        [HttpPost("register")]
        public async Task<IActionResult> Register(RegisterRequest request)
        {
            var success = await _authService.RegisterAsync(request);

            if (!success)
            {
                return BadRequest(new
                {
                    message = "Email already exists"
                });
            }

            return Ok(new
            {
                message = "Register successful"
            });
        }
        [HttpPost("login")]
        public async Task<IActionResult> Login(LoginRequest request)
        {
            var result = await _authService.LoginAsync(request);

            if (result == null)
            {
                return Unauthorized(new
                {
                    message = "Invalid email or password"
                });
            }

            return Ok(result);
        }
    }

}