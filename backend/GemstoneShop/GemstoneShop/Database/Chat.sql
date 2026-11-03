-- Additive Database First extension: customer <-> staff chat (one conversation per customer).
-- Run with the target database selected (sqlcmd -d <database> -b -f 65001 -i Chat.sql). No USE statement.
-- Repeatable: only creates objects that are missing; never drops or rewrites existing data.
-- Message bodies are stored as plain text; clients must render them as text, never as HTML.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock = sys.sp_getapplock @Resource=N'GemAurelia:ChatSchema', @LockMode='Exclusive', @LockOwner='Transaction';
IF @lock < 0 THROW 51000, 'Cannot acquire schema lock', 1;

IF OBJECT_ID(N'dbo.ChatConversations', N'U') IS NULL
CREATE TABLE dbo.ChatConversations (
    Id int IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatConversations PRIMARY KEY,
    CustomerId int NOT NULL CONSTRAINT FK_ChatConversations_Users REFERENCES dbo.Users(Id),
    Status varchar(10) NOT NULL CONSTRAINT DF_ChatConversations_Status DEFAULT 'Open',
    LastMessageAt datetime2 NOT NULL CONSTRAINT DF_ChatConversations_LastMessageAt DEFAULT SYSUTCDATETIME(),
    CustomerLastReadId bigint NOT NULL CONSTRAINT DF_ChatConversations_CustomerLastReadId DEFAULT 0,
    StaffLastReadId bigint NOT NULL CONSTRAINT DF_ChatConversations_StaffLastReadId DEFAULT 0,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_ChatConversations_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ChatConversations_Customer UNIQUE (CustomerId),
    CONSTRAINT CK_ChatConversations_Status CHECK (Status IN ('Open','Closed'))
);

IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
CREATE TABLE dbo.ChatMessages (
    Id bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_ChatMessages PRIMARY KEY,
    ConversationId int NOT NULL CONSTRAINT FK_ChatMessages_ChatConversations REFERENCES dbo.ChatConversations(Id),
    SenderUserId int NOT NULL CONSTRAINT FK_ChatMessages_Users REFERENCES dbo.Users(Id),
    SenderRole varchar(10) NOT NULL,
    Body nvarchar(2000) NOT NULL,
    ProductId int NULL CONSTRAINT FK_ChatMessages_Products REFERENCES dbo.Products(Id),
    ClientMessageId uniqueidentifier NOT NULL,
    CreatedAt datetime2 NOT NULL CONSTRAINT DF_ChatMessages_CreatedAt DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_ChatMessages_Client UNIQUE (ConversationId, ClientMessageId),
    CONSTRAINT CK_ChatMessages_SenderRole CHECK (SenderRole IN ('Customer','Staff')),
    CONSTRAINT CK_ChatMessages_Body CHECK (LEN(LTRIM(RTRIM(Body))) > 0)
);

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChatMessages_Conversation_Id' AND object_id = OBJECT_ID(N'dbo.ChatMessages'))
    EXEC(N'CREATE INDEX IX_ChatMessages_Conversation_Id ON dbo.ChatMessages(ConversationId, Id) INCLUDE (SenderRole)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChatMessages_Sender_CreatedAt' AND object_id = OBJECT_ID(N'dbo.ChatMessages'))
    EXEC(N'CREATE INDEX IX_ChatMessages_Sender_CreatedAt ON dbo.ChatMessages(SenderUserId, CreatedAt)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChatMessages_ProductId' AND object_id = OBJECT_ID(N'dbo.ChatMessages'))
    EXEC(N'CREATE INDEX IX_ChatMessages_ProductId ON dbo.ChatMessages(ProductId)');
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_ChatConversations_LastMessageAt' AND object_id = OBJECT_ID(N'dbo.ChatConversations'))
    EXEC(N'CREATE INDEX IX_ChatConversations_LastMessageAt ON dbo.ChatConversations(LastMessageAt DESC) INCLUDE (Status)');
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK;
THROW;
END CATCH;
