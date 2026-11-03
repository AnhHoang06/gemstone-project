using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;
namespace GemstoneShop.Data;
public partial class GemstoneShopContext
{
    public DbSet<ProductReview> ProductReviews => Set<ProductReview>();
    public DbSet<ReviewImage> ReviewImages => Set<ReviewImage>();
    public DbSet<ReviewHelpfulVote> ReviewHelpfulVotes => Set<ReviewHelpfulVote>();
    public DbSet<ProductQuestion> ProductQuestions => Set<ProductQuestion>();
    public DbSet<ProductAnswer> ProductAnswers => Set<ProductAnswer>();
    private static void ConfigureReviews(ModelBuilder m)
    {
        m.Entity<ProductReview>(e => {
            e.ToTable("ProductReviews", t => t.HasCheckConstraint("CK_ProductReviews_Rating", "[Rating] BETWEEN 1 AND 5"));
            e.HasKey(x => x.Id); e.HasIndex(x => new { x.UserId, x.ProductId }).IsUnique();
            e.Property(x => x.Content).HasMaxLength(2000);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.NoAction);
        });
        m.Entity<ReviewImage>(e => {
            e.ToTable("ReviewImages", t => t.HasCheckConstraint("CK_ReviewImages_Slot", "[SortOrder] BETWEEN 0 AND 2")); e.HasKey(x => x.Id);
            e.HasIndex(x => new { x.ReviewId, x.SortOrder }).IsUnique(); e.Property(x => x.FileName).HasMaxLength(40);
            e.HasOne(x => x.Review).WithMany(x => x.Images).HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.NoAction);
        });
        m.Entity<ReviewHelpfulVote>(e => {
            e.ToTable("ReviewHelpfulVotes"); e.HasKey(x => new { x.ReviewId, x.UserId });
            e.HasOne(x => x.Review).WithMany(x => x.Votes).HasForeignKey(x => x.ReviewId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
        });
        m.Entity<ProductQuestion>(e => {
            e.ToTable("ProductQuestions"); e.HasKey(x => x.Id); e.Property(x => x.Content).HasMaxLength(2000);
            e.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne(x => x.Product).WithMany().HasForeignKey(x => x.ProductId).OnDelete(DeleteBehavior.NoAction);
        });
        m.Entity<ProductAnswer>(e => {
            e.ToTable("ProductAnswers"); e.HasKey(x => x.Id); e.Property(x => x.Content).HasMaxLength(2000);
            e.HasOne(x => x.Question).WithOne(x => x.Answer).HasForeignKey<ProductAnswer>(x => x.QuestionId).OnDelete(DeleteBehavior.NoAction);
            e.HasOne<User>().WithMany().HasForeignKey(x => x.AdminUserId).OnDelete(DeleteBehavior.NoAction);
        });
    }
}
