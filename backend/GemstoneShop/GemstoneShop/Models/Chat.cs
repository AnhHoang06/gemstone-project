namespace GemstoneShop.Models;

// Extensions to the database-first model; persisted by Database/Chat.sql.
public class ChatConversation
{
    public const string Open = "Open", Closed = "Closed";
    public int Id { get; set; }
    public int CustomerId { get; set; }
    public string Status { get; set; } = Open;
    public DateTime LastMessageAt { get; set; }
    public long CustomerLastReadId { get; set; }
    public long StaffLastReadId { get; set; }
    public DateTime CreatedAt { get; set; }
    public User Customer { get; set; } = null!;
    public ICollection<ChatMessage> Messages { get; set; } = new List<ChatMessage>();
}

public class ChatMessage
{
    public const string Customer = "Customer", Staff = "Staff";
    public long Id { get; set; }
    public int ConversationId { get; set; }
    public int SenderUserId { get; set; }
    public string SenderRole { get; set; } = Customer;
    /// <summary>Plain text. Never rendered as HTML.</summary>
    public string Body { get; set; } = "";
    public int? ProductId { get; set; }
    public Guid ClientMessageId { get; set; }
    public DateTime CreatedAt { get; set; }
    public ChatConversation Conversation { get; set; } = null!;
    public Product? Product { get; set; }
}
