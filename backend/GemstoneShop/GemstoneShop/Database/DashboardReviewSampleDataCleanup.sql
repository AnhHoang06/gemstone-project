-- Remove only the explicit dashboard-review demo. Never delete images or external votes.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(ReviewSeedConsent)'<>N'LOCAL_SAMPLE_DATA' THROW 51000,'Local sample consent required',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'DashboardReview_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot acquire sample lock',1;
SELECT r.Id INTO #R FROM ProductReviews r JOIN Users u ON u.Id=r.UserId JOIN Products p ON p.Id=r.ProductId
WHERE r.Content LIKE N'[[]Mẫu DashboardReview[_]v1] %'
AND u.Email LIKE 'dashboardseed.v1.%@example.invalid'
AND p.Description LIKE N'DashboardSeed[_]v1:product:%';
IF EXISTS(SELECT 1 FROM ReviewImages WHERE ReviewId IN(SELECT Id FROM #R))
OR EXISTS(SELECT 1 FROM ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #R))
THROW 51000,'Demo reviews have images/votes; inspect before cleanup',1;
DELETE ProductReviews WHERE Id IN(SELECT Id FROM #R);
COMMIT;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
