using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    public DbSet<WishlistItem> WishlistItems => Set<WishlistItem>();

    private static void ConfigureWishlist(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<WishlistItem>(entity =>
        {
            entity.ToTable("WishlistItems");
            entity.HasKey(x => new { x.UserId, x.ProductId });
            entity.Property(x => x.CreatedAt).HasDefaultValueSql("sysutcdatetime()");
            entity.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
