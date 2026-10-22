# Local authentication configuration

The JWT signing key is intentionally absent from appsettings.json. Development
loads User Secrets with ID `GemstoneShop-local-auth`. Set `Jwt:Key` there using
`dotnet user-secrets set "Jwt:Key" "<fresh-random-secret>"` from this directory,
or supply the environment variable `Jwt__Key`. Use a cryptographically random
secret of at least 32 bytes; do not reuse the key previously committed to Git.
Keep Issuer, Audience and ExpireMinutes in appsettings.json.

User Secrets are loaded in the Development environment. For other environments,
provide `Jwt__Key` through environment configuration or a secret store.
Previously issued tokens will fail validation after key rotation.

The database connection comes from `ConnectionStrings:DefaultConnection` in
configuration (environment override: `ConnectionStrings__DefaultConnection`).
When regenerating this Database First context, use Scaffold-DbContext with
`-NoOnConfiguring` (CLI: `--no-onconfiguring`) so scaffolding does not restore a
hard-coded connection. Keep the existing model/relationship mappings.
