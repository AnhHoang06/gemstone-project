namespace GemstoneShop.Models;

public partial class Order
{
    // Null identifies orders created before payment tracking was introduced.
    public string? PaymentMethod { get; set; }
    public string? PaymentStatus { get; set; }
    public DateTime? PaidAt { get; set; }
}
