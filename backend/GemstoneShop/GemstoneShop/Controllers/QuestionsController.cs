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
public class QuestionsController(GemstoneShopContext db) : ControllerBase {
    private int UserId => int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
    [HttpGet("api/products/{productId:int}/questions")]
    public async Task<IActionResult> List(int productId,CancellationToken ct,int page=1) {
        if(page<1 || page>100000) return BadRequest();
        if(!await db.Products.PubliclyVisible().AnyAsync(p=>p.Id==productId,ct)) return NotFound();
        var q=db.ProductQuestions.AsNoTracking().Where(q=>q.ProductId==productId && q.IsVisible);
        return Ok(new {total=await q.CountAsync(ct),page,items=await q.OrderByDescending(q=>q.Id).Skip((page-1)*10).Take(10)
            .Select(q=>new {q.Id,q.Content,q.CreatedAt,customerName=q.User.FullName,
                answer=q.Answer==null?null:new {q.Answer.Content,q.Answer.CreatedAt,q.Answer.UpdatedAt}}).ToListAsync(ct)});
    }
    [Authorize(Roles="Customer"), HttpPost("api/products/{productId:int}/questions")]
    public async Task<IActionResult> Ask(int productId,EngagementContentRequest request,CancellationToken ct) {
        if(string.IsNullOrWhiteSpace(request.Content)) return BadRequest(new {message="Vui lòng nhập câu hỏi."});
        if(!await db.Products.PubliclyVisible().AnyAsync(p=>p.Id==productId,ct)) return NotFound();
        var q=new ProductQuestion {UserId=UserId,ProductId=productId,Content=request.Content.Trim(),CreatedAt=DateTime.UtcNow};
        db.ProductQuestions.Add(q); await db.SaveChangesAsync(ct);
        return Ok(new {q.Id});
    }
}
