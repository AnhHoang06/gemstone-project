-- Database First: run on the existing application DB before deploying payment code.
-- Repeatable and additive. Historical orders remain NULL (unknown), never backfilled as paid/COD.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Orders', N'U') IS NULL
    THROW 51020, 'Payment requires the existing Orders table.', 1;
IF COL_LENGTH('dbo.Orders', 'PaymentMethod') IS NULL
    ALTER TABLE dbo.Orders ADD PaymentMethod varchar(20) NULL;
IF COL_LENGTH('dbo.Orders', 'PaymentStatus') IS NULL
    ALTER TABLE dbo.Orders ADD PaymentStatus varchar(20) NULL;
IF COL_LENGTH('dbo.Orders', 'PaidAt') IS NULL
    ALTER TABLE dbo.Orders ADD PaidAt datetime2 NULL;
-- Dynamic SQL allows validation after columns are added in this same batch.
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Orders_PaymentMethod' AND parent_object_id = OBJECT_ID('dbo.Orders'))
    EXEC('ALTER TABLE dbo.Orders WITH CHECK ADD CONSTRAINT CK_Orders_PaymentMethod CHECK (PaymentMethod IS NULL OR PaymentMethod IN (''COD'', ''BankTransfer''))');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = 'CK_Orders_PaymentStatus' AND parent_object_id = OBJECT_ID('dbo.Orders'))
    EXEC('ALTER TABLE dbo.Orders WITH CHECK ADD CONSTRAINT CK_Orders_PaymentStatus CHECK (PaymentStatus IS NULL OR PaymentStatus IN (''Unpaid'', ''Paid''))');
COMMIT;
