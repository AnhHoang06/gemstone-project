-- Database First extension: run AFTER Payment.sql, BEFORE deploying this code.
-- No historical backfill: a NULL timestamp means no customer report is recorded.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF COL_LENGTH('dbo.Orders', 'PaymentStatus') IS NULL
    THROW 51030, 'Run Payment.sql before PaymentOrderFlow.sql.', 1;
IF COL_LENGTH('dbo.Orders', 'PaymentReportedAt') IS NULL
    ALTER TABLE dbo.Orders ADD PaymentReportedAt datetime2 NULL;
COMMIT;
