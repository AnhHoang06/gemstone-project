namespace GemstoneShop.DTOs;

public class AdminUserDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}
