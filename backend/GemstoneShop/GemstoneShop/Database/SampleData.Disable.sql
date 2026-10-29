-- Tắt (IsActive = 0) mọi sản phẩm mẫu do SampleData.sql thêm, nhận diện bằng ảnh '/sample-images/%'.
-- Không xóa gì: sản phẩm mẫu có thể đã nằm trong đơn hàng, giỏ hàng hoặc danh sách yêu thích.
-- Chạy lại an toàn (lần sau tắt 0 dòng). Danh mục mẫu giữ nguyên; bật lại sản phẩm qua trang admin hoặc UPDATE thủ công.
-- Chạy:  sqlcmd -d <database> -b -f 65001 -i SampleData.Disable.sql
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
UPDATE p SET IsActive = 0, UpdatedAt = SYSUTCDATETIME()
FROM dbo.Products p
WHERE p.IsActive = 1
    AND EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = p.Id AND i.ImageUrl LIKE N'/sample-images/%');
PRINT CONCAT(N'SampleData.Disable: đã tắt ', @@ROWCOUNT, N' sản phẩm mẫu.');
COMMIT;
