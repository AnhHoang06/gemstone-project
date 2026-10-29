using System.Security.Claims;
using System.Text.RegularExpressions;
using GemstoneShop.Data;
using GemstoneShop.Models;
using GemstoneShop.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
namespace GemstoneShop.Controllers;
[ApiController, TypeFilter(typeof(CommerceExceptionFilter))]
public class ReviewImagesController(GemstoneShopContext db, IWebHostEnvironment env, ILogger<ReviewImagesController> log) : ControllerBase {
    private int UserId => int.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier),out var id)?id:0;
    private string Root => Path.Combine(env.ContentRootPath,"App_Data","review-images");
    private static string? Extension(byte[] b) {
        if(b.Length>=24 && b.AsSpan(0,8).SequenceEqual(new byte[]{137,80,78,71,13,10,26,10}) && b.AsSpan(12,4).SequenceEqual("IHDR"u8)) return ".png";
        if(b.Length>=4 && b[0]==255 && b[1]==216 && b[2]==255 && b[^2]==255 && b[^1]==217) return ".jpg";
        if(b.Length>=16 && b.AsSpan(0,4).SequenceEqual("RIFF"u8) && b.AsSpan(8,4).SequenceEqual("WEBP"u8)) return ".webp";
        return null;
    }
    private string? SafePath(string filename) => Regex.IsMatch(filename,@"\A[a-f0-9]{32}\.(png|jpg|webp)\z") ? Path.Combine(Root,filename):null;
    private void DeleteFile(string path) {try {System.IO.File.Delete(path);} catch(IOException e){log.LogWarning(e,"Review image cleanup failed");} catch(UnauthorizedAccessException e){log.LogWarning(e,"Review image cleanup denied");}}

    [HttpGet("api/review-images/{id:int}")]
    public async Task<IActionResult> Get(int id,CancellationToken ct) {
        var image=await db.ReviewImages.AsNoTracking().SingleOrDefaultAsync(i=>i.Id==id &&
            (User.IsInRole("Admin") || i.Review.UserId==UserId || (i.Review.IsVisible && db.Products.PubliclyVisible().Any(p=>p.Id==i.Review.ProductId))),ct);
        if(image==null) return NotFound();
        var path=SafePath(image.FileName);
        if(path==null || !System.IO.File.Exists(path)) return NotFound();
        Response.Headers.CacheControl="private, no-store";
        Response.Headers["X-Content-Type-Options"]="nosniff";
        return PhysicalFile(path,Path.GetExtension(path) switch {".png"=>"image/png",".webp"=>"image/webp",_=>"image/jpeg"});
    }
    [Authorize(Roles="Customer"), HttpPost("api/reviews/{id:int}/images"), RequestSizeLimit(16_000_000)]
    public async Task<IActionResult> Upload(int id,[FromForm] List<IFormFile> files,CancellationToken ct) {
        if(files.Count<1 || files.Count>3) return BadRequest(new {message="Chọn từ 1 đến 3 ảnh."});
        // Bound request and each file. Infer type from bytes, never use original filename in a path.
        var prepared=new List<(byte[] Bytes,string Name)>();
        foreach(var file in files) {
            if(file.Length<1 || file.Length>5*1024*1024) return BadRequest(new {message="Mỗi ảnh tối đa 5 MB."});
            using var stream=new MemoryStream(); await file.CopyToAsync(stream,ct);
            var bytes=stream.ToArray(); var ext=Extension(bytes);
            if(ext==null) return BadRequest(new {message="Chỉ nhận ảnh PNG, JPEG hoặc WebP hợp lệ."});
            prepared.Add((bytes,Guid.NewGuid().ToString("N")+ext));
        }
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"review:{id}",ct);
        var review=await db.ProductReviews.Include(r=>r.Images).SingleOrDefaultAsync(r=>r.Id==id && r.UserId==UserId,ct);
        if(review==null) return NotFound();
        if(review.Images.Count+files.Count>3) return BadRequest(new {message="Mỗi đánh giá tối đa 3 ảnh."});
        Directory.CreateDirectory(Root);
        var written=new List<string>(); var commitAttempted=false;
        try {
            var free=Enumerable.Range(0,3).Except(review.Images.Select(i=>i.SortOrder)).ToArray();
            for(var i=0;i<prepared.Count;i++) {
                var path=Path.Combine(Root,prepared[i].Name); written.Add(path);
                await System.IO.File.WriteAllBytesAsync(path,prepared[i].Bytes,ct);
                db.ReviewImages.Add(new ReviewImage {ReviewId=id,FileName=prepared[i].Name,SortOrder=free[i]});
            }
            review.UpdatedAt=DateTime.UtcNow; await db.SaveChangesAsync(ct);
            commitAttempted=true; await tx.CommitAsync(ct);
        } catch {
            // A commit timeout is ambiguous: retain private files rather than deleting committed images.
            if(!commitAttempted) foreach(var path in written) DeleteFile(path);
            throw;
        }
        return Ok(await db.ProductReviews.Where(r=>r.Id==id).Dtos(db,UserId).SingleAsync(ct));
    }
    [Authorize(Roles="Customer"), HttpDelete("api/reviews/{id:int}/images/{imageId:int}")]
    public async Task<IActionResult> Delete(int id,int imageId,CancellationToken ct) {
        await using var tx=await db.Database.BeginTransactionAsync(ct);
        await CommerceLock.Acquire(db,$"review:{id}",ct);
        var image=await db.ReviewImages.Include(i=>i.Review).SingleOrDefaultAsync(i=>i.Id==imageId && i.ReviewId==id && i.Review.UserId==UserId,ct);
        if(image==null) return NotFound();
        image.Review.UpdatedAt=DateTime.UtcNow; db.ReviewImages.Remove(image);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        var path=SafePath(image.FileName); if(path!=null) DeleteFile(path);
        return NoContent();
    }
}
