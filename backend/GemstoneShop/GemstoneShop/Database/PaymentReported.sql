-- Run after Person3.sql and Payment.sql, against the existing GemstoneShop database.
-- Additive and repeatable: no historical orders are backfilled or marked Paid.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
    THROW 50001, 'Orders is missing. Apply the base schema first.', 1;
IF COL_LENGTH(N'dbo.Orders', N'PaymentStatus') IS NULL
    THROW 50002, 'Apply Payment.sql before PaymentReported.sql.', 1;
IF COL_LENGTH(N'dbo.Orders', N'PaymentReportedAt') IS NULL
    ALTER TABLE dbo.Orders ADD PaymentReportedAt datetime2 NULL;
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Orders')
    AND name = N'PaymentReportedAt' AND system_type_id = TYPE_ID(N'datetime2') AND is_nullable = 1)
    THROW 50003, 'PaymentReportedAt must be nullable datetime2; inspect the existing schema.', 1;
COMMIT;
