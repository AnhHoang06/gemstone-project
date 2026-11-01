-- READ ONLY: seed counts, invariants and distributions. No PII is returned.
SET NOCOUNT ON;
DECLARE @Marker nvarchar(80)=N'DashboardSeed_v1:';
SELECT Id INTO #SeedOrders FROM Orders WHERE LEFT(Note,LEN(@Marker))=@Marker;
SELECT Id INTO #SeedProducts FROM Products WHERE LEFT(Description,LEN(@Marker))=@Marker;

SELECT
 (SELECT COUNT(*) FROM Users WHERE Email LIKE 'dashboardseed.v1.%@example.invalid' AND LEFT(Address,LEN(@Marker))=@Marker) AS Users,
 (SELECT COUNT(*) FROM Categories WHERE LEFT(Description,LEN(@Marker))=@Marker) AS Categories,
 (SELECT COUNT(*) FROM #SeedProducts) AS Products,
 COUNT(*) AS Orders,
 (SELECT COUNT(*) FROM OrderDetails d JOIN #SeedOrders s ON s.Id=d.OrderId) AS OrderDetails,
 COUNT(PaymentMethod) AS OrderPaymentRecords,
 SUM(CASE WHEN PaymentStatus='Paid' THEN 1 ELSE 0 END) AS PaidOrders,
 MIN(CreatedAt) AS FirstOrderUtc,MAX(CreatedAt) AS LastOrderUtc,
 MIN(TotalAmount) AS MinOrderTotal,MAX(TotalAmount) AS MaxOrderTotal,
 CONVERT(decimal(18,2),AVG(TotalAmount)) AS AverageOrderTotal
FROM Orders o JOIN #SeedOrders s ON s.Id=o.Id;

SELECT s.Name AS Status,COUNT(*) AS Orders,
 CONVERT(decimal(5,2),100.0*COUNT(*)/NULLIF((SELECT COUNT(*) FROM #SeedOrders),0)) AS PercentOfOrders
FROM Orders o JOIN #SeedOrders x ON x.Id=o.Id JOIN OrderStatuses s ON s.Id=o.StatusId GROUP BY s.Name ORDER BY Orders DESC;

SELECT PaymentMethod,PaymentStatus,COUNT(*) AS Orders FROM Orders o JOIN #SeedOrders x ON x.Id=o.Id
GROUP BY PaymentMethod,PaymentStatus ORDER BY PaymentMethod,PaymentStatus;

SELECT CONVERT(char(7),CreatedAt,126) AS MonthUtc,COUNT(*) AS Orders,
 SUM(CASE WHEN st.Name='Completed' AND PaymentStatus='Paid' THEN TotalAmount ELSE 0 END) AS QualifyingRevenue
FROM Orders o JOIN #SeedOrders x ON x.Id=o.Id JOIN OrderStatuses st ON st.Id=o.StatusId
GROUP BY CONVERT(char(7),CreatedAt,126) ORDER BY MonthUtc;

SELECT root.Id,root.Name,SUM(d.UnitPrice*d.Quantity) AS Revenue INTO #CategorySales
FROM OrderDetails d JOIN #SeedOrders x ON x.Id=d.OrderId JOIN Orders o ON o.Id=d.OrderId
JOIN OrderStatuses st ON st.Id=o.StatusId JOIN Products p ON p.Id=d.ProductId
JOIN Categories c ON c.Id=p.CategoryId JOIN Categories root ON root.Id=COALESCE(c.ParentId,c.Id)
WHERE st.Name='Completed' AND o.PaymentStatus='Paid'
GROUP BY root.Id,root.Name;
SELECT Name,Revenue,CONVERT(decimal(5,2),100.0*Revenue/NULLIF((SELECT SUM(Revenue) FROM #CategorySales),0)) AS RevenueSharePercent
FROM #CategorySales ORDER BY Revenue DESC;

SELECT p.Id,p.Name,COALESCE(c.ParentId,c.Id) AS RootId,SUM(d.UnitPrice*d.Quantity) AS Revenue INTO #ProductSales
FROM OrderDetails d JOIN #SeedOrders x ON x.Id=d.OrderId JOIN Orders o ON o.Id=d.OrderId JOIN OrderStatuses st ON st.Id=o.StatusId
JOIN Products p ON p.Id=d.ProductId JOIN Categories c ON c.Id=p.CategoryId
WHERE st.Name='Completed' AND o.PaymentStatus='Paid'
GROUP BY p.Id,p.Name,COALESCE(c.ParentId,c.Id);
SELECT TOP 8 p.Name,p.Revenue,
 CONVERT(decimal(5,2),100.0*p.Revenue/NULLIF((SELECT SUM(Revenue) FROM #ProductSales),0)) AS GlobalRevenueSharePercent,
 CONVERT(decimal(5,2),100.0*p.Revenue/NULLIF(c.Revenue,0)) AS WithinCategorySharePercent
FROM #ProductSales p JOIN #CategorySales c ON c.Id=p.RootId ORDER BY p.Revenue DESC;

SELECT d.Quantity,COUNT(*) AS Lines FROM OrderDetails d JOIN #SeedOrders s ON s.Id=d.OrderId GROUP BY d.Quantity ORDER BY d.Quantity;
SELECT COUNT(*) AS InvalidOrders FROM Orders o JOIN #SeedOrders s ON s.Id=o.Id JOIN OrderStatuses st ON st.Id=o.StatusId
WHERE o.TotalAmount<=0 OR o.CreatedAt>SYSUTCDATETIME() OR o.UpdatedAt<o.CreatedAt OR o.UpdatedAt>SYSUTCDATETIME()
 OR (o.PaymentStatus='Paid' AND (o.PaidAt IS NULL OR o.PaidAt<o.CreatedAt OR o.PaidAt>o.UpdatedAt))
 OR (o.PaymentStatus='Unpaid' AND o.PaidAt IS NOT NULL)
 OR (st.Name='Completed' AND o.PaymentStatus<>'Paid')
 OR (st.Name='Cancelled' AND o.PaymentStatus<>'Unpaid')
 OR NOT EXISTS(SELECT 1 FROM OrderDetails d WHERE d.OrderId=o.Id)
 OR o.TotalAmount<>(SELECT SUM(d.UnitPrice*d.Quantity) FROM OrderDetails d WHERE d.OrderId=o.Id);
