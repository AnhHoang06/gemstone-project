-- Additive Database First extension. Run before deploying the review-enabled API.
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock = sys.sp_getapplock @Resource=N'GemAurelia:ReviewsSchema', @LockMode='Exclusive', @LockOwner='Transaction';
IF @lock < 0 THROW 51000, 'Cannot acquire schema lock', 1;
IF OBJECT_ID('dbo.ProductReviews','U') IS NULL
BEGIN
CREATE TABLE dbo.ProductReviews (
 Id int IDENTITY PRIMARY KEY, UserId int NOT NULL REFERENCES dbo.Users(Id),
 ProductId int NOT NULL REFERENCES dbo.Products(Id), Rating int NOT NULL,
 Content nvarchar(2000) NOT NULL, IsVisible bit NOT NULL DEFAULT 1,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NULL, ModeratedAt datetime2 NULL,
 CONSTRAINT UQ_ProductReviews_UserProduct UNIQUE(UserId,ProductId),
 CONSTRAINT CK_ProductReviews_Rating CHECK(Rating BETWEEN 1 AND 5),
 CONSTRAINT CK_ProductReviews_Content CHECK(LEN(LTRIM(RTRIM(Content))) > 0));
CREATE INDEX IX_ProductReviews_Public ON dbo.ProductReviews(ProductId,IsVisible,CreatedAt DESC) INCLUDE(Rating);
END;
IF OBJECT_ID('dbo.ReviewImages','U') IS NULL
BEGIN
CREATE TABLE dbo.ReviewImages (
 Id int IDENTITY PRIMARY KEY, ReviewId int NOT NULL REFERENCES dbo.ProductReviews(Id),
 FileName nvarchar(40) NOT NULL, SortOrder int NOT NULL,
 CONSTRAINT UQ_ReviewImages_Slot UNIQUE(ReviewId,SortOrder),
 CONSTRAINT CK_ReviewImages_Slot CHECK(SortOrder BETWEEN 0 AND 2));
END;
IF OBJECT_ID('dbo.ReviewHelpfulVotes','U') IS NULL
BEGIN
CREATE TABLE dbo.ReviewHelpfulVotes (
 ReviewId int NOT NULL REFERENCES dbo.ProductReviews(Id), UserId int NOT NULL REFERENCES dbo.Users(Id),
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 CONSTRAINT PK_ReviewHelpfulVotes PRIMARY KEY(ReviewId,UserId));
END;
IF OBJECT_ID('dbo.ProductQuestions','U') IS NULL
BEGIN
CREATE TABLE dbo.ProductQuestions (
 Id int IDENTITY PRIMARY KEY, ProductId int NOT NULL REFERENCES dbo.Products(Id),
 UserId int NOT NULL REFERENCES dbo.Users(Id), Content nvarchar(2000) NOT NULL,
 IsVisible bit NOT NULL DEFAULT 1, CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), ModeratedAt datetime2 NULL,
 CONSTRAINT CK_ProductQuestions_Content CHECK(LEN(LTRIM(RTRIM(Content))) > 0));
CREATE INDEX IX_ProductQuestions_Public ON dbo.ProductQuestions(ProductId,IsVisible,CreatedAt DESC);
END;
IF OBJECT_ID('dbo.ProductAnswers','U') IS NULL
CREATE TABLE dbo.ProductAnswers (
 Id int IDENTITY PRIMARY KEY, QuestionId int NOT NULL REFERENCES dbo.ProductQuestions(Id),
 AdminUserId int NOT NULL REFERENCES dbo.Users(Id), Content nvarchar(2000) NOT NULL,
 CreatedAt datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), UpdatedAt datetime2 NULL,
 CONSTRAINT UQ_ProductAnswers_Question UNIQUE(QuestionId),
 CONSTRAINT CK_ProductAnswers_Content CHECK(LEN(LTRIM(RTRIM(Content))) > 0));
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK;
THROW;
END CATCH;
