using System.ComponentModel.DataAnnotations;

namespace GemstoneShop.DTOs;

public class CartQuantityRequest
{
    [Range(1, 10000)] public int Quantity { get; set; }
}

public class CheckoutRequest
{
    // Omission supports existing clients and their persisted idempotency requests.
    [RegularExpression("^(COD|BankTransfer)$")]
    public string? PaymentMethod { get; set; }
    [Required] public Guid? RequestId { get; set; }
    [Required, StringLength(100)] public string RecipientName { get; set; } = "";
    [Required, StringLength(20), Phone] public string RecipientPhone { get; set; } = "";
    [Required, StringLength(500)] public string ShippingAddress { get; set; } = "";
    [StringLength(500)] public string? Note { get; set; }
}

public class OrderStatusRequest
{
    [Required] public string Status { get; set; } = "";
}
