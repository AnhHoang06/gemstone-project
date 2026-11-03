namespace GemstoneShop.DTOs;

public class ChatSendRequest
{
    public Guid? ClientMessageId { get; set; }
    public string? Body { get; set; }
    public int? ProductId { get; set; }
}

public class ChatReadRequest
{
    public long? LastMessageId { get; set; }
}

public class ChatStatusRequest
{
    public string? Status { get; set; }
}

public class ChatProductDto
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public decimal Price { get; set; }
    public string? ImageUrl { get; set; }
    public bool IsAvailable { get; set; }
}

public class ChatMessageDto
{
    public long Id { get; set; }
    public int ConversationId { get; set; }
    /// <summary>Customer | Staff</summary>
    public string SenderRole { get; set; } = "";
    /// <summary>Plain text; render as text only.</summary>
    public string Body { get; set; } = "";
    public int? ProductId { get; set; }
    public ChatProductDto? Product { get; set; }
    public Guid ClientMessageId { get; set; }
    public DateTime CreatedAt { get; set; }
}
