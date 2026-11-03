-- Dữ liệu mẫu (TÙY CHỌN) cho máy dev/demo: 3 dịch vụ tư vấn và giờ làm việc trong tuần.
-- Chạy SAU Consultation.sql:  sqlcmd -d <database> -b -f 65001 -i ConsultationSampleData.sql
-- Chạy lại an toàn: chỉ THÊM khi chưa có — dịch vụ theo Name, giờ làm việc theo DayOfWeek.
-- Không UPDATE/DELETE dữ liệu đang có (giờ làm việc admin đã chỉnh sẽ được giữ nguyên).
SET NOCOUNT ON;
IF OBJECT_ID(N'dbo.ConsultationServices', N'U') IS NULL OR OBJECT_ID(N'dbo.ConsultationHours', N'U') IS NULL
    THROW 50001, N'ConsultationSampleData.sql: thiếu bảng tư vấn — hãy chạy Consultation.sql trước.', 1;
SET XACT_ABORT ON;
BEGIN TRY
BEGIN TRANSACTION;
DECLARE @services int, @hours int;

INSERT INTO dbo.ConsultationServices (Name, Description, Price, DurationMinutes, IsActive, SortOrder, CreatedAt)
SELECT v.Name, v.Description, v.Price, v.DurationMinutes, 1, v.SortOrder, SYSUTCDATETIME()
FROM (VALUES
    (N'Tư vấn thiết kế trang sức',
     N'Trao đổi trực tiếp với chuyên viên về ý tưởng, kiểu dáng và chất liệu để chế tác nhẫn, mặt dây hoặc bông tai gắn đá quý theo sở thích của bạn.',
     CAST(0 AS decimal(18,2)), 60, 1),
    (N'Kiểm tra & đánh giá đá quý',
     N'Chuyên viên kiểm tra đá bằng thiết bị chuyên dụng, nhận định loại đá, màu sắc, độ tinh khiết và tình trạng xử lý, kèm hướng dẫn bảo quản phù hợp.',
     CAST(500000 AS decimal(18,2)), 45, 2),
    (N'Tư vấn bộ sưu tập & quà tặng',
     N'Gợi ý lựa chọn đá quý hoặc trang sức theo dịp, ngân sách và phong cách của người nhận, giúp bạn chọn được món quà ý nghĩa.',
     CAST(0 AS decimal(18,2)), 45, 3)
) v(Name, Description, Price, DurationMinutes, SortOrder)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ConsultationServices s WITH (UPDLOCK, HOLDLOCK) WHERE s.Name = v.Name);
SET @services = @@ROWCOUNT;

-- 0 = Chủ nhật: 09:00–12:00; 1–6 = Thứ Hai–Thứ Bảy: 09:00–18:00; slot 60 phút, 2 khách/slot.
INSERT INTO dbo.ConsultationHours (DayOfWeek, IsOpen, OpenTime, CloseTime, SlotMinutes, CapacityPerSlot)
SELECT v.DayOfWeek, 1, v.OpenTime, v.CloseTime, 60, 2
FROM (VALUES
    (CAST(0 AS tinyint), CAST('09:00' AS time(0)), CAST('12:00' AS time(0))),
    (CAST(1 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0))),
    (CAST(2 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0))),
    (CAST(3 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0))),
    (CAST(4 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0))),
    (CAST(5 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0))),
    (CAST(6 AS tinyint), CAST('09:00' AS time(0)), CAST('18:00' AS time(0)))
) v(DayOfWeek, OpenTime, CloseTime)
WHERE NOT EXISTS (SELECT 1 FROM dbo.ConsultationHours h WITH (UPDLOCK, HOLDLOCK) WHERE h.DayOfWeek = v.DayOfWeek);
SET @hours = @@ROWCOUNT;

COMMIT;
PRINT CONCAT(N'ConsultationSampleData: thêm ', @services, N' dịch vụ, ', @hours, N' ngày giờ làm việc.');
END TRY
BEGIN CATCH
IF @@TRANCOUNT > 0 ROLLBACK;
THROW;
END CATCH;
