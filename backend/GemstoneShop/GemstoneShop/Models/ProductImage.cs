using System;
using System.Collections.Generic;

namespace GemstoneShop.Models;

public partial class ProductImage
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public string ImageUrl { get; set; } = null!;

    public bool IsPrimary { get; set; }

    public int SortOrder { get; set; }

    public virtual Product Product { get; set; } = null!;
}
