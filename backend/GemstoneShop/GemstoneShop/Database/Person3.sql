-- Additive Database First setup. Run once against the configured GemstoneShop database.
-- Safe to run again; no existing records, tables or constraints are removed.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.CheckoutReceipts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CheckoutReceipts (
        UserId int NOT NULL,
        RequestId uniqueidentifier NOT NULL,
        RequestHash varchar(64) NOT NULL,
        OrderId int NOT NULL,
        CONSTRAINT PK_CheckoutReceipts PRIMARY KEY (UserId, RequestId),
        CONSTRAINT FK_CheckoutReceipts_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id),
        CONSTRAINT FK_CheckoutReceipts_Orders FOREIGN KEY (OrderId) REFERENCES dbo.Orders(Id)
    );
END;
INSERT INTO dbo.OrderStatuses(Name)
SELECT v.Name FROM (VALUES(N'Pending'),(N'Confirmed'),(N'Shipping'),(N'Completed'),(N'Cancelled')) v(Name)
WHERE NOT EXISTS (SELECT 1 FROM dbo.OrderStatuses WITH (UPDLOCK, HOLDLOCK) WHERE Name=v.Name);
COMMIT;
