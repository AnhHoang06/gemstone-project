using System;
using System.Collections.Generic;

namespace GemstoneShop.Models;

public partial class Certificate
{
    public int Id { get; set; }

    public int ProductId { get; set; }

    public string CertificateNumber { get; set; } = null!;

    public string Authority { get; set; } = null!;

    public DateOnly? IssueDate { get; set; }

    public string? CertificateUrl { get; set; }

    public string? Notes { get; set; }

    public virtual Product Product { get; set; } = null!;
}
