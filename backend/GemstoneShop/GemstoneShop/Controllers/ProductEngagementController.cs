using GemstoneShop.Data;
using GemstoneShop.DTOs;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace GemstoneShop.Controllers;
[ApiController]
public class ProductEngagementController(GemstoneShopContext db) : ControllerBase {
    private static IQueryable<CatalogProductDto> Cards(IQueryable<Product> q) => q.Select(p=>new CatalogProductDto(
        p.Id,p.Name,p.CategoryId,p.Category.Name,p.Price,p.Stock,p.Carat,p.Color,p.Clarity,p.Cut,p.Origin,
        p.Certificate==null?null:p.Certificate.Authority,
        p.ProductImages.OrderByDescending(i=>i.IsPrimary).ThenBy(i=>i.SortOrder).ThenBy(i=>i.Id).Select(i=>i.ImageUrl).FirstOrDefault()));
    [HttpGet("api/products/{id:int}/related")]
    public async Task<IActionResult> Related(int id,CancellationToken ct) {
        var product=await db.Products.PubliclyVisible().Where(p=>p.Id==id)
            .Select(p=>new {p.Id,p.CategoryId,p.Price,root=p.Category.Parent==null?p.CategoryId:(p.Category.Parent.ParentId??p.Category.ParentId!.Value)}).SingleOrDefaultAsync(ct);
        if(product==null) return NotFound();
        var q=db.Products.PubliclyVisible().Where(p=>p.Id!=id)
            .OrderBy(p=>p.CategoryId==product.CategoryId?0:(p.Category.Parent==null?p.CategoryId:(p.Category.Parent.ParentId??p.Category.ParentId!.Value))==product.root?1:2)
            .ThenBy(p=>Math.Abs(p.Price-product.Price)).ThenBy(p=>p.Id).Take(4);
        return Ok(await Cards(q).ToListAsync(ct));
    }
    [HttpGet("api/products/top-rated")]
    public async Task<IActionResult> Top(CancellationToken ct) {
        var ratings=db.ProductReviews.Where(r=>r.IsVisible).GroupBy(r=>r.ProductId)
            .Select(g=>new {id=g.Key,count=g.Count(),average=g.Average(r=>(double)r.Rating)}).Where(g=>g.count>=3);
        var ranked=await (from p in db.Products.PubliclyVisible() join r in ratings on p.Id equals r.id
            orderby r.average descending,r.count descending,p.Id
            select new {p.Id,r.count,r.average}).Take(4).ToListAsync(ct);
        var ids=ranked.Select(r=>r.Id).ToArray();
        var cards=await Cards(db.Products.PubliclyVisible().Where(p=>ids.Contains(p.Id))).ToListAsync(ct);
        return Ok(ranked.Join(cards,r=>r.Id,p=>p.Id,(r,p)=>new {product=p,averageRating=r.average,reviewCount=r.count}));
    }
    [HttpGet("api/products/recent")]
    public async Task<IActionResult> Recent(CancellationToken ct,string ids="") {
        if(ids.Length>150) return BadRequest();
        var parsed=new List<int>();
        foreach(var s in ids.Split(',',StringSplitOptions.RemoveEmptyEntries)) {
            if(!int.TryParse(s,out var id)||id<1) return BadRequest();
            if(!parsed.Contains(id)) parsed.Add(id);
        }
        if(parsed.Count>12) return BadRequest();
        var cards=await Cards(db.Products.PubliclyVisible().Where(p=>parsed.Contains(p.Id))).ToListAsync(ct);
        return Ok(parsed.Select(id=>cards.FirstOrDefault(p=>p.Id==id)).Where(p=>p!=null));
    }
}
