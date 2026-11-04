namespace GemstoneShop.Services;

/// <summary>Reads and validates the browser origins allowed to call the API and SignalR hubs.</summary>
public static class CorsOrigins
{
    public const string Section = "Cors:AllowedOrigins";
    public const string DevelopmentDefault = "http://localhost:2222";

    public static string[] Read(IConfiguration configuration)
    {
        var configured = configuration.GetSection(Section).Get<string[]>() ?? [];
        var origins = configured
            .Where(value => !string.IsNullOrWhiteSpace(value))
            .Select(Normalize)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToArray();
        return origins.Length > 0 ? origins : [DevelopmentDefault];
    }

    // An origin is scheme://host[:port] only. Wildcards are refused because the policy allows credentials.
    private static string Normalize(string value)
    {
        var trimmed = value.Trim().TrimEnd('/');
        if (!Uri.TryCreate(trimmed, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps)
            || uri.AbsolutePath != "/" || !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) || trimmed.Contains('*'))
            throw new InvalidOperationException($"Invalid {Section} entry '{value}'. Use an origin such as https://example.vercel.app (no path, no wildcard).");
        return uri.GetLeftPart(UriPartial.Authority);
    }
}
