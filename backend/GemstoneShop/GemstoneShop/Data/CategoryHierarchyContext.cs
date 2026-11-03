using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Data;

public partial class GemstoneShopContext
{
    private static void ConfigureCategoryHierarchy(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<Category>(entity =>
        {
            entity.HasOne(c => c.Parent).WithMany(c => c.Children).HasForeignKey(c => c.ParentId).OnDelete(DeleteBehavior.NoAction);
            entity.Property(c => c.SortOrder).HasDefaultValue(0);
        });
        // SQL scripts own schema/index changes. No migrations are generated here.
        modelBuilder.Entity<Product>().Property(p => p.SearchName).HasMaxLength(200);
    }
}
