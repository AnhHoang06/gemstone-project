using System.Globalization;
using System.Text;
using GemstoneShop.Models;
using Microsoft.EntityFrameworkCore;

namespace GemstoneShop.Services;

public static class CatalogQueries
{
    public const int SearchNameMaxLength = 200;
    public const int MaxSearchTokens = 10;
    // Accent- and case-insensitive; also folds đ/Đ to d. Used only for the NULL SearchName fallback.
    private const string AccentInsensitiveCollation = "Latin1_General_100_CI_AI";

    // The hierarchy writer enforces a maximum of three levels; fail closed for deeper legacy trees.
    public static IQueryable<Category> PubliclyVisible(this IQueryable<Category> query) => query.Where(c =>
        c.IsActive && (c.Parent == null || (c.Parent.IsActive &&
        (c.Parent.Parent == null || (c.Parent.Parent.IsActive && c.Parent.Parent.ParentId == null)))));

    public static IQueryable<Product> PubliclyVisible(this IQueryable<Product> query) => query.Where(p =>
        p.IsActive && p.Category.IsActive && (p.Category.Parent == null || (p.Category.Parent.IsActive &&
        (p.Category.Parent.Parent == null || (p.Category.Parent.Parent.IsActive && p.Category.Parent.Parent.ParentId == null)))));

    /// <summary>
    /// Lowercase, strip combining marks (precomposed and decomposed/NFD input), fold đ/Đ to d,
    /// collapse whitespace. The result is what Products.SearchName stores.
    /// </summary>
    public static string NormalizeSearch(string value)
    {
        var builder = new StringBuilder(value.Length);
        var pendingSpace = false;
        foreach (var c in value.Normalize(NormalizationForm.FormD))
        {
            if (char.IsWhiteSpace(c)) { pendingSpace = builder.Length > 0; continue; }
            var category = CharUnicodeInfo.GetUnicodeCategory(c);
            if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark) continue;
            if (pendingSpace) { builder.Append(' '); pendingSpace = false; }
            builder.Append(c is 'đ' or 'Đ' ? 'd' : char.ToLowerInvariant(c));
        }
        var result = builder.ToString().Normalize(NormalizationForm.FormC);
        return result.Length > SearchNameMaxLength ? result[..SearchNameMaxLength].TrimEnd() : result;
    }

    public static string[] SearchTokens(string query) =>
        NormalizeSearch(query).Split(' ', StringSplitOptions.RemoveEmptyEntries).Distinct().Take(MaxSearchTokens).ToArray();

    /// <summary>
    /// Every token must occur in the product's search name (any order, not necessarily adjacent).
    /// Rows whose SearchName is still NULL (inserted by SQL before the startup backfill) fall back to Name
    /// under an accent-insensitive collation, so they are searchable immediately.
    /// </summary>
    public static IQueryable<Product> MatchingSearch(this IQueryable<Product> query, string? q)
    {
        if (string.IsNullOrWhiteSpace(q)) return query;
        foreach (var token in SearchTokens(q))
            query = query.Where(p => EF.Functions.Collate(p.SearchName ?? p.Name, AccentInsensitiveCollation).Contains(token));
        return query;
    }
}
