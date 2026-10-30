-- LOCAL DEVELOPMENT SAMPLE DATA ONLY. Never execute against production/shared business data.
-- sqlcmd -S .\SQLEXPRESS -d GemstoneShop -E -C -b -f 65001
--   -v DashboardSeedConsent="LOCAL_SAMPLE_DATA" SeedAsOf="2026-10-29" -i DashboardSampleData.sql
-- Fixed PRNG seed + explicit UTC anchor => deterministic data (identity IDs need not be identical).
-- Existing rows are never updated/deleted. Existing complete seed is a no-op; partial seeds fail closed.
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(DashboardSeedConsent)' <> N'LOCAL_SAMPLE_DATA'
    THROW 51100, 'Explicit LOCAL_SAMPLE_DATA consent is required.', 1;
DECLARE @AsOf date = TRY_CONVERT(date, N'$(SeedAsOf)', 23);
IF @AsOf IS NULL OR @AsOf > CONVERT(date,SYSUTCDATETIME()) OR @AsOf < '2020-01-01'
    THROW 51101, 'SeedAsOf must be a valid non-future UTC date from 2020 onward.', 1;
IF COL_LENGTH('Categories','ParentId') IS NULL OR COL_LENGTH('Products','SearchName') IS NULL
 OR COL_LENGTH('Orders','PaymentStatus') IS NULL OR OBJECT_ID('CheckoutReceipts') IS NULL
 OR OBJECT_ID('WishlistItems') IS NULL
    THROW 51102, 'Apply the five existing baseline SQL scripts first; this seed creates no schema.', 1;

DECLARE @Marker nvarchar(80)=N'DashboardSeed_v1:', @Start date=DATEADD(month,-12,@AsOf);
BEGIN TRY
 BEGIN TRANSACTION;
 DECLARE @Lock int;
 EXEC @Lock=sys.sp_getapplock @Resource=N'DashboardSeed_v1',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=10000;
 IF @Lock < 0 THROW 51103,'Could not lock dashboard seed.',1;

 IF EXISTS(SELECT 1 FROM Users WHERE LEFT(Email,17)='dashboardseed.v1.')
 OR EXISTS(SELECT 1 FROM Categories WHERE LEFT(Description,LEN(@Marker))=@Marker)
 OR EXISTS(SELECT 1 FROM Products WHERE LEFT(Description,LEN(@Marker))=@Marker)
 OR EXISTS(SELECT 1 FROM Orders WHERE LEFT(Note,LEN(@Marker))=@Marker)
 BEGIN
   IF (SELECT COUNT(*) FROM Users WHERE Email LIKE 'dashboardseed.v1.%@example.invalid')<>120
    OR (SELECT COUNT(*) FROM Categories WHERE LEFT(Description,LEN(@Marker))=@Marker)<>12
    OR (SELECT COUNT(*) FROM Products WHERE LEFT(Description,LEN(@Marker))=@Marker)<>64
    OR (SELECT COUNT(*) FROM Orders WHERE LEFT(Note,LEN(@Marker))=@Marker)<>1062
     THROW 51104,'Partial/changed seed detected. Inspect and use guarded cleanup; no data was overwritten.',1;
   COMMIT;
   PRINT 'DashboardSeed_v1 already exists. No rows changed. Run validation/report; cleanup explicitly before changing anchor.';
   RETURN;
 END;

 DECLARE @CustomerRole int=(SELECT Id FROM Roles WHERE Name='Customer');
 IF @CustomerRole IS NULL OR (SELECT COUNT(*) FROM OrderStatuses WHERE Name IN ('Pending','Confirmed','Shipping','Completed','Cancelled'))<>5
   THROW 51105,'Required Customer role/order statuses are missing.',1;

 CREATE TABLE #Categories(Code int PRIMARY KEY, Id int NOT NULL);
 CREATE TABLE #Products(Code int PRIMARY KEY, Id int NOT NULL);
 CREATE TABLE #Users(Code int PRIMARY KEY, Id int NOT NULL);
 CREATE TABLE #Orders(Id int PRIMARY KEY);
 DECLARE @Families TABLE(Code int PRIMARY KEY,Name nvarchar(40),BasePrice decimal(18,2),Color nvarchar(30));
 INSERT @Families VALUES(1,N'Ruby',7000000,N'Đỏ'),(2,N'Sapphire',5000000,N'Xanh lam'),(3,N'Emerald',4000000,N'Xanh lục'),(4,N'Amethyst',1200000,N'Tím');
 DECLARE @Origins TABLE(Code int PRIMARY KEY,Family int,Name nvarchar(80),Origin nvarchar(40));
 INSERT @Origins VALUES
 (11,1,N'Ruby Huyết Bồ Câu',N'Myanmar'),(12,1,N'Ruby Đỏ Mozambique',N'Mozambique'),
 (21,2,N'Sapphire Xanh Ceylon',N'Sri Lanka'),(22,2,N'Sapphire Xanh Madagascar',N'Madagascar'),
 (31,3,N'Emerald Colombia',N'Colombia'),(32,3,N'Emerald Zambia',N'Zambia'),
 (41,4,N'Amethyst Tím Đậm',N'Brazil'),(42,4,N'Amethyst Tím Uruguay',N'Uruguay');
 DECLARE @Cuts TABLE(Code int PRIMARY KEY,Name nvarchar(30));
 INSERT @Cuts VALUES(1,N'Oval'),(2,N'Tròn'),(3,N'Giọt nước'),(4,N'Cushion'),(5,N'Bát giác'),(6,N'Marquise'),(7,N'Trái tim'),(8,N'Cabochon');

 DECLARE @i int=1,@id int,@name nvarchar(200),@parent int;
 WHILE @i<=4
 BEGIN
   SELECT @name=Name+N' · Bộ mẫu' FROM @Families WHERE Code=@i;
   INSERT Categories(Name,Description,IsActive,CreatedAt,ParentId,SortOrder)
     VALUES(@name,@Marker+N'category:'+CONVERT(nvarchar(10),@i),1,DATEADD(day,-60,@Start),NULL,@i);
   INSERT #Categories VALUES(@i,CONVERT(int,SCOPE_IDENTITY()));
   SET @i+=1;
 END;
 DECLARE @code int;
 SET @i=1;
 WHILE @i<=8
 BEGIN
   SET @code=((@i-1)/2+1)*10+((@i-1)%2+1);
   SELECT @name=o.Name,@parent=c.Id FROM @Origins o JOIN #Categories c ON c.Code=o.Family WHERE o.Code=@code;
   INSERT Categories(Name,Description,IsActive,CreatedAt,ParentId,SortOrder)
     VALUES(@name,@Marker+N'category:'+CONVERT(nvarchar(10),@code),1,DATEADD(day,-60,@Start),@parent,@i%2);
   INSERT #Categories VALUES(@code,CONVERT(int,SCOPE_IDENTITY()));
   SET @i+=1;
 END;

 DECLARE @family int,@variant int,@price decimal(18,2),@carat decimal(5,2),@color nvarchar(30),@origin nvarchar(40),@cut nvarchar(30),@search nvarchar(200);
 SET @i=1;
 WHILE @i<=64
 BEGIN
   SET @family=(@i-1)/16+1; SET @variant=(@i-1)%16+1;
   SET @code=@family*10+(@variant-1)/8+1;
   SET @carat=0.65+((@variant-1)%8)*0.15+((@variant-1)/8)*0.10;
   SELECT @parent=c.Id,@origin=o.Origin,@name=o.Name FROM #Categories c JOIN @Origins o ON o.Code=c.Code WHERE c.Code=@code;
   SELECT @cut=Name FROM @Cuts WHERE Code=(@variant-1)%8+1;
   SET @name=@name+N' '+@cut+N' '+REPLACE(CONVERT(nvarchar(10),@carat),'.',',')+N' ct';
   SELECT @price=ROUND(BasePrice*(0.80+@variant*0.07),-4),@color=Color FROM @Families WHERE Code=@family;
   SET @search=TRANSLATE(LOWER(@name),N'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ',
       N'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyd');
   INSERT Products(CategoryId,Name,Description,Price,Stock,Carat,Color,Clarity,Cut,Origin,IsActive,CreatedAt,SearchName)
     VALUES(@parent,@name,@Marker+N'product:'+CONVERT(nvarchar(10),@i)+N' — Dữ liệu mô phỏng, không phải hàng thực.',@price,24+@i%21,@carat,@color,N'Trong tự nhiên',@cut,@origin,1,DATEADD(day,-45,@Start),@search);
   INSERT #Products VALUES(@i,CONVERT(int,SCOPE_IDENTITY()));
   SET @i+=1;
 END;

 DECLARE @Surnames TABLE(Code int PRIMARY KEY,Name nvarchar(20));
 INSERT @Surnames VALUES(0,N'Nguyễn'),(1,N'Trần'),(2,N'Lê'),(3,N'Phạm'),(4,N'Huỳnh'),(5,N'Hoàng'),(6,N'Vũ'),(7,N'Phan'),(8,N'Đỗ'),(9,N'Bùi');
 DECLARE @Given TABLE(Code int PRIMARY KEY,Name nvarchar(50));
 INSERT @Given VALUES(0,N'Minh Anh'),(1,N'Thùy Linh'),(2,N'Quang Huy'),(3,N'Ngọc Mai'),(4,N'Đức Minh'),(5,N'Thanh Hà'),
 (6,N'Hoài Nam'),(7,N'Bảo Ngọc'),(8,N'Gia Hân'),(9,N'Tuấn Kiệt'),(10,N'Khánh Vy'),(11,N'Phương Thảo');
 SET @i=1;
 WHILE @i<=120
 BEGIN
   SELECT @name=s.Name+N' '+g.Name FROM @Surnames s CROSS JOIN @Given g WHERE s.Code=(@i-1)/12 AND g.Code=(@i-1)%12;
   -- Disabled customers, reserved email domain, non-dialable phone and synthetic address.
   -- BCrypt hash of a discarded random secret; no usable shared password is published.
   INSERT Users(RoleId,FullName,Email,PasswordHash,Phone,Address,IsActive,CreatedAt)
   VALUES(@CustomerRole,@name,'dashboardseed.v1.'+RIGHT('000'+CONVERT(varchar(3),@i),3)+'@example.invalid',
   '$2a$11$AlF8jWU8fZho8FIR0Hc/POT1yyYzu06dsVByEsLU4W6df72ClgLXq',
   '0000000000',@Marker+N'customer:'+CONVERT(nvarchar(10),@i)+N' — Địa chỉ mô phỏng, không giao hàng.',0,DATEADD(day,-30-@i%45,@Start));
   INSERT #Users VALUES(@i,CONVERT(int,SCOPE_IDENTITY()));
   SET @i+=1;
 END;

 DECLARE @month int=0,@n int=0,@j int,@count int,@monthStart date,@monthEnd date,@created datetime2,@age int,
  @status varchar(20),@statusId int,@method varchar(20),@pay varchar(20),@paid datetime2,@updated datetime2,
  @userId int,@address nvarchar(500),@orderId int,@lines int,@line int,@quantity int,@unit decimal(18,2),
  @r bigint,@r2 bigint,@r3 bigint,@pid int,@pop int,@productCode int;
 WHILE @month<12
 BEGIN
   SET @monthStart=DATEADD(month,@month,@Start); SET @monthEnd=DATEADD(month,@month+1,@Start);
   SET @count=72+3*@month; SET @j=1;
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
     SET @pay=CASE WHEN @status='Completed' OR (@method='BankTransfer' AND @status IN ('Confirmed','Shipping') AND @r2%100<80) THEN 'Paid' ELSE 'Unpaid' END;
     SET @updated=DATEADD(hour,CASE @status WHEN 'Pending' THEN 0 WHEN 'Confirmed' THEN 6 WHEN 'Shipping' THEN 36 WHEN 'Cancelled' THEN 2 ELSE 96 END,@created);
     SET @paid=CASE WHEN @pay='Unpaid' THEN NULL WHEN @method='COD' THEN @updated ELSE DATEADD(hour,2,@created) END;
     SELECT @userId=u.Id,@name=u.FullName,@address=u.Address FROM Users u JOIN #Users x ON x.Id=u.Id WHERE x.Code=1+@r3%120;
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
       SET @family=CASE WHEN @r%100<33 THEN 1 WHEN @r%100<62 THEN 2 WHEN @r%100<85 THEN 3 ELSE 4 END;
       SET @pop=(@r/100)%100;
       SET @variant=CASE WHEN @pop<17 THEN 1 WHEN @pop<29 THEN 2 ELSE 3+(@r/10000)%14 END;
       SET @productCode=(@family-1)*16+@variant;
       SELECT @pid=Id FROM #Products WHERE Code=@productCode;
       -- Avoid duplicate lines for the same product; preserve small per-line quantities.
       WHILE EXISTS(SELECT 1 FROM OrderDetails WHERE OrderId=@orderId AND ProductId=@pid)
       BEGIN
         SET @variant=@variant%16+1; SET @productCode=(@family-1)*16+@variant;
         SELECT @pid=Id FROM #Products WHERE Code=@productCode;
       END;
       SET @quantity=CASE WHEN @r2%100<80 THEN 1 WHEN @r2%100<96 THEN 2 WHEN @r2%100<99 THEN 3 ELSE 4 END;
       SELECT @name=Name,@unit=ROUND(Price*(0.95+(@r3%11)*0.01),-4) FROM Products WHERE Id=@pid;
       INSERT OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice) VALUES(@orderId,@pid,@name,@quantity,@unit);
       SET @line+=1;
     END;
     UPDATE Orders SET TotalAmount=(SELECT SUM(CONVERT(decimal(18,2),Quantity)*UnitPrice) FROM OrderDetails WHERE OrderId=@orderId) WHERE Id=@orderId;
     SET @j+=1;
   END;
   SET @month+=1;
 END;

 IF EXISTS(SELECT 1 FROM Orders o JOIN #Orders x ON x.Id=o.Id
   WHERE o.TotalAmount<=0 OR o.TotalAmount>200000000 OR o.CreatedAt>=@AsOf OR o.UpdatedAt>=@AsOf
   OR o.PaidAt<o.CreatedAt OR o.PaidAt>=@AsOf
   OR o.TotalAmount<>(SELECT SUM(d.Quantity*d.UnitPrice) FROM OrderDetails d WHERE d.OrderId=o.Id))
   THROW 51106,'Seed integrity/order-range validation failed; transaction rolled back.',1;
 IF EXISTS(SELECT 1 FROM OrderDetails d JOIN #Orders x ON x.Id=d.OrderId WHERE d.Quantity NOT BETWEEN 1 AND 4 OR d.UnitPrice<=0 OR d.UnitPrice>20000000)
   THROW 51107,'Seed price/quantity validation failed; transaction rolled back.',1;
 COMMIT;
 SELECT (SELECT COUNT(*) FROM #Users) AS GeneratedUsers,(SELECT COUNT(*) FROM #Categories) AS GeneratedCategories,
   (SELECT COUNT(*) FROM #Products) AS GeneratedProducts,(SELECT COUNT(*) FROM #Orders) AS GeneratedOrders,
   (SELECT COUNT(*) FROM OrderDetails d JOIN #Orders x ON x.Id=d.OrderId) AS GeneratedOrderDetails;
 PRINT 'Seed created. Run DashboardSampleDataReport.sql for distributions. No existing business rows were changed.';
END TRY
BEGIN CATCH
 IF @@TRANCOUNT>0 ROLLBACK;
 THROW;
END CATCH;
