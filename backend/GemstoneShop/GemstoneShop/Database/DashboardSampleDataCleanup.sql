-- Explicit removal of DashboardSeed_v1 records ONLY. Refuses to remove adopted/externally referenced seed data.
-- sqlcmd ... -v DashboardSeedConsent="LOCAL_SAMPLE_DATA" -i DashboardSampleDataCleanup.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(DashboardSeedConsent)'<>N'LOCAL_SAMPLE_DATA' THROW 51120,'Explicit LOCAL_SAMPLE_DATA consent required.',1;
DECLARE @Marker nvarchar(80)=N'DashboardSeed_v1:';
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @Lock int;
 EXEC @Lock=sys.sp_getapplock @Resource=N'DashboardSeed_v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @Lock<0 THROW 51121,'Could not lock dashboard seed.',1;
 SELECT Id INTO #U FROM Users WHERE Email LIKE 'dashboardseed.v1.%@example.invalid' AND LEFT(Address,LEN(@Marker))=@Marker;
 SELECT Id INTO #C FROM Categories WHERE LEFT(Description,LEN(@Marker))=@Marker;
 SELECT Id INTO #P FROM Products WHERE LEFT(Description,LEN(@Marker))=@Marker;
 SELECT Id INTO #O FROM Orders WHERE LEFT(Note,LEN(@Marker))=@Marker;

 IF EXISTS(SELECT 1 FROM Orders o JOIN #O x ON x.Id=o.Id WHERE NOT EXISTS(SELECT 1 FROM #U u WHERE u.Id=o.UserId))
 OR EXISTS(SELECT 1 FROM Orders o JOIN #U u ON u.Id=o.UserId WHERE NOT EXISTS(SELECT 1 FROM #O x WHERE x.Id=o.Id))
 OR EXISTS(SELECT 1 FROM OrderDetails d JOIN #P p ON p.Id=d.ProductId WHERE NOT EXISTS(SELECT 1 FROM #O o WHERE o.Id=d.OrderId))
 OR EXISTS(SELECT 1 FROM OrderDetails d JOIN #O o ON o.Id=d.OrderId WHERE NOT EXISTS(SELECT 1 FROM #P p WHERE p.Id=d.ProductId))
 OR EXISTS(SELECT 1 FROM Products p JOIN #C c ON c.Id=p.CategoryId WHERE NOT EXISTS(SELECT 1 FROM #P x WHERE x.Id=p.Id))
 OR EXISTS(SELECT 1 FROM Categories c JOIN #C p ON p.Id=c.ParentId WHERE NOT EXISTS(SELECT 1 FROM #C x WHERE x.Id=c.Id))
 OR EXISTS(SELECT 1 FROM Products p JOIN #P x ON x.Id=p.Id WHERE NOT EXISTS(SELECT 1 FROM #C c WHERE c.Id=p.CategoryId))
 OR EXISTS(SELECT 1 FROM Carts c JOIN #U u ON u.Id=c.UserId)
 OR EXISTS(SELECT 1 FROM CartItems c JOIN #P p ON p.Id=c.ProductId)
 OR EXISTS(SELECT 1 FROM WishlistItems w WHERE w.UserId IN (SELECT Id FROM #U) OR w.ProductId IN (SELECT Id FROM #P))
 OR EXISTS(SELECT 1 FROM ProductImages i JOIN #P p ON p.Id=i.ProductId)
 OR EXISTS(SELECT 1 FROM Certificates c JOIN #P p ON p.Id=c.ProductId)
 OR EXISTS(SELECT 1 FROM CheckoutReceipts r WHERE r.UserId IN (SELECT Id FROM #U) OR r.OrderId IN (SELECT Id FROM #O))
   THROW 51122,'Seed records have external/adopted references. Nothing deleted; inspect manually.',1;

 DELETE d FROM OrderDetails d JOIN #O o ON o.Id=d.OrderId;
 DECLARE @details int=@@ROWCOUNT;
 DELETE o FROM Orders o JOIN #O x ON x.Id=o.Id;
 DELETE p FROM Products p JOIN #P x ON x.Id=p.Id;
 -- Leaves first, then roots; no cascades or constraint disabling.
 WHILE EXISTS(SELECT 1 FROM Categories c JOIN #C x ON x.Id=c.Id)
 BEGIN
   DELETE c FROM Categories c JOIN #C x ON x.Id=c.Id WHERE NOT EXISTS(SELECT 1 FROM Categories child WHERE child.ParentId=c.Id);
   IF @@ROWCOUNT=0 THROW 51123,'Unexpected hierarchy prevents safe cleanup.',1;
 END;
 DELETE u FROM Users u JOIN #U x ON x.Id=u.Id;
 COMMIT;
 SELECT (SELECT COUNT(*) FROM #U) AS RemovedUsers,(SELECT COUNT(*) FROM #C) AS RemovedCategories,
 (SELECT COUNT(*) FROM #P) AS RemovedProducts,(SELECT COUNT(*) FROM #O) AS RemovedOrders,@details AS RemovedOrderDetails;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
