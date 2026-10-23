-- Additive Database First setup. Run against the configured GemstoneShop DB before deployment.
-- Repeatable: an existing WishlistItems table and all existing records are left intact.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL OR OBJECT_ID(N'dbo.Products', N'U') IS NULL
    THROW 51010, 'Wishlist requires the existing Users and Products tables.', 1;

IF OBJECT_ID(N'dbo.WishlistItems', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.WishlistItems (
        UserId int NOT NULL,
        ProductId int NOT NULL,
        CreatedAt datetime2 NOT NULL CONSTRAINT DF_WishlistItems_CreatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT PK_WishlistItems PRIMARY KEY (UserId, ProductId),
        CONSTRAINT FK_WishlistItems_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_WishlistItems_Products FOREIGN KEY (ProductId) REFERENCES dbo.Products(Id)
    );
END;
COMMIT;
