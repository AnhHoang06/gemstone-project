using System.Security.Claims;
using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace GemstoneShop.Controllers;
[ApiController, Authorize(Roles="Admin"), Route("api/admin"), TypeFilter(typeof(CommerceExceptionFilter))]
public class AdminReviewsController(GemstoneShopContext db) : ControllerBase {
    [HttpGet("reviews")]
    public async Task<IActionResult> List(CancellationToken ct,string? search=null,int? rating=null,bool? visible=null,int page=1) {
        if(page<1 || page>100000 || rating is <1 or >5 || search?.Length>200) return BadRequest();
        var q=db.ProductReviews.AsNoTracking();
        if(!string.IsNullOrWhiteSpace(search)) q=q.Where(r=>r.Product.Name.Contains(search)||r.User.FullName.Contains(search));
        if(rating.HasValue) q=q.Where(r=>r.Rating==rating);
        if(visible.HasValue) q=q.Where(r=>r.IsVisible==visible);
        return Ok(new {total=await q.CountAsync(ct),page,items=await q.OrderByDescending(r=>r.CreatedAt).ThenByDescending(r=>r.Id)
            .Skip((page-1)*20).Take(20).Dtos(db,0).ToListAsync(ct)});
    }
    [HttpPut("reviews/{id:int}/visibility")]
    public async Task<IActionResult> Visibility(int id,VisibilityRequest request,CancellationToken ct) {
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"review:{id}",ct);
        var r=await db.ProductReviews.FindAsync(new object[]{id},ct);
        if(r==null) return NotFound();
        r.IsVisible=request.IsVisible!.Value; r.ModeratedAt=DateTime.UtcNow;
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return NoContent();
    }
    [HttpGet("questions")]
    public async Task<IActionResult> Questions(CancellationToken ct,int page=1,bool? visible=null,string? search=null) {
        if(page<1||page>100000||search?.Length>200) return BadRequest();
        var q=db.ProductQuestions.AsNoTracking();
        if(visible.HasValue) q=q.Where(q=>q.IsVisible==visible);
        if(!string.IsNullOrWhiteSpace(search)) q=q.Where(q=>q.Product.Name.Contains(search)||q.User.FullName.Contains(search));
        return Ok(new {total=await q.CountAsync(ct),page,items=await q.OrderByDescending(q=>q.Id).Skip((page-1)*20).Take(20)
            .Select(q=>new {q.Id,q.ProductId,productName=q.Product.Name,customerName=q.User.FullName,q.Content,q.IsVisible,q.CreatedAt,q.ModeratedAt,
                answer=q.Answer==null?null:new {q.Answer.Content,q.Answer.CreatedAt,q.Answer.UpdatedAt}}).ToListAsync(ct)});
    }
    [HttpPut("questions/{id:int}/visibility")]
    public async Task<IActionResult> QuestionVisibility(int id,VisibilityRequest request,CancellationToken ct) {
        var q=await db.ProductQuestions.FindAsync(new object[]{id},ct);
        if(q==null) return NotFound();
        q.IsVisible=request.IsVisible!.Value; q.ModeratedAt=DateTime.UtcNow;
        await db.SaveChangesAsync(ct); return NoContent();
    }
    [HttpPut("questions/{id:int}/answer")]
    public async Task<IActionResult> Answer(int id,EngagementContentRequest request,CancellationToken ct) {
        if(string.IsNullOrWhiteSpace(request.Content)) return BadRequest(new {message="Vui lòng nhập phản hồi."});
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"question:{id}",ct);
        if(!await db.ProductQuestions.AnyAsync(q=>q.Id==id,ct)) return NotFound();
        var a=await db.ProductAnswers.SingleOrDefaultAsync(a=>a.QuestionId==id,ct);
        if(a==null) {a=new ProductAnswer{QuestionId=id,CreatedAt=DateTime.UtcNow};db.ProductAnswers.Add(a);}
        else a.UpdatedAt=DateTime.UtcNow;
        a.AdminUserId=int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!); a.Content=request.Content.Trim();
        await db.SaveChangesAsync(ct);await tx.CommitAsync(ct);return NoContent();
    }
    [HttpGet("reviews/analytics")]
    public async Task<IActionResult> Analytics(CancellationToken ct,DateTime? from=null,DateTime? to=null) {
        if(from>to) return BadRequest();
        var q=db.ProductReviews.AsNoTracking().Where(r=>r.IsVisible);
        var period=q;
        if(from.HasValue) period=period.Where(r=>r.CreatedAt>=from);
        if(to.HasValue) period=period.Where(r=>r.CreatedAt<to);
        var grouped=period.GroupBy(r=>new {r.ProductId,r.Product.Name}).Select(g=>new {g.Key.ProductId,g.Key.Name,count=g.Count(),average=g.Average(r=>(double)r.Rating)});
        return Ok(new {totalVisible=await q.CountAsync(ct),hiddenCount=await db.ProductReviews.CountAsync(r=>!r.IsVisible,ct),
            periodCount=await period.CountAsync(ct),averageRating=await period.Select(r=>(double?)r.Rating).AverageAsync(ct)??0,
            distribution=await period.GroupBy(r=>r.Rating).Select(g=>new {rating=g.Key,count=g.Count()}).ToListAsync(ct),
            highest=await grouped.Where(g=>g.count>=3).OrderByDescending(g=>g.average).ThenByDescending(g=>g.count).ThenBy(g=>g.ProductId).Take(5).ToListAsync(ct),
            lowest=await grouped.Where(g=>g.count>=3).OrderBy(g=>g.average).ThenByDescending(g=>g.count).ThenBy(g=>g.ProductId).Take(5).ToListAsync(ct),
            mostReviewed=await grouped.OrderByDescending(g=>g.count).ThenBy(g=>g.ProductId).Take(5).ToListAsync(ct),
            latest=await period.OrderByDescending(r=>r.Id).Take(5).Dtos(db,0).ToListAsync(ct)});
    }
}
