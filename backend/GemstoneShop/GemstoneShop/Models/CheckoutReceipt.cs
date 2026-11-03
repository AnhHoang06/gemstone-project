namespace GemstoneShop.Models;

// Extension to the database-first model; persisted in the additive setup script.
public class CheckoutReceipt
{
    public int UserId { get; set; }
    public Guid RequestId { get; set; }
    public string RequestHash { get; set; } = "";
    public int OrderId { get; set; }
}
