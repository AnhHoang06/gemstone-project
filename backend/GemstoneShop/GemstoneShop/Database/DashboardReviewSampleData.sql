-- OPTIONAL LOCAL DEMO ONLY. Requires DashboardSeed_v1 data and Reviews.sql.
-- Sales/rating correlation is a demonstration scenario, not a production rating rule.
-- sqlcmd -v ReviewSeedConsent=LOCAL_SAMPLE_DATA
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(ReviewSeedConsent)' <> N'LOCAL_SAMPLE_DATA' THROW 51000,'Local sample consent required',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'DashboardReview_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot acquire sample lock',1;

SELECT p.Id AS ProductId,SUM(d.Quantity) AS Sold
INTO #Sales
FROM Products p JOIN OrderDetails d ON d.ProductId=p.Id
JOIN Orders o ON o.Id=d.OrderId JOIN OrderStatuses s ON s.Id=o.StatusId
JOIN Users u ON u.Id=o.UserId
WHERE p.Description LIKE N'DashboardSeed[_]v1:product:%'
AND o.Note LIKE N'DashboardSeed[_]v1:order:%'
AND u.Email LIKE 'dashboardseed.v1.%@example.invalid'
AND s.Name='Completed'
GROUP BY p.Id;
IF NOT EXISTS(SELECT 1 FROM #Sales) THROW 51000,'Run DashboardSampleData.sql first; no eligible demo sales found',1;

SELECT ProductId,Sold,NTILE(3) OVER(ORDER BY Sold DESC,ProductId) AS SalesTier INTO #Rank FROM #Sales;
;WITH Purchases AS (
 SELECT r.ProductId,r.SalesTier,o.UserId,MAX(COALESCE(o.UpdatedAt,o.CreatedAt)) AS CompletedAt
 FROM #Rank r JOIN OrderDetails d ON d.ProductId=r.ProductId
 JOIN Orders o ON o.Id=d.OrderId JOIN OrderStatuses s ON s.Id=o.StatusId
 JOIN Users u ON u.Id=o.UserId
 WHERE s.Name='Completed' AND o.Note LIKE N'DashboardSeed[_]v1:order:%'
 AND u.Email LIKE 'dashboardseed.v1.%@example.invalid'
 AND COALESCE(o.UpdatedAt,o.CreatedAt)<=SYSUTCDATETIME()
 GROUP BY r.ProductId,r.SalesTier,o.UserId
), Candidates AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY ProductId ORDER BY UserId) AS Position FROM Purchases
), Ratings AS (
 SELECT *,CASE SalesTier WHEN 1 THEN CASE WHEN Position%3=0 THEN 4 ELSE 5 END
 WHEN 2 THEN 3+Position%2 ELSE 1+Position%3 END AS Rating
 FROM Candidates WHERE Position<=CASE SalesTier WHEN 1 THEN 12 WHEN 2 THEN 6 ELSE 3 END
)
INSERT ProductReviews(UserId,ProductId,Rating,Content,IsVisible,CreatedAt)
SELECT r.UserId,r.ProductId,r.Rating,N'[Mẫu DashboardReview_v1] '+CASE r.Rating
 WHEN 5 THEN CASE WHEN r.Position%2=0 THEN N'Màu đá đẹp và tự nhiên, đóng gói cẩn thận. Tôi rất hài lòng.'
 ELSE N'Sản phẩm đúng mô tả, thông số rõ ràng và được tư vấn chu đáo.' END
 WHEN 4 THEN N'Chất lượng tốt, màu sắc phù hợp. Mong có thêm ảnh ở nhiều điều kiện ánh sáng.'
 WHEN 3 THEN N'Sản phẩm đúng thông số nhưng sắc đá chưa nổi bật như kỳ vọng.'
 WHEN 2 THEN N'Màu thực tế khá nhạt, trải nghiệm chưa tương xứng với mong đợi.'
 ELSE N'Tôi chưa hài lòng với ngoại quan viên đá. Cần tư vấn kỹ hơn trước khi mua.' END,
 1,CASE WHEN DATEADD(hour,1,r.CompletedAt)>SYSUTCDATETIME() THEN SYSUTCDATETIME() ELSE DATEADD(hour,1,r.CompletedAt) END
FROM Ratings r
WHERE NOT EXISTS(SELECT 1 FROM ProductReviews old WITH(UPDLOCK,HOLDLOCK) WHERE old.UserId=r.UserId AND old.ProductId=r.ProductId);
DECLARE @added int=@@ROWCOUNT;
COMMIT;
SELECT @added AS ReviewsAdded;
SELECT x.SalesTier,COUNT(DISTINCT x.ProductId) AS Products,COUNT(*) AS Reviews,
 CAST(AVG(CONVERT(decimal(10,2),v.Rating)) AS decimal(10,2)) AS AverageRating,
 MIN(x.Sold) AS MinSold,MAX(x.Sold) AS MaxSold
FROM #Rank x JOIN ProductReviews v ON v.ProductId=x.ProductId
WHERE v.Content LIKE N'[[]Mẫu DashboardReview[_]v1] %'
GROUP BY x.SalesTier ORDER BY x.SalesTier;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
