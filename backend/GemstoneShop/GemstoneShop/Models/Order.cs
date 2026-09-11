using System;
using System.Collections.Generic;

namespace GemstoneShop.Models;

public partial class Order
{
    public int Id { get; set; }

    public int UserId { get; set; }

    public int StatusId { get; set; }

    public string RecipientName { get; set; } = null!;

    public string RecipientPhone { get; set; } = null!;

    public string ShippingAddress { get; set; } = null!;

    public decimal TotalAmount { get; set; }

    public string? Note { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public virtual ICollection<OrderDetail> OrderDetails { get; set; } = new List<OrderDetail>();

    public virtual OrderStatus Status { get; set; } = null!;

    public virtual User User { get; set; } = null!;
}
