-- Optional local data repair. No schema changes; preserve product IDs and historical snapshots.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(DemoCleanupConsent)'<>N'LOCAL_SAMPLE_DATA' THROW 51000,'Explicit local sample consent required',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'DashboardSeed_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot lock dashboard seed',1;
EXEC @lock=sys.sp_getapplock @Resource=N'ReviewDemo_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot lock review seed',1;
DECLARE @roots TABLE(Name nvarchar(40) PRIMARY KEY,Id int);
INSERT @roots(Name) VALUES(N'Ruby'),(N'Sapphire'),(N'Emerald'),(N'Diamond'),(N'Amethyst');
IF EXISTS(SELECT 1 FROM @roots r WHERE (SELECT COUNT(*) FROM Categories c WHERE c.Name=r.Name AND c.ParentId IS NULL AND c.IsActive=1)<>1)
 THROW 51000,'Existing real roots missing/ambiguous; nothing changed',1;
UPDATE r SET Id=c.Id FROM @roots r JOIN Categories c ON c.Name=r.Name AND c.ParentId IS NULL;
DECLARE @images TABLE(Path nvarchar(300) PRIMARY KEY);
INSERT @images VALUES
(N'/uploads/demo-products/ruby-round.webp'),
(N'/uploads/demo-products/ruby-selection.webp'),
(N'/uploads/demo-products/ruby-oval.webp'),
(N'/uploads/demo-products/ruby-faceted.webp'),
(N'/uploads/demo-products/emerald-collection.webp'),
(N'/uploads/demo-products/emerald-selection.webp'),
(N'/uploads/demo-products/emerald-colombian.webp'),
(N'/uploads/demo-products/amethyst-navette.webp'),
(N'/uploads/demo-products/amethyst-purple.webp'),
(N'/uploads/demo-products/aquamarine-blue.webp'),
(N'/uploads/demo-products/topaz-blue.webp'),
(N'/uploads/demo-products/garnet-red.webp'),
(N'/uploads/demo-products/citrine-gold.webp'),
(N'/uploads/demo-products/tourmaline-pink.webp'),
(N'/uploads/demo-products/amethyst-single.webp');
-- Only the former Codex pack on explicitly marked demo products; never uploaded/original images.
DELETE i FROM ProductImages i JOIN @images x ON x.Path=i.ImageUrl JOIN Products p ON p.Id=i.ProductId
WHERE p.Description LIKE N'DashboardSeed[_]v1:product:%' OR p.Description=N'ReviewDemo_v1:product';
DECLARE @removedImages int=@@ROWCOUNT;
IF EXISTS(SELECT 1 FROM ProductImages i JOIN @images x ON x.Path=i.ImageUrl)
 THROW 51000,'Pack adopted by non-demo product; preserve files and inspect',1;
DECLARE @map TABLE(OldName nvarchar(200),NewName nvarchar(200),Family nvarchar(40));
INSERT @map VALUES
(N'Ruby Huyết Bồ Câu · mẫu đánh giá',N'Ruby Huyết Bồ Câu',N'Ruby'),
(N'Sapphire Xanh Ceylon · mẫu đánh giá',N'Sapphire Xanh Ceylon',N'Sapphire'),
(N'Emerald Colombia · mẫu đánh giá',N'Emerald Colombia',N'Emerald'),
(N'Amethyst Tím Đậm · mẫu đánh giá',N'Amethyst Tím Đậm',N'Amethyst'),
(N'Ruby Mozambique · mẫu đánh giá',N'Ruby Mozambique',N'Ruby'),
(N'Sapphire Vàng · mẫu đánh giá',N'Sapphire Vàng',N'Sapphire'),
(N'Aquamarine Xanh Biển · mẫu đánh giá',N'Ruby Oval Tự Nhiên',N'Ruby'),
(N'Topaz Xanh · mẫu đánh giá',N'Sapphire Oval',N'Sapphire'),
(N'Garnet Đỏ · mẫu đánh giá',N'Emerald Cushion',N'Emerald'),
(N'Peridot Xanh · mẫu đánh giá',N'Diamond Round',N'Diamond'),
(N'Citrine Vàng · mẫu đánh giá',N'Diamond Princess',N'Diamond'),
(N'Tourmaline Hồng · mẫu đánh giá',N'Amethyst Oval',N'Amethyst');
UPDATE p SET Name=m.NewName,CategoryId=r.Id,SearchName=NULL
FROM Products p JOIN @map m ON p.Name=m.OldName JOIN @roots r ON r.Name=m.Family
WHERE p.Description=N'ReviewDemo_v1:product';
DECLARE @renamed int=@@ROWCOUNT;
UPDATE p SET CategoryId=r.Id
FROM Products p JOIN @roots r ON p.Name LIKE r.Name+N' %'
WHERE (p.Description LIKE N'DashboardSeed[_]v1:product:%' OR p.Description=N'ReviewDemo_v1:product') AND p.CategoryId<>r.Id;
DECLARE @reassigned int=@@ROWCOUNT;
SELECT Id INTO #DemoCategories FROM Categories
WHERE Description LIKE N'DashboardSeed[_]v1:category:%' OR Description=N'ReviewDemo_v1:category';
IF EXISTS(SELECT 1 FROM Products WHERE CategoryId IN(SELECT Id FROM #DemoCategories))
 OR EXISTS(SELECT 1 FROM Categories WHERE ParentId IN(SELECT Id FROM #DemoCategories) AND Id NOT IN(SELECT Id FROM #DemoCategories))
 THROW 51000,'Unmapped/adopted demo category references; nothing changed',1;
DECLARE @categories int=(SELECT COUNT(*) FROM #DemoCategories);
WHILE EXISTS(SELECT 1 FROM Categories WHERE Id IN(SELECT Id FROM #DemoCategories))
BEGIN
 DELETE c FROM Categories c JOIN #DemoCategories d ON d.Id=c.Id WHERE NOT EXISTS(SELECT 1 FROM Categories child WHERE child.ParentId=c.Id);
 IF @@ROWCOUNT=0 THROW 51000,'Unexpected category hierarchy; nothing changed',1;
END;
-- This pre-existing record explicitly identifies itself as a test; hide, do not delete/rename history.
UPDATE Products SET IsActive=0 WHERE Name=N'Ruby Test' AND Description=N'Test product' AND IsActive=1;
DECLARE @hidden int=@@ROWCOUNT;
COMMIT;
SELECT @removedImages AS RemovedDemoImages,@renamed AS RenamedAndReassignedReviewProducts,
 @reassigned AS OtherProductsReassigned,@categories AS RemovedCategories,@hidden AS HiddenExplicitTestProducts;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
