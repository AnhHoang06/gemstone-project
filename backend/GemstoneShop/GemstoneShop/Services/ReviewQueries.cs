using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
namespace GemstoneShop.Services;
public static class ReviewQueries {
    public static IQueryable<ReviewDto> Dtos(this IQueryable<ProductReview> q, GemstoneShopContext db, int userId) =>
        q.Select(r => new ReviewDto {
            Id=r.Id, ProductId=r.ProductId, ProductName=r.Product.Name, CustomerName=r.User.FullName,
            Rating=r.Rating, Content=r.Content, IsVisible=r.IsVisible, CreatedAt=r.CreatedAt,
            UpdatedAt=r.UpdatedAt, ModeratedAt=r.ModeratedAt, IsOwn=r.UserId==userId,
            VerifiedPurchase=db.OrderDetails.Any(d=>d.ProductId==r.ProductId && d.Order.UserId==r.UserId && d.Order.Status.Name=="Completed"),
            HelpfulCount=r.Votes.Count, HelpfulByMe=r.Votes.Any(v=>v.UserId==userId),
            Images=r.Images.OrderBy(i=>i.SortOrder).Select(i=>new ReviewImageDto { Id=i.Id, ImageUrl="/api/review-images/"+i.Id }).ToList()
        });
}
