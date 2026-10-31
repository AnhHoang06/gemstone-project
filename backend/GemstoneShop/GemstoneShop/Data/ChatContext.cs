using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    public DbSet<ChatConversation> ChatConversations => Set<ChatConversation>();
    public DbSet<ChatMessage> ChatMessages => Set<ChatMessage>();

    private static void ConfigureChat(ModelBuilder m)
    {
        m.Entity<ChatConversation>(e =>
        {
            e.ToTable("ChatConversations");
            e.HasKey(x => x.Id);
            e.HasIndex(x => x.CustomerId).IsUnique();
            e.Property(x => x.Status).HasMaxLength(10).IsUnicode(false);
            e.Property(x => x.LastMessageAt).HasColumnType("datetime2").HasConversion(UtcConverter);
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasConversion(UtcConverter);
            e.HasOne(x => x.Customer).WithMany().HasForeignKey(x => x.CustomerId).OnDelete(DeleteBehavior.NoAction);
        });
        m.Entity<ChatMessage>(e =>
        {
            e.ToTable("ChatMessages");
            e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ConversationId, x.ClientMessageId }).IsUnique();
            e.HasIndex(x => new { x.ConversationId, x.Id });
            e.Property(x => x.SenderRole).HasMaxLength(10).IsUnicode(false);
            e.Property(x => x.Body).HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasConversion(UtcConverter);
            e.HasOne(x => x.Conversation).WithMany(x => x.Messages).HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.SenderUserId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
