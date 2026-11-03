using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace GemstoneShop.Controllers;

[ApiController, TypeFilter(typeof(CommerceExceptionFilter))]
public class ReviewsController(GemstoneShopContext db) : ControllerBase {
    private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var id) ? id : 0;
    private Task<bool> Purchased(int productId, CancellationToken ct) => db.OrderDetails.AnyAsync(d =>
        d.ProductId==productId && d.Order.UserId==UserId && d.Order.Status.Name=="Completed", ct);

    [HttpGet("api/products/{productId:int}/reviews")]
    public async Task<IActionResult> List(int productId, CancellationToken ct, int? rating=null, string sort="newest", int page=1, int pageSize=10) {
        if (page<1 || page>100000 || pageSize<1 || pageSize>50 || rating is <1 or >5 ||
            !new[]{"newest","highest","lowest","helpful"}.Contains(sort)) return BadRequest(new {message="Bộ lọc đánh giá không hợp lệ."});
        if (!await db.Products.PubliclyVisible().AnyAsync(p=>p.Id==productId,ct)) return NotFound();
        var visible=db.ProductReviews.AsNoTracking().Where(r=>r.ProductId==productId && r.IsVisible);
        var distribution=await visible.GroupBy(r=>r.Rating).Select(g=>new {rating=g.Key,count=g.Count()}).ToListAsync(ct);
        var count=distribution.Sum(x=>x.count);
        var query=rating.HasValue?visible.Where(r=>r.Rating==rating.Value):visible;
        var total=await query.CountAsync(ct);
        var ordered=sort switch {
            "highest"=>query.OrderByDescending(r=>r.Rating).ThenByDescending(r=>r.Id),
            "lowest"=>query.OrderBy(r=>r.Rating).ThenByDescending(r=>r.Id),
            "helpful"=>query.OrderByDescending(r=>r.Votes.Count).ThenByDescending(r=>r.Id),
            _=>query.OrderByDescending(r=>r.CreatedAt).ThenByDescending(r=>r.Id)
        };
        var items=await ordered.Skip((page-1)*pageSize).Take(pageSize).Dtos(db,UserId).ToListAsync(ct);
        return Ok(new {items,total,page,pageSize,totalPages=(int)Math.Ceiling(total/(double)pageSize),
            totalVisible=count, averageRating=count==0?0:distribution.Sum(x=>x.rating*x.count)/(double)count,
            ratingDistribution=Enumerable.Range(1,5).Reverse().Select(n=>new {rating=n,count=distribution.FirstOrDefault(x=>x.rating==n)?.count??0})});
    }

    [Authorize(Roles="Customer"), HttpGet("api/products/{productId:int}/reviews/me")]
    public async Task<IActionResult> Mine(int productId, CancellationToken ct) {
        if (!await db.Products.AnyAsync(p=>p.Id==productId,ct)) return NotFound();
        return Ok(new {canReview=await Purchased(productId,ct),
            review=await db.ProductReviews.AsNoTracking().Where(r=>r.UserId==UserId && r.ProductId==productId).Dtos(db,UserId).SingleOrDefaultAsync(ct)});
    }

    [Authorize(Roles="Customer"), HttpPost("api/products/{productId:int}/reviews")]
    public Task<IActionResult> Create(int productId, ReviewRequest request, CancellationToken ct) => Save(productId, request, false, ct);
    [Authorize(Roles="Customer"), HttpPut("api/products/{productId:int}/reviews/me")]
    public Task<IActionResult> Edit(int productId, ReviewRequest request, CancellationToken ct) => Save(productId, request, true, ct);
    private async Task<IActionResult> Save(int productId, ReviewRequest request, bool edit, CancellationToken ct) {
        if (string.IsNullOrWhiteSpace(request.Content)) return BadRequest(new {message="Vui lòng nhập nội dung đánh giá."});
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"review-owner:{UserId}:{productId}",ct);
        if (!await Purchased(productId,ct)) return StatusCode(403,new {message="Chỉ khách hàng có đơn Hoàn tất chứa sản phẩm này mới được đánh giá."});
        var review=await db.ProductReviews.SingleOrDefaultAsync(r=>r.UserId==UserId && r.ProductId==productId,ct);
        if (!edit && review!=null) return Conflict(new {message="Bạn đã đánh giá sản phẩm. Vui lòng sửa đánh giá hiện có."});
        if (edit && review==null) return NotFound();
        if (review==null) {
            review=new ProductReview {UserId=UserId,ProductId=productId,CreatedAt=DateTime.UtcNow};
            db.ProductReviews.Add(review);
        } else review.UpdatedAt=DateTime.UtcNow;
        review.Rating=request.Rating; review.Content=request.Content.Trim();
        // Editing never clears moderation or resets CreatedAt.
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return Ok(await db.ProductReviews.Where(r=>r.Id==review.Id).Dtos(db,UserId).SingleAsync(ct));
    }

    [Authorize, HttpPut("api/reviews/{id:int}/helpful")]
    public Task<IActionResult> AddHelpful(int id, CancellationToken ct) => Helpful(id,true,ct);
    [Authorize, HttpDelete("api/reviews/{id:int}/helpful")]
    public Task<IActionResult> RemoveHelpful(int id, CancellationToken ct) => Helpful(id,false,ct);
    private async Task<IActionResult> Helpful(int id,bool add,CancellationToken ct) {
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"review:{id}",ct);
        var review=await db.ProductReviews.SingleOrDefaultAsync(r=>r.Id==id && r.IsVisible &&
            db.Products.PubliclyVisible().Any(p=>p.Id==r.ProductId),ct);
        if(review==null) return NotFound();
        if(review.UserId==UserId) return BadRequest(new {message="Bạn không thể bình chọn đánh giá của chính mình."});
        var vote=await db.ReviewHelpfulVotes.FindAsync(new object[]{id,UserId},ct);
        if(add && vote==null) db.ReviewHelpfulVotes.Add(new ReviewHelpfulVote {ReviewId=id,UserId=UserId,CreatedAt=DateTime.UtcNow});
        if(!add && vote!=null) db.ReviewHelpfulVotes.Remove(vote);
        await db.SaveChangesAsync(ct);
        var count=await db.ReviewHelpfulVotes.CountAsync(v=>v.ReviewId==id,ct);
        await tx.CommitAsync(ct); return Ok(new {helpfulCount=count,helpfulByMe=add});
    }
}
