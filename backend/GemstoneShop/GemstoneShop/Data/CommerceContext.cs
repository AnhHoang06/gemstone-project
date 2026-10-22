using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    public DbSet<CheckoutReceipt> CheckoutReceipts => Set<CheckoutReceipt>();

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<CheckoutReceipt>(entity =>
        {
            entity.ToTable("CheckoutReceipts");
            entity.HasKey(x => new { x.UserId, x.RequestId });
            entity.Property(x => x.RequestHash).HasMaxLength(64).IsUnicode(false);
            entity.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne<Order>().WithMany().HasForeignKey(x => x.OrderId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
