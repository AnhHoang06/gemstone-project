-- Run against the existing GemstoneShop database before starting the Contact module.
-- Additive and repeatable. No changes to existing tables, no data deletion.
SET XACT_ABORT ON;
BEGIN TRANSACTION;
IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
    THROW 51000, 'Users table is required. Select the existing application database.', 1;
IF OBJECT_ID(N'dbo.ContactMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ContactMessages (
        Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ContactMessages PRIMARY KEY,
        UserId INT NULL,
        FullName NVARCHAR(100) NOT NULL,
        Email NVARCHAR(254) NOT NULL,
        Phone NVARCHAR(20) NULL,
        Subject NVARCHAR(100) NOT NULL,
        Message NVARCHAR(4000) NOT NULL,
        Status NVARCHAR(20) NOT NULL CONSTRAINT DF_ContactMessages_Status DEFAULT N'New',
        CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_ContactMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NULL,
        AdminNote NVARCHAR(2000) NULL,
        CONSTRAINT FK_ContactMessages_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(Id) ON DELETE NO ACTION,
        CONSTRAINT CK_ContactMessages_Status CHECK (Status IN (N'New', N'InProgress', N'Resolved'))
    );
END;
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ContactMessages') AND name=N'IX_ContactMessages_Status_CreatedAt')
    CREATE INDEX IX_ContactMessages_Status_CreatedAt ON dbo.ContactMessages(Status, CreatedAt, Id);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id=OBJECT_ID(N'dbo.ContactMessages') AND name=N'IX_ContactMessages_UserId')
    CREATE INDEX IX_ContactMessages_UserId ON dbo.ContactMessages(UserId);
COMMIT;
