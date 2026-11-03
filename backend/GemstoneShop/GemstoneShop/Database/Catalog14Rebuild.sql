-- LOCAL ONLY. Run with sqlcmd -b -f 65001 -v CatalogConsent=LOCAL_SAMPLE_DATA SeedAsOf=2026-11-03 Apply=0
-- Apply=0 performs the complete rebuild and assertions, then ROLLBACK. Apply=1 commits.
-- Preserves all non-seed orders, all product IDs and all existing users/categories.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(CatalogConsent)'<>N'LOCAL_SAMPLE_DATA' THROW 51200,'Explicit local consent required',1;
IF N'$(Apply)' NOT IN ('0','1') THROW 51200,'Apply must be 0 or 1',1;
DECLARE @AsOf date=TRY_CONVERT(date,'$(SeedAsOf)',23);
IF @AsOf IS NULL OR @AsOf>CONVERT(date,SYSUTCDATETIME()) OR @AsOf<'2020-01-01' THROW 51200,'Invalid anchor',1;
DECLARE @Start date=DATEADD(month,-12,@AsOf),@Marker nvarchar(80)=N'Catalog14_v2:';
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'Catalog14_v2',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
IF @lock<0 THROW 51200,'Cannot lock rebuild',1;
IF EXISTS(SELECT 1 FROM Products WHERE Description LIKE N'Catalog14[_]v2:%')
 THROW 51200,'Catalog14 already exists: use validation, not another rebuild. No changes.',1;
-- Exact copies include every current column, including optional PaymentReportedAt.
SELECT * INTO #KeepOrders FROM Orders WHERE Id IN(2548,2658,2709,2710,2712);
IF (SELECT COUNT(*) FROM #KeepOrders)<>5 THROW 51200,'Expected protected local orders missing',1;
SELECT * INTO #KeepDetails FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #KeepOrders);
SELECT * INTO #KeepReceipts FROM CheckoutReceipts WHERE OrderId IN(SELECT Id FROM #KeepOrders);
DECLARE @keepOrderJson nvarchar(max)=(SELECT * FROM #KeepOrders ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES),
 @keepDetailJson nvarchar(max)=(SELECT * FROM #KeepDetails ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES),
 @keepReceiptJson nvarchar(max)=(SELECT * FROM #KeepReceipts ORDER BY OrderId FOR JSON PATH,INCLUDE_NULL_VALUES);
SELECT Id INTO #OldP FROM Products WHERE Description LIKE N'DashboardSeed[_]v1:product:%' OR Description=N'ReviewDemo_v1:product';
SELECT Id INTO #OldU FROM Users WHERE IsActive=0 AND
 (Email LIKE 'dashboardseed.v1.%@example.invalid' AND Address LIKE N'DashboardSeed[_]v1:%'
 OR Email LIKE 'reviewdemo.v1.%@example.invalid' AND Address LIKE N'ReviewDemo[_]v1:%');
SELECT Id INTO #OldO FROM Orders WHERE
 (Note LIKE N'DashboardSeed[_]v1:order:%' OR Note=N'ReviewDemo_v1:order') AND UserId IN(SELECT Id FROM #OldU);
IF EXISTS(SELECT 1 FROM #OldO WHERE Id IN(SELECT Id FROM #KeepOrders))
 OR EXISTS(SELECT 1 FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #OldO) AND ProductId NOT IN(SELECT Id FROM #OldP))
 OR EXISTS(SELECT 1 FROM CheckoutReceipts WHERE OrderId IN(SELECT Id FROM #OldO))
 THROW 51200,'Seed order provenance/receipt guard failed',1;
-- Preserve every non-seed order, not only the five explicitly named ones.
SELECT * INTO #OtherOrders FROM Orders WHERE Id NOT IN(SELECT Id FROM #OldO);
SELECT * INTO #OtherDetails FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #OtherOrders);
SELECT r.Id INTO #OldR FROM ProductReviews r JOIN Users u ON u.Id=r.UserId
WHERE r.ProductId IN(SELECT Id FROM #OldP) AND r.UserId IN(SELECT Id FROM #OldU)
AND (u.Email LIKE 'reviewdemo.v1.%@example.invalid' OR r.Content LIKE N'[[]Mẫu DashboardReview[_]v1] %');
IF EXISTS(SELECT 1 FROM ReviewImages WHERE ReviewId IN(SELECT Id FROM #OldR))
 OR EXISTS(SELECT 1 FROM ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #OldR) AND UserId NOT IN(SELECT Id FROM #OldU))
 THROW 51200,'Seed reviews adopted by external users/assets; inspect first',1;
DELETE ReviewHelpfulVotes WHERE ReviewId IN(SELECT Id FROM #OldR);
DELETE ProductReviews WHERE Id IN(SELECT Id FROM #OldR);
DELETE OrderDetails WHERE OrderId IN(SELECT Id FROM #OldO);
DELETE Orders WHERE Id IN(SELECT Id FROM #OldO);
-- Keep historical products, Q&A, carts, wishlist references and original images intact.
UPDATE Products SET IsActive=0 WHERE Id IN(SELECT Id FROM #OldP);
IF EXISTS(SELECT 1 FROM Products WHERE IsActive=1)
 THROW 51200,'Unexpected active non-seed products; never hide these automatically',1;
DECLARE @CustomerRole int=(SELECT Id FROM Roles WHERE Name='Customer');
IF @CustomerRole IS NULL THROW 51200,'Missing Customer role',1;
DECLARE @Catalog TABLE(Code int PRIMARY KEY,Family nvarchar(30),Name nvarchar(200),Asset varchar(80),Price decimal(18,2),Cut nvarchar(30),Color nvarchar(30),ReuseCode int);
INSERT @Catalog VALUES
(1,N'Ruby',N'Ruby Oval','ruby-oval.jpg',6500000,N'Oval',N'Đỏ',1),
(2,N'Ruby',N'Ruby Đỏ Cushion','ruby-cushion.jpg',7500000,N'Cushion',N'Đỏ',4),
(3,N'Ruby',N'Ruby Giọt Nước','ruby-pear.jpg',5800000,N'Pear',N'Đỏ',3),
(4,N'Sapphire',N'Sapphire Xanh Marquise','sapphire-marquise.jpg',5200000,N'Marquise',N'Xanh lam',22),
(5,N'Sapphire',N'Sapphire Xanh Oval','sapphire-oval.jpg',4800000,N'Oval',N'Xanh lam',17),
(6,N'Sapphire',N'Sapphire Trái Tim','sapphire-heart.jpg',5500000,N'Heart',N'Xanh lam',23),
(7,N'Emerald',N'Emerald Tròn','emerald-round.jpg',4200000,N'Round',N'Xanh lục',34),
(8,N'Emerald',N'Emerald Bát Giác','emerald-octagon.jpg',6200000,N'Octagon',N'Xanh lục',37),
(9,N'Emerald',N'Emerald Oval','emerald-oval.jpg',4600000,N'Oval',N'Xanh lục',33),
(10,N'Amethyst',N'Amethyst Cushion','amethyst-cushion.jpg',1400000,N'Cushion',N'Tím',52),
(11,N'Amethyst',N'Amethyst Giọt Nước','amethyst-pear.jpg',1200000,N'Pear',N'Tím',51),
(12,N'Amethyst',N'Amethyst Trillion','amethyst-trillion.jpg',1600000,N'Trillion',N'Tím',NULL),
(13,N'Diamond',N'Diamond Giọt Nước','diamond-pear.webp',12500000,N'Pear',N'Trong suốt',NULL),
(14,N'Diamond',N'Diamond Round Brilliant','diamond-round.webp',10000000,N'Round',N'Trong suốt',NULL);
IF EXISTS(SELECT 1 FROM @Catalog x WHERE (SELECT COUNT(*) FROM Categories c WHERE c.Name=x.Family AND c.ParentId IS NULL AND c.IsActive=1)<>1)
 THROW 51200,'Five existing category roots required',1;
CREATE TABLE #Products(Code int PRIMARY KEY,Id int NOT NULL);
CREATE TABLE #Users(Code int PRIMARY KEY,Id int NOT NULL);
CREATE TABLE #Orders(Id int PRIMARY KEY);
DECLARE @i int=1,@id int,@name nvarchar(200),@category int,@asset varchar(80),@price decimal(18,2),@cut nvarchar(30),@color nvarchar(30),@reuse int;
WHILE @i<=14
BEGIN
 SELECT @name=x.Name,@category=c.Id,@asset=x.Asset,@price=x.Price,@cut=x.Cut,@color=x.Color,@reuse=x.ReuseCode
 FROM @Catalog x JOIN Categories c ON c.Name=x.Family AND c.ParentId IS NULL WHERE x.Code=@i;
 SET @id=NULL;
 -- Reuse only untouched seed products with no remaining external/historical adoption.
 SELECT @id=p.Id FROM Products p WHERE @reuse IS NOT NULL AND p.Description LIKE CONCAT(N'DashboardSeed[_]v1:product:',@reuse,N' —%')
 AND NOT EXISTS(SELECT 1 FROM OrderDetails WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM ProductReviews WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM ProductQuestions WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM ProductImages WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM Certificates WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM CartItems WHERE ProductId=p.Id)
 AND NOT EXISTS(SELECT 1 FROM WishlistItems WHERE ProductId=p.Id);
 IF @id IS NULL
 BEGIN
  INSERT Products(CategoryId,Name,Description,Price,Stock,IsActive,CreatedAt,Cut,Color)
  VALUES(@category,@name,CONCAT(@Marker,N'product:',@i),@price,30+@i,1,DATEADD(day,-30,@Start),@cut,@color);
  SET @id=CONVERT(int,SCOPE_IDENTITY());
 END
 ELSE UPDATE Products SET Name=@name,CategoryId=@category,Description=CONCAT(@Marker,N'product:',@i),Price=@price,Stock=30+@i,IsActive=1,Cut=@cut,Color=@color,Origin=NULL,Carat=NULL,Clarity=NULL,SearchName=NULL WHERE Id=@id;
 INSERT ProductImages(ProductId,ImageUrl,IsPrimary,SortOrder) VALUES(@id,CONCAT('/catalog-gems/',@asset),1,0);
 INSERT #Products VALUES(@i,@id);
 SET @i+=1;
END;
-- Dedicated disabled users: never repurpose real accounts or publish usable credentials.
IF EXISTS(SELECT 1 FROM Users WHERE Email LIKE 'catalog14.v2.%@example.invalid') THROW 51200,'Partial seed user records exist',1;
SET @i=1;
WHILE @i<=80
BEGIN
 SET @name=CHOOSE(1+(@i-1)/10,N'Nguyễn',N'Trần',N'Lê',N'Phạm',N'Hoàng',N'Vũ',N'Đỗ',N'Bùi')+N' '+CHOOSE(1+(@i-1)%10,N'Minh Anh',N'Thảo Linh',N'Quang Huy',N'Ngọc Mai',N'Đức Minh',N'Thanh Hà',N'Hoài Nam',N'Bảo Ngọc',N'Gia Hân',N'Tuấn Kiệt');
 INSERT Users(RoleId,FullName,Email,PasswordHash,Phone,Address,IsActive,CreatedAt)
 VALUES(@CustomerRole,@name,CONCAT('catalog14.v2.',@i,'@example.invalid'),'$2a$11$AlF8jWU8fZho8FIR0Hc/POT1yyYzu06dsVByEsLU4W6df72ClgLXq','0000000000',CONCAT(@Marker,N'customer:',@i),0,DATEADD(day,-30,@Start));
 INSERT #Users VALUES(@i,CONVERT(int,SCOPE_IDENTITY())); SET @i+=1;
END;
 DECLARE @month int=0,@n int=0,@j int,@count int,@monthStart date,@monthEnd date,@created datetime2,@age int,
  @status varchar(20),@statusId int,@method varchar(20),@pay varchar(20),@paid datetime2,@updated datetime2,
  @userId int,@address nvarchar(500),@orderId int,@lines int,@line int,@quantity int,@unit decimal(18,2),
  @r bigint,@r2 bigint,@r3 bigint,@pid int,@pop int,@productCode int;
 WHILE @month<12
 BEGIN
   SET @monthStart=DATEADD(month,@month,@Start); SET @monthEnd=DATEADD(month,@month+1,@Start);
   SET @count=36+2*@month; SET @j=1;
   WHILE @j<=@count
   BEGIN
     SET @n+=1;
     SET @r=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:date:',@n)))) & 2147483647;
     SET @r2=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:status:',@n)))) & 2147483647;
     SET @r3=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:user:',@n)))) & 2147483647;
     SET @created=DATEADD(minute,480+@r%780,CONVERT(datetime2,DATEADD(day,@r%DATEDIFF(day,@monthStart,@monthEnd),@monthStart)));
     SET @age=DATEDIFF(day,@created,@AsOf);
     -- Older orders have settled. Open orders are restricted to a realistic recent window.
     SET @status=CASE WHEN @r2%100<8 THEN 'Cancelled'
       WHEN @age<=2 THEN 'Pending'
       WHEN @age<=5 THEN CASE WHEN @r2%100<60 THEN 'Confirmed' ELSE 'Pending' END
       WHEN @age<=9 THEN CASE WHEN @r2%100<70 THEN 'Shipping' ELSE 'Confirmed' END
       WHEN @age<=14 AND @r2%100<35 THEN 'Shipping' ELSE 'Completed' END;
     SELECT @statusId=Id FROM OrderStatuses WHERE Name=@status;
     SET @method=CASE WHEN @r3%100<58 THEN 'COD' ELSE 'BankTransfer' END;
     SET @pay=CASE WHEN @status='Completed' OR (@method='BankTransfer' AND @status IN ('Confirmed','Shipping') ) THEN 'Paid' ELSE 'Unpaid' END;
     SET @updated=DATEADD(hour,CASE @status WHEN 'Pending' THEN 0 WHEN 'Confirmed' THEN 6 WHEN 'Shipping' THEN 36 WHEN 'Cancelled' THEN 2 ELSE 96 END,@created);
     SET @paid=CASE WHEN @pay='Unpaid' THEN NULL WHEN @method='COD' THEN @updated ELSE DATEADD(hour,2,@created) END;
     SELECT @userId=u.Id,@name=u.FullName,@address=u.Address FROM Users u JOIN #Users x ON x.Id=u.Id WHERE x.Code=1+@r3%80;
     INSERT Orders(UserId,StatusId,RecipientName,RecipientPhone,ShippingAddress,TotalAmount,Note,CreatedAt,UpdatedAt,PaymentMethod,PaymentStatus,PaidAt)
       VALUES(@userId,@statusId,@name,'0000000000',@address,0,@Marker+N'order:'+CONVERT(nvarchar(10),@n)+N';asOf='+CONVERT(nvarchar(10),@AsOf,23),@created,@updated,@method,@pay,@paid);
     SET @orderId=CONVERT(int,SCOPE_IDENTITY()); INSERT #Orders VALUES(@orderId);
     SET @lines=CASE WHEN @r2%100<45 THEN 1 WHEN @r2%100<85 THEN 2 ELSE 3 END;
     SET @line=1;
     WHILE @line<=@lines
     BEGIN
       SET @r=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:product:',@n,':',@line)))) & 2147483647;
       SET @r2=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:quantity:',@n,':',@line)))) & 2147483647;
       SET @r3=CONVERT(bigint,CHECKSUM(HASHBYTES('SHA2_256',CONCAT('20261029:price:',@n,':',@line)))) & 2147483647;
       SET @productCode=1+(@r%100)%14;
       SELECT @pid=Id FROM #Products WHERE Code=@productCode;
       WHILE EXISTS(SELECT 1 FROM OrderDetails WHERE OrderId=@orderId AND ProductId=@pid)
       BEGIN
         SET @productCode=@productCode%14+1;
         SELECT @pid=Id FROM #Products WHERE Code=@productCode;
       END;
       SET @quantity=CASE WHEN @r2%100<80 THEN 1 WHEN @r2%100<96 THEN 2 ELSE 3 END;
       SELECT @name=Name,@unit=ROUND(Price*(0.95+(@r3%11)*0.01),-4) FROM Products WHERE Id=@pid;
       INSERT OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice) VALUES(@orderId,@pid,@name,@quantity,@unit);
       SET @line+=1;
     END;
     UPDATE Orders SET TotalAmount=(SELECT SUM(CONVERT(decimal(18,2),Quantity)*UnitPrice) FROM OrderDetails WHERE OrderId=@orderId) WHERE Id=@orderId;
     SET @j+=1;
   END;
   SET @month+=1;
 END;

;WITH Purchases AS (
 SELECT d.ProductId,o.UserId,MIN(o.UpdatedAt) CompletedAt FROM OrderDetails d JOIN Orders o ON o.Id=d.OrderId
 JOIN OrderStatuses s ON s.Id=o.StatusId WHERE o.Id IN(SELECT Id FROM #Orders) AND s.Name='Completed' AND o.PaymentStatus='Paid'
 GROUP BY d.ProductId,o.UserId
), Ranked AS (
 SELECT *,ROW_NUMBER() OVER(PARTITION BY ProductId ORDER BY CompletedAt,UserId) rn FROM Purchases
)
INSERT ProductReviews(UserId,ProductId,Rating,Content,IsVisible,CreatedAt)
SELECT r.UserId,r.ProductId,CASE WHEN r.rn%11=0 THEN 2 WHEN r.rn%17=0 THEN 1 WHEN r.rn%5=0 THEN 3 WHEN r.rn%3=0 THEN 4 ELSE 5 END,
 CASE WHEN r.rn%11=0 THEN N'Sắc đá chưa giống kỳ vọng, tôi cần được tư vấn kỹ hơn.' WHEN r.rn%17=0 THEN N'Tôi chưa hài lòng với ngoại quan của viên đá.'
 WHEN r.rn%5=0 THEN N'Kích thước phù hợp nhưng màu sắc hơi nhạt so với mong đợi.' WHEN r.rn%3=0 THEN N'Đóng gói cẩn thận, thông tin sản phẩm rõ ràng.' ELSE N'Màu đá đẹp, tư vấn chu đáo và giao hàng cẩn thận.' END,
 1,DATEADD(hour,12,r.CompletedAt)
FROM Ranked r JOIN #Products p ON p.Id=r.ProductId WHERE r.rn<=8+p.Code%11 AND DATEADD(hour,12,r.CompletedAt)<@AsOf;
INSERT ReviewHelpfulVotes(ReviewId,UserId,CreatedAt)
SELECT r.Id,u.Id,DATEADD(hour,1,r.CreatedAt) FROM ProductReviews r JOIN #Products p ON p.Id=r.ProductId CROSS JOIN #Users u
WHERE r.UserId<>u.Id AND (u.Code*7+p.Code*3)%43=0 AND DATEADD(hour,1,r.CreatedAt)<@AsOf;
INSERT ProductQuestions(ProductId,UserId,Content,IsVisible,CreatedAt)
SELECT p.Id,u.Id,N'Cửa hàng có thể tư vấn thêm về màu sắc và cách bảo quản viên đá này không?',1,DATEADD(day,-3,@AsOf)
FROM #Products p JOIN #Users u ON u.Code=p.Code;
-- No invented admin identity or unverified certificate/answer claims.
IF EXISTS(SELECT 1 FROM Orders o JOIN #Orders n ON n.Id=o.Id WHERE o.TotalAmount<=0 OR o.TotalAmount>150000000 OR o.CreatedAt>=@AsOf OR o.UpdatedAt>=@AsOf
 OR o.PaidAt<o.CreatedAt OR o.PaidAt>=@AsOf OR o.TotalAmount<>(SELECT SUM(d.Quantity*d.UnitPrice) FROM OrderDetails d WHERE d.OrderId=o.Id))
 THROW 51200,'Order totals/date validation failed',1;
IF (SELECT COUNT(*) FROM Products WHERE IsActive=1)<>14 OR (SELECT COUNT(*) FROM #Orders)<>564
 OR EXISTS(SELECT 1 FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #Orders) AND (ProductId NOT IN(SELECT Id FROM #Products) OR Quantity NOT BETWEEN 1 AND 3 OR UnitPrice<=0))
 THROW 51200,'Catalog/order scope validation failed',1;
IF @keepOrderJson<>(SELECT * FROM Orders WHERE Id IN(SELECT Id FROM #KeepOrders) ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES)
 OR @keepDetailJson<>(SELECT * FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #KeepOrders) ORDER BY Id FOR JSON PATH,INCLUDE_NULL_VALUES)
 OR @keepReceiptJson<>(SELECT * FROM CheckoutReceipts WHERE OrderId IN(SELECT Id FROM #KeepOrders) ORDER BY OrderId FOR JSON PATH,INCLUDE_NULL_VALUES)
 OR EXISTS(SELECT * FROM #OtherOrders EXCEPT SELECT * FROM Orders)
 OR EXISTS(SELECT * FROM #OtherDetails EXCEPT SELECT * FROM OrderDetails)
 THROW 51200,'Historical records changed',1;
IF EXISTS(SELECT 1 FROM sys.foreign_keys WHERE is_disabled=1 OR is_not_trusted=1) THROW 51200,'Untrusted/disabled FK found',1;
CREATE TABLE #FK(TableName nvarchar(512),ConstraintName nvarchar(512),WhereClause nvarchar(max));
INSERT #FK EXEC('DBCC CHECKCONSTRAINTS WITH ALL_CONSTRAINTS');
IF EXISTS(SELECT 1 FROM #FK) THROW 51200,'Constraint violation found',1;
SELECT (SELECT COUNT(*) FROM #OldO) RemovedDemoOrders,(SELECT COUNT(*) FROM #OldR) RemovedDemoReviews,
 (SELECT COUNT(*) FROM #Orders) NewOrders,(SELECT COUNT(*) FROM OrderDetails WHERE OrderId IN(SELECT Id FROM #Orders)) NewOrderDetails,
 (SELECT COUNT(*) FROM ProductReviews WHERE ProductId IN(SELECT Id FROM #Products) AND UserId IN(SELECT Id FROM #Users)) NewReviews;
SELECT p.Id,p.Name,c.Name Category,p.Price,i.ImageUrl FROM Products p JOIN #Products n ON n.Id=p.Id JOIN Categories c ON c.Id=p.CategoryId JOIN ProductImages i ON i.ProductId=p.Id ORDER BY n.Code;
SELECT MIN(TotalAmount) MinTotal,MAX(TotalAmount) MaxTotal,AVG(TotalAmount) AverageTotal,MIN(CreatedAt) FirstOrder,MAX(CreatedAt) LastOrder FROM Orders WHERE Id IN(SELECT Id FROM #Orders);
IF N'$(Apply)'='1' BEGIN COMMIT; PRINT 'APPLIED'; END ELSE BEGIN ROLLBACK; PRINT 'DRY RUN PASS: ROLLED BACK'; END;
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
