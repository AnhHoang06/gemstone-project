-- Removes only optional ReviewDemo_v1 fixtures. Refuses adopted/cross-linked data.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(ReviewSeedConsent)'<>N'LOCAL_SAMPLE_DATA' THROW 51000,'Local demo consent required',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'ReviewDemo_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot acquire demo lock',1;
SELECT Id INTO #U FROM Users WHERE Email LIKE 'reviewdemo.v1.%@example.invalid';
SELECT Id INTO #P FROM Products WHERE Description=N'ReviewDemo_v1:product';
SELECT Id INTO #C FROM Categories WHERE Description=N'ReviewDemo_v1:category';
SELECT Id INTO #O FROM Orders WHERE Note=N'ReviewDemo_v1:order' AND UserId IN(SELECT Id FROM #U);
SELECT Id INTO #R FROM ProductReviews WHERE UserId IN(SELECT Id FROM #U) AND ProductId IN(SELECT Id FROM #P);
SELECT Id INTO #Q FROM ProductQuestions WHERE UserId IN(SELECT Id FROM #U) AND ProductId IN(SELECT Id FROM #P);
IF EXISTS(SELECT 1 FROM ProductReviews WHERE (ProductId IN(SELECT Id FROM #P) OR UserId IN(SELECT Id FROM #U)) AND Id NOT IN(SELECT Id FROM #R))
 OR EXISTS(SELECT 1 FROM ProductQuestions WHERE (ProductId IN(SELECT Id FROM #P) OR UserId IN(SELECT Id FROM #U)) AND Id NOT IN(SELECT Id FROM #Q))
 OR EXISTS(SELECT 1 FROM ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #R) AND UserId NOT IN(SELECT Id FROM #U))
 OR EXISTS(SELECT 1 FROM ReviewImages WHERE ReviewId IN(SELECT Id FROM #R))
 OR EXISTS(SELECT 1 FROM ProductAnswers WHERE QuestionId IN(SELECT Id FROM #Q) AND AdminUserId NOT IN(SELECT Id FROM #U))
 OR EXISTS(SELECT 1 FROM Orders WHERE UserId IN(SELECT Id FROM #U) AND Id NOT IN(SELECT Id FROM #O))
 OR EXISTS(SELECT 1 FROM OrderDetails WHERE (ProductId IN(SELECT Id FROM #P) AND OrderId NOT IN(SELECT Id FROM #O)) OR (OrderId IN(SELECT Id FROM #O) AND ProductId NOT IN(SELECT Id FROM #P)))
 OR EXISTS(SELECT 1 FROM CartItems WHERE ProductId IN(SELECT Id FROM #P))
 OR EXISTS(SELECT 1 FROM Carts WHERE UserId IN(SELECT Id FROM #U))
 OR EXISTS(SELECT 1 FROM WishlistItems WHERE ProductId IN(SELECT Id FROM #P) OR UserId IN(SELECT Id FROM #U))
 OR EXISTS(SELECT 1 FROM ProductImages WHERE ProductId IN(SELECT Id FROM #P))
 OR EXISTS(SELECT 1 FROM Certificates WHERE ProductId IN(SELECT Id FROM #P))
 OR EXISTS(SELECT 1 FROM CheckoutReceipts WHERE UserId IN(SELECT Id FROM #U) OR OrderId IN(SELECT Id FROM #O))
 OR EXISTS(SELECT 1 FROM Products WHERE (CategoryId IN(SELECT Id FROM #C) AND Id NOT IN(SELECT Id FROM #P)) OR (Id IN(SELECT Id FROM #P) AND CategoryId NOT IN(SELECT Id FROM #C)))
 OR EXISTS(SELECT 1 FROM Categories WHERE ParentId IN(SELECT Id FROM #C))
 THROW 51000,'Demo has external references: inspect manually; nothing removed',1;
DELETE ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #R);
DELETE ProductReviews WHERE Id IN(SELECT Id FROM #R);
DELETE ProductAnswers WHERE QuestionId IN(SELECT Id FROM #Q);
DELETE ProductQuestions WHERE Id IN(SELECT Id FROM #Q);
DELETE OrderDetails WHERE OrderId IN(SELECT Id FROM #O);
DELETE Orders WHERE Id IN(SELECT Id FROM #O);
DELETE Products WHERE Id IN(SELECT Id FROM #P);
DELETE Categories WHERE Id IN(SELECT Id FROM #C);
DELETE Users WHERE Id IN(SELECT Id FROM #U);
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
