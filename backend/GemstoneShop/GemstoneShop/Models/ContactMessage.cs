namespace GemstoneShop.Models;

// Handwritten Database First extension; schema source: Database/ContactMessages.sql.
public partial class ContactMessage
{
    public int Id { get; set; }
    public int? UserId { get; set; }
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Phone { get; set; }
    public string Subject { get; set; } = "";
    public string Message { get; set; } = "";
    public string Status { get; set; } = "New";
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public string? AdminNote { get; set; }
}
