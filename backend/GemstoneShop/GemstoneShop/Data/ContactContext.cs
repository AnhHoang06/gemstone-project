using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    public DbSet<ContactMessage> ContactMessages => Set<ContactMessage>();

    private static void ConfigureContacts(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<ContactMessage>(e =>
        {
            e.ToTable("ContactMessages", t => t.HasCheckConstraint("CK_ContactMessages_Status", "[Status] IN (N'New', N'InProgress', N'Resolved')"));
            e.HasKey(x => x.Id);
            e.Property(x => x.FullName).HasMaxLength(100).IsRequired();
            e.Property(x => x.Email).HasMaxLength(254).IsRequired();
            e.Property(x => x.Phone).HasMaxLength(20);
            e.Property(x => x.Subject).HasMaxLength(100).IsRequired();
            e.Property(x => x.Message).HasMaxLength(4000).IsRequired();
            e.Property(x => x.Status).HasMaxLength(20).HasDefaultValue("New").IsRequired();
            e.Property(x => x.AdminNote).HasMaxLength(2000);
            e.Property(x => x.CreatedAt).HasColumnType("datetime2").HasDefaultValueSql("SYSUTCDATETIME()");
            e.Property(x => x.UpdatedAt).HasColumnType("datetime2");
            e.HasIndex(x => new { x.Status, x.CreatedAt, x.Id }).HasDatabaseName("IX_ContactMessages_Status_CreatedAt");
            e.HasIndex(x => x.UserId);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
