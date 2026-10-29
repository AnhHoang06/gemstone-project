-- OPTIONAL local demo. Requires Reviews.sql and the existing Payment/ProductSearch schema.
-- sqlcmd -v ReviewSeedConsent=LOCAL_SAMPLE_DATA SeedAsOf=2026-10-29
SET NOCOUNT ON;
SET XACT_ABORT ON;
IF N'$(ReviewSeedConsent)' <> N'LOCAL_SAMPLE_DATA' THROW 51000,'Local demo consent required',1;
DECLARE @asOf datetime2=TRY_CONVERT(date,'$(SeedAsOf)');
IF @asOf IS NULL OR @asOf>SYSUTCDATETIME() THROW 51000,'Use a valid non-future UTC anchor',1;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @lock int;
EXEC @lock=sys.sp_getapplock @Resource=N'ReviewDemo_v1',@LockMode='Exclusive',@LockOwner='Transaction';
IF @lock<0 THROW 51000,'Cannot acquire demo lock',1;
IF EXISTS(SELECT 1 FROM Users WHERE Email LIKE 'reviewdemo.v1.%@example.invalid')
BEGIN
 IF (SELECT COUNT(*) FROM Users WHERE Email LIKE 'reviewdemo.v1.%@example.invalid')<>21 OR
    (SELECT COUNT(*) FROM ProductReviews r JOIN Users u ON u.Id=r.UserId WHERE u.Email LIKE 'reviewdemo.v1.%@example.invalid')<>120
 THROW 51000,'Partial or changed demo: inspect before cleanup/rerun',1;
 COMMIT; PRINT 'Review demo already present; no changes.'; RETURN;
END;
DECLARE @customer int=(SELECT Id FROM Roles WHERE Name='Customer'),@adminRole int=(SELECT Id FROM Roles WHERE Name='Admin'),
 @completed int=(SELECT Id FROM OrderStatuses WHERE Name='Completed');
IF @customer IS NULL OR @adminRole IS NULL OR @completed IS NULL THROW 51000,'Missing baseline roles/status',1;
DECLARE @cat int,@admin int;
INSERT Categories(Name,Description,IsActive,CreatedAt,ParentId,SortOrder)
VALUES(N'Bộ mẫu đánh giá',N'ReviewDemo_v1:category',1,DATEADD(day,-90,@asOf),NULL,0);
SET @cat=SCOPE_IDENTITY();
DECLARE @products TABLE(n int PRIMARY KEY,id int,price decimal(18,2),name nvarchar(200));
DECLARE @n int=1;
WHILE @n<=12
BEGIN
 DECLARE @name nvarchar(200)=CHOOSE(@n,N'Ruby Huyết Bồ Câu',N'Sapphire Xanh Ceylon',N'Emerald Colombia',N'Amethyst Tím Đậm',
 N'Ruby Mozambique',N'Sapphire Vàng',N'Aquamarine Xanh Biển',N'Topaz Xanh',N'Garnet Đỏ',N'Peridot Xanh',N'Citrine Vàng',N'Tourmaline Hồng')+N' · mẫu đánh giá';
 DECLARE @price decimal(18,2)=1000000+@n*350000;
 INSERT Products(CategoryId,Name,Description,Price,Stock,IsActive,CreatedAt,SearchName)
 VALUES(@cat,@name,N'ReviewDemo_v1:product',@price,12,1,DATEADD(day,-90,@asOf),NULL);
 INSERT @products VALUES(@n,CONVERT(int,SCOPE_IDENTITY()),@price,@name);
 SET @n+=1;
END;
DECLARE @people TABLE(n int PRIMARY KEY,id int);
SET @n=1;
WHILE @n<=21
BEGIN
 INSERT Users(FullName,Email,PasswordHash,Phone,Address,RoleId,IsActive,CreatedAt)
 VALUES(CASE WHEN @n=21 THEN N'Quản trị mẫu' ELSE
 CHOOSE(1+(@n-1)%5,N'Nguyễn',N'Trần',N'Lê',N'Phạm',N'Hoàng')+N' '+CHOOSE(1+(@n-1)/5,N'Minh Anh',N'Thảo Nguyên',N'Gia Hân',N'Tuấn Khang') END,
 CONCAT('reviewdemo.v1.',@n,'@example.invalid'),
 '$2a$11$AlF8jWU8fZho8FIR0Hc/POT1yyYzu06dsVByEsLU4W6df72ClgLXq',
 '0000000000',N'ReviewDemo_v1: địa chỉ mô phỏng, không giao hàng',
 CASE WHEN @n=21 THEN @adminRole ELSE @customer END,0,DATEADD(day,-90,@asOf));
 INSERT @people VALUES(@n,CONVERT(int,SCOPE_IDENTITY()));
 SET @n+=1;
END;
SELECT @admin=id FROM @people WHERE n=21;
SET @n=1;
WHILE @n<=20
BEGIN
 DECLARE @user int=(SELECT id FROM @people WHERE n=@n),@order int,@line int=0;
 DECLARE @ordered datetime2=DATEADD(day,-70+@n,@asOf);
 INSERT Orders(UserId,StatusId,RecipientName,RecipientPhone,ShippingAddress,TotalAmount,Note,CreatedAt,UpdatedAt,PaymentMethod,PaymentStatus,PaidAt)
 VALUES(@user,@completed,N'Khách hàng mô phỏng','0000000000',N'Địa chỉ mô phỏng',0,N'ReviewDemo_v1:order',
 @ordered,DATEADD(day,4,@ordered),'COD','Paid',DATEADD(day,4,@ordered));
 SET @order=SCOPE_IDENTITY();
 WHILE @line<6
 BEGIN
  DECLARE @pn int=1+((@n-1)*5+@line)%12,@pid int,@unit decimal(18,2),@pname nvarchar(200);
  SELECT @pid=id,@unit=price,@pname=name FROM @products WHERE n=@pn;
  INSERT OrderDetails(OrderId,ProductId,ProductName,Quantity,UnitPrice) VALUES(@order,@pid,@pname,1,@unit);
  DECLARE @roll int=(@n*17+@line*13)%100;
  INSERT ProductReviews(UserId,ProductId,Rating,Content,IsVisible,CreatedAt,ModeratedAt)
  VALUES(@user,@pid,CASE WHEN @roll<4 THEN 1 WHEN @roll<12 THEN 2 WHEN @roll<28 THEN 3 WHEN @roll<65 THEN 4 ELSE 5 END,
  CASE WHEN @roll<4 THEN N'Màu thực tế chưa như mong đợi. Mong cửa hàng tư vấn kỹ hơn.'
       WHEN @roll<12 THEN N'Đóng gói ổn nhưng sắc đá khá nhạt so với kỳ vọng của tôi.'
       WHEN @roll<28 THEN N'Sản phẩm đúng thông tin, màu sắc ở mức phù hợp với giá.'
       WHEN @roll<65 THEN N'Đá đẹp, kích thước phù hợp. Cửa hàng hỗ trợ giải đáp rõ ràng.'
       ELSE N'Màu đá tự nhiên và trong, đóng gói cẩn thận. Tôi hài lòng với sản phẩm.' END,
  CASE WHEN @roll=0 THEN 0 ELSE 1 END,DATEADD(day,7+@line,@ordered),CASE WHEN @roll=0 THEN DATEADD(day,9+@line,@ordered) ELSE NULL END);
  SET @line+=1;
 END;
 UPDATE Orders SET TotalAmount=(SELECT SUM(Quantity*UnitPrice) FROM OrderDetails WHERE OrderId=@order) WHERE Id=@order;
 SET @n+=1;
END;
INSERT ReviewHelpfulVotes(ReviewId,UserId,CreatedAt)
SELECT r.Id,u.id,DATEADD(day,1,r.CreatedAt)
FROM ProductReviews r JOIN @people owner ON owner.id=r.UserId CROSS JOIN @people u
WHERE u.n<=20 AND u.id<>r.UserId AND ((owner.n*7+u.n*11+r.ProductId)%17)<3;
INSERT ProductQuestions(ProductId,UserId,Content,IsVisible,CreatedAt)
SELECT p.id,u.id,CHOOSE(1+p.n%4,N'Có thông tin nguồn gốc của viên đá không?',N'Chứng nhận được cung cấp cùng sản phẩm không?',
 N'Có thể tư vấn thêm về kích thước thực tế không?',N'Cần lưu ý gì khi bảo quản viên đá?'),
 CASE WHEN p.n=12 THEN 0 ELSE 1 END,DATEADD(day,-15+p.n,@asOf)
FROM @products p JOIN @people u ON u.n=p.n;
INSERT ProductAnswers(QuestionId,AdminUserId,Content,CreatedAt)
SELECT q.Id,@admin,N'Bạn vui lòng xem thông số và chứng nhận được công bố trên trang sản phẩm. Cửa hàng có thể tư vấn thêm theo nhu cầu của bạn.',
 DATEADD(day,1,q.CreatedAt)
FROM ProductQuestions q JOIN @products p ON p.id=q.ProductId WHERE p.n%2=0;
COMMIT;
SELECT 'ReviewDemo_v1' AS Seed,120 AS Reviews,12 AS Products,20 AS Customers,1 AS DisabledDemoAdmin,12 AS Questions,6 AS Answers;
END TRY
BEGIN CATCH
IF @@TRANCOUNT>0 ROLLBACK;
THROW;
END CATCH;
