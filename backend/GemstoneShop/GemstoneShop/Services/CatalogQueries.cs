using System.Globalization;
using System.Text;
using GemstoneShop.Models;

namespace GemstoneShop.Services;

public static class CatalogQueries
{
    // Shared three-level membership; deliberately independent of storefront visibility.
    public static IQueryable<Product> InCategory(this IQueryable<Product> query, int id) => query.Where(p =>
        p.CategoryId == id || p.Category.ParentId == id || (p.Category.Parent != null && p.Category.Parent.ParentId == id));

    // The hierarchy writer enforces a maximum of three levels; fail closed for deeper legacy trees.
    public static IQueryable<Category> PubliclyVisible(this IQueryable<Category> query) => query.Where(c =>
        c.IsActive && (c.Parent == null || (c.Parent.IsActive &&
        (c.Parent.Parent == null || (c.Parent.Parent.IsActive && c.Parent.Parent.ParentId == null)))));

    public static IQueryable<Product> PubliclyVisible(this IQueryable<Product> query) => query.Where(p =>
        p.IsActive && p.Category.IsActive && (p.Category.Parent == null || (p.Category.Parent.IsActive &&
        (p.Category.Parent.Parent == null || (p.Category.Parent.Parent.IsActive && p.Category.Parent.Parent.ParentId == null)))));

    public static string NormalizeSearch(string value) => string.Concat(value.Normalize(NormalizationForm.FormD)
        .Where(c => CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark))
        .Replace('đ', 'd').Replace('Đ', 'D').ToLowerInvariant().Normalize(NormalizationForm.FormC);
}
