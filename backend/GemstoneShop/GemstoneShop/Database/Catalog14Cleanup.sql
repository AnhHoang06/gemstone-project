-- Optional removal of ONLY Catalog14_v2 generated records. Does not restore the old demo.
-- sqlcmd ... -v CatalogConsent=LOCAL_SAMPLE_DATA Apply=0 -i Catalog14Cleanup.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF '$(CatalogConsent)'<>'LOCAL_SAMPLE_DATA' OR '$(Apply)' NOT IN ('0','1') THROW 51210,'Explicit consent and Apply=0/1 required',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'Catalog14_v2',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51210,'Lock failed',1;
SELECT Id INTO #P FROM Products WHERE Description LIKE N'Catalog14[_]v2:product:%';
SELECT Id INTO #U FROM Users WHERE Email LIKE 'catalog14.v2.%@example.invalid' AND Address LIKE N'Catalog14[_]v2:customer:%' AND IsActive=0;
SELECT Id INTO #O FROM Orders WHERE Note LIKE N'Catalog14[_]v2:order:%' AND UserId IN(SELECT Id FROM #U);
SELECT Id INTO #R FROM ProductReviews WHERE ProductId IN(SELECT Id FROM #P) AND UserId IN(SELECT Id FROM #U);
SELECT Id INTO #Q FROM ProductQuestions WHERE ProductId IN(SELECT Id FROM #P) AND UserId IN(SELECT Id FROM #U);
IF EXISTS(SELECT 1 FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #O) AND ProductId NOT IN(SELECT Id FROM #P))
 OR EXISTS(SELECT 1 FROM CheckoutReceipts WHERE OrderId IN(SELECT Id FROM #O))
 OR EXISTS(SELECT 1 FROM ReviewImages WHERE ReviewId IN(SELECT Id FROM #R))
 OR EXISTS(SELECT 1 FROM ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #R) AND UserId NOT IN(SELECT Id FROM #U))
 OR EXISTS(SELECT 1 FROM ProductAnswers WHERE QuestionId IN(SELECT Id FROM #Q))
 THROW 51210,'Generated data has external adoption: inspect first',1;
DELETE ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #R);
DELETE ProductReviews WHERE Id IN(SELECT Id FROM #R);
DELETE ProductQuestions WHERE Id IN(SELECT Id FROM #Q);
DELETE OrderDetails WHERE OrderId IN(SELECT Id FROM #O);
DELETE Orders WHERE Id IN(SELECT Id FROM #O);
-- Preserve IDs, images and any external historical references. No user/category/product deletion.
UPDATE Products SET IsActive=0 WHERE Id IN(SELECT Id FROM #P);
IF '$(Apply)'='1' COMMIT; ELSE ROLLBACK;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
