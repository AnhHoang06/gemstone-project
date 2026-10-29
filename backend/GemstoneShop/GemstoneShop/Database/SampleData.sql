-- Dữ liệu mẫu (TÙY CHỌN) cho máy dev/demo: cây danh mục 3 cấp, ~30 sản phẩm tiếng Việt, chứng nhận và ảnh SVG.
-- Chạy SAU CategoryHierarchy.sql và ProductSearch.sql:  sqlcmd -d <database> -b -f 65001 -i SampleData.sql
-- Chạy lại an toàn: chỉ THÊM khi chưa có — danh mục theo (ParentId, Name), sản phẩm theo Name, chứng nhận theo
-- CertificateNumber (tiền tố GA-MAU-), ảnh theo (ProductId, ImageUrl). Không UPDATE/DELETE dữ liệu đang có.
-- Sản phẩm mẫu nhận diện bằng ảnh '/sample-images/%' (wwwroot/sample-images). Tắt chúng bằng SampleData.Disable.sql.
-- SearchName được điền sẵn bằng đúng quy tắc CatalogQueries.NormalizeSearch (startup backfill sẽ thấy khớp, không ghi lại).
-- Sản phẩm trùng tên với sản phẩm thật đã có sẽ bị bỏ qua (không gắn ảnh/chứng nhận mẫu vào sản phẩm thật).
SET NOCOUNT ON;
IF COL_LENGTH('dbo.Categories', 'ParentId') IS NULL OR COL_LENGTH('dbo.Categories', 'SortOrder') IS NULL
    THROW 50001, N'SampleData.sql: thiếu cột Categories.ParentId/SortOrder — hãy chạy CategoryHierarchy.sql trước.', 1;
IF COL_LENGTH('dbo.Products', 'SearchName') IS NULL
    THROW 50002, N'SampleData.sql: thiếu cột Products.SearchName — hãy chạy ProductSearch.sql trước.', 1;
GO
SET NOCOUNT ON;
SET XACT_ABORT ON;
BEGIN TRANSACTION;
DECLARE @categories int = 0, @products int = 0, @certificates int = 0, @images int = 0, @n int;
CREATE TABLE #Cat (Code varchar(60) NOT NULL PRIMARY KEY, ParentCode varchar(60) NULL, Lvl int NOT NULL, Name nvarchar(200) NOT NULL,
    SortOrder int NOT NULL, Description nvarchar(1000) NULL, Id int NULL);
INSERT INTO #Cat (Code, ParentCode, Lvl, Name, SortOrder, Description) VALUES
    ('ruby', NULL, 1, N'Ruby', 1, N'Đá Ruby'),
    ('sapphire', NULL, 1, N'Sapphire', 2, N'Đá Sapphire'),
    ('emerald', NULL, 1, N'Emerald', 3, N'Đá Emerald'),
    ('diamond', NULL, 1, N'Diamond', 4, N'Kim cương'),
    ('amethyst', NULL, 1, N'Amethyst', 5, N'Đá thạch anh tím'),
    ('aquamarine', NULL, 1, N'Aquamarine', 6, N'Đá Aquamarine (ngọc xanh biển)'),
    ('garnet', NULL, 1, N'Garnet', 7, N'Đá Garnet (ngọc hồng lựu)'),
    ('ruby.loose', 'ruby', 2, N'Đá rời', 1, N'Ruby chưa gắn trang sức'),
    ('ruby.loose.myanmar', 'ruby.loose', 3, N'Ruby Myanmar', 1, NULL),
    ('ruby.loose.mozambique', 'ruby.loose', 3, N'Ruby Mozambique', 2, NULL),
    ('ruby.jewelry', 'ruby', 2, N'Trang sức Ruby', 2, NULL),
    ('ruby.jewelry.ring', 'ruby.jewelry', 3, N'Nhẫn Ruby', 1, NULL),
    ('sapphire.loose', 'sapphire', 2, N'Đá rời', 1, N'Sapphire chưa gắn trang sức'),
    ('sapphire.loose.ceylon', 'sapphire.loose', 3, N'Sapphire Ceylon', 1, NULL),
    ('sapphire.loose.padparadscha', 'sapphire.loose', 3, N'Sapphire Padparadscha', 2, NULL),
    ('sapphire.jewelry', 'sapphire', 2, N'Trang sức Sapphire', 2, NULL),
    ('sapphire.jewelry.ring', 'sapphire.jewelry', 3, N'Nhẫn Sapphire', 1, NULL),
    ('emerald.loose', 'emerald', 2, N'Đá rời', 1, N'Emerald chưa gắn trang sức'),
    ('emerald.loose.colombia', 'emerald.loose', 3, N'Emerald Colombia', 1, NULL),
    ('emerald.loose.zambia', 'emerald.loose', 3, N'Emerald Zambia', 2, NULL),
    ('emerald.jewelry', 'emerald', 2, N'Trang sức Emerald', 2, NULL),
    ('emerald.jewelry.ring', 'emerald.jewelry', 3, N'Nhẫn Emerald', 1, NULL),
    ('diamond.ring', 'diamond', 2, N'Nhẫn', 1, N'Nhẫn kim cương'),
    ('diamond.ring.solitaire', 'diamond.ring', 3, N'Nhẫn Solitaire', 1, NULL),
    ('diamond.ring.halo', 'diamond.ring', 3, N'Nhẫn Halo', 2, NULL),
    ('diamond.ring.threestone', 'diamond.ring', 3, N'Nhẫn Three-stone & Đính đá phụ', 3, NULL),
    ('diamond.earring', 'diamond', 2, N'Bông tai', 2, N'Bông tai kim cương'),
    ('diamond.earring.stud', 'diamond.earring', 3, N'Bông tai đeo sát', 1, NULL),
    ('diamond.earring.drop', 'diamond.earring', 3, N'Bông tai thả', 2, NULL),
    ('diamond.necklace', 'diamond', 2, N'Dây chuyền', 3, N'Dây chuyền kim cương'),
    ('diamond.necklace.pendant', 'diamond.necklace', 3, N'Mặt dây chuyền', 1, NULL),
    ('amethyst.loose', 'amethyst', 2, N'Đá rời', 1, N'Thạch anh tím chưa gắn trang sức'),
    ('amethyst.loose.uruguay', 'amethyst.loose', 3, N'Thạch anh tím Uruguay', 1, NULL),
    ('amethyst.loose.brazil', 'amethyst.loose', 3, N'Thạch anh tím Brazil', 2, NULL),
    ('amethyst.jewelry', 'amethyst', 2, N'Trang sức thạch anh tím', 2, NULL),
    ('amethyst.jewelry.ring', 'amethyst.jewelry', 3, N'Nhẫn thạch anh tím', 1, NULL),
    ('aquamarine.loose', 'aquamarine', 2, N'Đá rời', 1, N'Aquamarine chưa gắn trang sức'),
    ('aquamarine.loose.brazil', 'aquamarine.loose', 3, N'Aquamarine Brazil', 1, NULL),
    ('aquamarine.loose.madagascar', 'aquamarine.loose', 3, N'Aquamarine Madagascar', 2, NULL),
    ('garnet.loose', 'garnet', 2, N'Đá rời', 1, N'Garnet chưa gắn trang sức'),
    ('garnet.loose.rhodolite', 'garnet.loose', 3, N'Garnet Rhodolite', 1, NULL),
    ('garnet.loose.pyrope', 'garnet.loose', 3, N'Garnet Pyrope', 2, NULL),
    ('garnet.jewelry', 'garnet', 2, N'Trang sức Garnet', 2, NULL);
DECLARE @lvl int = 1;
WHILE @lvl <= 3
BEGIN
    UPDATE c SET Id = p.Id FROM #Cat c LEFT JOIN #Cat pc ON pc.Code = c.ParentCode
    CROSS APPLY (SELECT TOP 1 x.Id FROM dbo.Categories x WHERE x.Name = c.Name
        AND ((c.ParentCode IS NULL AND x.ParentId IS NULL) OR x.ParentId = pc.Id) ORDER BY x.Id) p
    WHERE c.Lvl = @lvl;
    INSERT INTO dbo.Categories (Name, Description, IsActive, ParentId, SortOrder)
    SELECT c.Name, c.Description, 1, pc.Id, c.SortOrder FROM #Cat c LEFT JOIN #Cat pc ON pc.Code = c.ParentCode
    WHERE c.Lvl = @lvl AND c.Id IS NULL AND (c.ParentCode IS NULL OR pc.Id IS NOT NULL) ORDER BY c.SortOrder, c.Code;
    SET @categories += @@ROWCOUNT;
    UPDATE c SET Id = p.Id FROM #Cat c LEFT JOIN #Cat pc ON pc.Code = c.ParentCode
    CROSS APPLY (SELECT TOP 1 x.Id FROM dbo.Categories x WHERE x.Name = c.Name
        AND ((c.ParentCode IS NULL AND x.ParentId IS NULL) OR x.ParentId = pc.Id) ORDER BY x.Id) p
    WHERE c.Lvl = @lvl AND c.Id IS NULL;
    SET @lvl += 1;
END;
-- A same-named category nested deeper than 3 levels (or similar drift) must not silently drop sample rows.
IF EXISTS (SELECT 1 FROM #Cat WHERE Id IS NULL)
    THROW 50003, N'SampleData.sql: không xác định được danh mục mẫu.', 1;

CREATE TABLE #P (Seq int NOT NULL PRIMARY KEY, CatCode varchar(60) NOT NULL, Name nvarchar(200) NOT NULL, SearchName nvarchar(200) NOT NULL,
    Description nvarchar(max) NULL, Price decimal(18,2) NOT NULL, Stock int NOT NULL, Carat decimal(6,2) NULL, Color nvarchar(100) NULL,
    Clarity nvarchar(100) NULL, Cut nvarchar(100) NULL, Origin nvarchar(150) NULL, CertNumber nvarchar(100) NULL, CertAuthority nvarchar(100) NULL,
    CertIssueDate date NULL, Image1 nvarchar(200) NOT NULL, Image2 nvarchar(200) NULL, ProductId int NULL);
INSERT INTO #P (Seq, CatCode, Name, SearchName, Description, Price, Stock, Carat, Color, Clarity, Cut, Origin,
    CertNumber, CertAuthority, CertIssueDate, Image1, Image2) VALUES
    (1, 'ruby.loose.myanmar', N'Ruby Myanmar Oval Huyết Bồ Câu 2.05ct', N'ruby myanmar oval huyet bo cau 2.05ct',
     N'Viên ruby Mogok sắc đỏ huyết bồ câu, phát quang mạnh dưới ánh sáng ban ngày. Chưa qua xử lý nhiệt.',
     265000000, 2, 2.05, N'Đỏ huyết bồ câu', N'Eye clean', N'Oval', N'Mogok, Myanmar', N'GA-MAU-0001', N'GRS', '2025-03-14', N'/sample-images/ruby-oval.svg', N'/sample-images/ruby-round.svg'),
    (2, 'ruby.loose.myanmar', N'Ruby Myanmar Cushion Mong Hsu 1.52ct', N'ruby myanmar cushion mong hsu 1.52ct',
     N'Ruby Mong Hsu đỏ đậm, giác cushion cân đối. Phù hợp làm nhẫn đính hôn hoặc mặt dây chuyền.',
     198000000, 1, 1.52, N'Đỏ đậm', N'VS', N'Cushion', N'Mong Hsu, Myanmar', N'GA-MAU-0002', N'SSEF', '2024-11-02', N'/sample-images/ruby-cushion.svg', NULL),
    (3, 'ruby.loose.mozambique', N'Ruby Mozambique Tròn 1.20ct', N'ruby mozambique tron 1.20ct',
     N'Ruby Montepuez đỏ tươi, giác tròn sáng lấp lánh. Giá dễ tiếp cận cho người mới sưu tầm.',
     72000000, 4, 1.20, N'Đỏ tươi', N'SI', N'Round brilliant', N'Montepuez, Mozambique', N'GA-MAU-0003', N'AGL', '2025-01-20', N'/sample-images/ruby-round.svg', NULL),
    (4, 'ruby.loose.mozambique', N'Ruby Mozambique Oval 3.10ct', N'ruby mozambique oval 3.10ct',
     N'Viên ruby kích thước lớn, sắc đỏ hồng đều màu. Hiện đã bán hết, nhận đặt trước.',
     158000000, 0, 3.10, N'Đỏ hồng', N'VS', N'Oval', N'Montepuez, Mozambique', N'GA-MAU-0004', N'GRS', '2024-09-18', N'/sample-images/ruby-oval.svg', NULL),
    (5, 'ruby.jewelry.ring', N'Nhẫn Ruby Oval Halo Vàng 18K', N'nhan ruby oval halo vang 18k',
     N'Nhẫn vàng 18K với ruby oval ở trung tâm và vòng kim cương tấm bao quanh.',
     46500000, 5, 0.85, N'Đỏ tươi', N'SI', N'Oval', N'Thái Lan', NULL, NULL, NULL, N'/sample-images/ruby-oval.svg', N'/sample-images/diamond-round.svg'),
    (6, 'sapphire.loose.ceylon', N'Sapphire Ceylon Xanh Hoàng Gia 2.40ct', N'sapphire ceylon xanh hoang gia 2.40ct',
     N'Sapphire Ratnapura sắc xanh hoàng gia sâu, ánh nhung. Giác cushion giữ màu tốt.',
     185000000, 2, 2.40, N'Xanh hoàng gia', N'VS', N'Cushion', N'Ratnapura, Sri Lanka', N'GA-MAU-0005', N'GRS', '2025-02-07', N'/sample-images/sapphire-cushion.svg', N'/sample-images/sapphire-oval.svg'),
    (7, 'sapphire.loose.ceylon', N'Sapphire Ceylon Xanh Ngô Đồng Oval 1.65ct', N'sapphire ceylon xanh ngo dong oval 1.65ct',
     N'Sắc xanh ngô đồng (cornflower) sáng và trong, rất được ưa chuộng cho nhẫn hằng ngày.',
     96000000, 3, 1.65, N'Xanh ngô đồng', N'VVS', N'Oval', N'Elahera, Sri Lanka', N'GA-MAU-0006', N'GIA', '2024-12-10', N'/sample-images/sapphire-oval.svg', NULL),
    (8, 'sapphire.loose.padparadscha', N'Sapphire Padparadscha Oval 1.32ct', N'sapphire padparadscha oval 1.32ct',
     N'Padparadscha hồng cam như hoa sen, loại sapphire hiếm bậc nhất. Không xử lý nhiệt.',
     215000000, 1, 1.32, N'Hồng cam hoa sen', N'VS', N'Oval', N'Sri Lanka', N'GA-MAU-0007', N'SSEF', '2025-04-22', N'/sample-images/padparadscha-oval.svg', NULL),
    (9, 'sapphire.loose.padparadscha', N'Sapphire Padparadscha Cushion 0.98ct', N'sapphire padparadscha cushion 0.98ct',
     N'Viên padparadscha tông hồng cam ấm, giác cushion mềm mại. Tạm hết hàng.',
     138000000, 0, 0.98, N'Hồng cam', N'Eye clean', N'Cushion', N'Madagascar', N'GA-MAU-0008', N'AGL', '2024-08-30', N'/sample-images/padparadscha-cushion.svg', NULL),
    (10, 'sapphire.jewelry.ring', N'Nhẫn Sapphire Emerald-cut Viền Kim Cương', N'nhan sapphire emerald-cut vien kim cuong',
     N'Sapphire giác emerald-cut trên đai vàng trắng 18K, hai bên đính kim cương baguette.',
     128000000, 2, 1.80, N'Xanh lam đậm', N'VS', N'Emerald cut', N'Madagascar', N'GA-MAU-0009', N'PNJLab', '2025-05-06', N'/sample-images/sapphire-emerald-cut.svg', N'/sample-images/diamond-round.svg'),
    (11, 'sapphire.jewelry', N'Bông tai Sapphire Oval Vàng Trắng', N'bong tai sapphire oval vang trang',
     N'Cặp bông tai sapphire oval tổng 2.10ct, móc vàng trắng 14K chắc chắn.',
     89000000, 4, 2.10, N'Xanh lam', N'SI', N'Oval', N'Sri Lanka', NULL, NULL, NULL, N'/sample-images/sapphire-oval.svg', NULL),
    (12, 'emerald.loose.colombia', N'Emerald Colombia Muzo Emerald-cut 2.15ct', N'emerald colombia muzo emerald-cut 2.15ct',
     N'Emerald Muzo xanh lục đậm, giác emerald-cut cổ điển. Chỉ tẩm dầu nhẹ.',
     312000000, 1, 2.15, N'Xanh lục đậm', N'Minor oil', N'Emerald cut', N'Muzo, Colombia', N'GA-MAU-0010', N'SSEF', '2025-01-28', N'/sample-images/emerald-emerald-cut.svg', N'/sample-images/emerald-octagon.svg'),
    (13, 'emerald.loose.zambia', N'Emerald Zambia Giọt Nước 1.85ct', N'emerald zambia giot nuoc 1.85ct',
     N'Emerald Kagem xanh lục ánh lam, độ trong tốt so với dòng emerald. Hợp làm mặt dây chuyền.',
     88000000, 3, 1.85, N'Xanh lục ánh lam', N'SI', N'Pear', N'Kagem, Zambia', N'GA-MAU-0011', N'AGL', '2024-10-15', N'/sample-images/emerald-pear.svg', NULL),
    (14, 'emerald.jewelry.ring', N'Nhẫn Emerald Bát Giác Vàng Trắng 18K', N'nhan emerald bat giac vang trang 18k',
     N'Nhẫn emerald giác bát giác, ổ chấu kép giữ đá an toàn khi đeo hằng ngày.',
     74000000, 2, 1.05, N'Xanh lục', N'SI', N'Octagonal step', N'Zambia', NULL, NULL, NULL, N'/sample-images/emerald-octagon.svg', NULL),
    (15, 'emerald', N'Emerald Zambia Emerald-cut 0.92ct', N'emerald zambia emerald-cut 0.92ct',
     N'Viên emerald nhỏ xinh cho người mới bắt đầu sưu tầm. Đã bán hết.',
     36000000, 0, 0.92, N'Xanh lục', N'SI', N'Emerald cut', N'Zambia', NULL, NULL, NULL, N'/sample-images/emerald-emerald-cut.svg', NULL),
    (16, 'diamond.ring.solitaire', N'Nhẫn Solitaire Kim Cương Tròn 1.01ct', N'nhan solitaire kim cuong tron 1.01ct',
     N'Nhẫn đính hôn solitaire 6 chấu, kim cương tròn nước E giác cắt Excellent.',
     285000000, 2, 1.01, N'E', N'VS1', N'Round brilliant', N'Botswana', N'GA-MAU-0012', N'GIA', '2025-02-19', N'/sample-images/diamond-round.svg', NULL),
    (17, 'diamond.ring.halo', N'Nhẫn Halo Kim Cương Giọt Nước 0.50ct', N'nhan halo kim cuong giot nuoc 0.50ct',
     N'Kim cương giọt nước được bao bởi vòng halo kim cương tấm, tôn kích thước viên chủ.',
     98000000, 4, 0.50, N'G', N'SI1', N'Pear', N'Canada', N'GA-MAU-0013', N'GIA', '2024-12-03', N'/sample-images/diamond-pear.svg', NULL),
    (18, 'diamond.ring.halo', N'Nhẫn Halo Kim Cương Princess 0.60ct', N'nhan halo kim cuong princess 0.60ct',
     N'Kim cương giác princess vuông trên nền halo vàng trắng. Tạm hết hàng.',
     112000000, 0, 0.60, N'F', N'VS2', N'Princess', N'Nga', N'GA-MAU-0014', N'PNJLab', '2025-03-01', N'/sample-images/diamond-princess.svg', NULL),
    (19, 'diamond.ring.threestone', N'Nhẫn Three-stone Kim Cương Tròn 1.20ct', N'nhan three-stone kim cuong tron 1.20ct',
     N'Ba viên kim cương tròn tổng 1.20ct tượng trưng cho quá khứ, hiện tại và tương lai.',
     236000000, 1, 1.20, N'F', N'VS1', N'Round brilliant', N'Botswana', N'GA-MAU-0015', N'GIA', '2025-04-11', N'/sample-images/diamond-round.svg', N'/sample-images/diamond-oval.svg'),
    (20, 'diamond.ring.threestone', N'Nhẫn Kim Cương Marquise Đính Đá Phụ 0.45ct', N'nhan kim cuong marquise dinh da phu 0.45ct',
     N'Kim cương marquise thon dài, hai bên đai đính đá phụ giúp ngón tay trông thon gọn.',
     76000000, 3, 0.45, N'H', N'SI1', N'Marquise', N'Canada', NULL, NULL, NULL, N'/sample-images/diamond-marquise.svg', NULL),
    (21, 'diamond.earring.stud', N'Bông Tai Kim Cương Đeo Sát Tròn 0.60ct', N'bong tai kim cuong deo sat tron 0.60ct',
     N'Cặp bông tai đeo sát, mỗi bên một viên kim cương tròn 0.30ct, khóa vặn an toàn.',
     58000000, 6, 0.60, N'G', N'VS2', N'Round brilliant', N'Nga', N'GA-MAU-0016', N'PNJLab', '2024-11-25', N'/sample-images/diamond-round.svg', NULL),
    (22, 'diamond.earring.drop', N'Bông Tai Kim Cương Thả Giọt Nước 0.80ct', N'bong tai kim cuong tha giot nuoc 0.80ct',
     N'Bông tai thả với kim cương giọt nước đung đưa theo chuyển động, hợp tiệc tối.',
     124000000, 2, 0.80, N'F', N'VS1', N'Pear', N'Botswana', N'GA-MAU-0017', N'GIA', '2025-01-09', N'/sample-images/diamond-pear.svg', N'/sample-images/diamond-marquise.svg'),
    (23, 'diamond.necklace.pendant', N'Mặt Dây Chuyền Kim Cương Tròn 0.40ct', N'mat day chuyen kim cuong tron 0.40ct',
     N'Mặt dây chuyền kim cương tròn đơn giản, kèm dây vàng trắng 18K dài 45cm.',
     64000000, 5, 0.40, N'G', N'VS2', N'Round brilliant', N'Nam Phi', NULL, NULL, NULL, N'/sample-images/diamond-round.svg', NULL),
    (24, 'diamond', N'Kim Cương Rời Princess 0.90ct', N'kim cuong roi princess 0.90ct',
     N'Kim cương rời giác princess nước E, độ tinh khiết VVS2, sẵn sàng gắn theo thiết kế riêng.',
     165000000, 1, 0.90, N'E', N'VVS2', N'Princess', N'Canada', N'GA-MAU-0018', N'GIA', '2025-05-15', N'/sample-images/diamond-princess.svg', NULL),
    (25, 'diamond.ring.solitaire', N'Nhẫn Solitaire Kim Cương Oval 0.70ct', N'nhan solitaire kim cuong oval 0.70ct',
     N'Kim cương oval trông lớn hơn viên tròn cùng trọng lượng, ổ 4 chấu thanh mảnh.',
     142000000, 3, 0.70, N'F', N'VS2', N'Oval', N'Nam Phi', N'GA-MAU-0019', N'GIA', '2024-10-21', N'/sample-images/diamond-oval.svg', NULL),
    (26, 'amethyst.loose.uruguay', N'Thạch Anh Tím Uruguay Cushion 6.20ct', N'thach anh tim uruguay cushion 6.20ct',
     N'Thạch anh tím Artigas tím đậm ánh đỏ, kích thước lớn với giá hợp lý.',
     22000000, 5, 6.20, N'Tím đậm ánh đỏ', N'Eye clean', N'Cushion', N'Artigas, Uruguay', N'GA-MAU-0020', N'PNJLab', '2025-02-27', N'/sample-images/amethyst-cushion.svg', NULL),
    (27, 'amethyst.loose.brazil', N'Thạch Anh Tím Brazil Giọt Nước 4.80ct', N'thach anh tim brazil giot nuoc 4.80ct',
     N'Thạch anh tím Minas Gerais tông tím vừa, giác giọt nước hợp làm mặt dây chuyền.',
     9500000, 8, 4.80, N'Tím vừa', N'Eye clean', N'Pear', N'Minas Gerais, Brazil', NULL, NULL, NULL, N'/sample-images/amethyst-pear.svg', NULL),
    (28, 'amethyst.jewelry.ring', N'Nhẫn Thạch Anh Tím Marquise Bạc 925', N'nhan thach anh tim marquise bac 925',
     N'Nhẫn bạc 925 mạ rhodium với thạch anh tím marquise 2.10ct, món quà sinh nhật tháng Hai.',
     4800000, 7, 2.10, N'Tím', N'Eye clean', N'Marquise', N'Brazil', NULL, NULL, NULL, N'/sample-images/amethyst-marquise.svg', NULL),
    (29, 'aquamarine.loose.brazil', N'Aquamarine Santa Maria Emerald-cut 3.40ct', N'aquamarine santa maria emerald-cut 3.40ct',
     N'Aquamarine sắc xanh biển Santa Maria đậm và hiếm, giác emerald-cut trong vắt.',
     54000000, 2, 3.40, N'Xanh biển Santa Maria', N'VVS', N'Emerald cut', N'Minas Gerais, Brazil', N'GA-MAU-0021', N'GRS', '2025-03-30', N'/sample-images/aquamarine-emerald-cut.svg', N'/sample-images/aquamarine-oval.svg'),
    (30, 'aquamarine.loose.madagascar', N'Aquamarine Madagascar Oval 2.60ct', N'aquamarine madagascar oval 2.60ct',
     N'Aquamarine xanh nhạt mát mắt, giác oval sáng. Lựa chọn nhẹ nhàng cho trang sức hằng ngày.',
     26000000, 4, 2.60, N'Xanh nhạt', N'Eye clean', N'Oval', N'Madagascar', N'GA-MAU-0022', N'AGL', '2024-09-05', N'/sample-images/aquamarine-oval.svg', NULL),
    (31, 'garnet.loose.rhodolite', N'Garnet Rhodolite Tròn 2.30ct', N'garnet rhodolite tron 2.30ct',
     N'Garnet rhodolite đỏ tía ánh hồng, giác tròn lấp lánh với giá mềm.',
     7800000, 6, 2.30, N'Đỏ tía', N'Eye clean', N'Round brilliant', N'Tanzania', N'GA-MAU-0023', N'PNJLab', '2025-04-03', N'/sample-images/garnet-round.svg', NULL),
    (32, 'garnet.loose.pyrope', N'Garnet Pyrope Cushion 3.05ct', N'garnet pyrope cushion 3.05ct',
     N'Garnet pyrope đỏ thẫm như rượu vang, giác cushion cổ điển.',
     6200000, 8, 3.05, N'Đỏ thẫm', N'Eye clean', N'Cushion', N'Mozambique', NULL, NULL, NULL, N'/sample-images/garnet-cushion.svg', NULL),
    (33, 'garnet.jewelry', N'Nhẫn Garnet Đỏ Thẫm Bạc 925', N'nhan garnet do tham bac 925',
     N'Nhẫn bạc 925 đính garnet tròn 1.80ct, phong cách cổ điển. Tạm hết hàng.',
     3900000, 0, 1.80, N'Đỏ thẫm', N'Eye clean', N'Round brilliant', N'Ấn Độ', NULL, NULL, NULL, N'/sample-images/garnet-round.svg', N'/sample-images/garnet-cushion.svg');

DECLARE @new TABLE (Id int NOT NULL PRIMARY KEY);
INSERT INTO dbo.Products (CategoryId, Name, Description, Price, Stock, Carat, Color, Clarity, Cut, Origin, IsActive, SearchName)
OUTPUT INSERTED.Id INTO @new (Id)
SELECT c.Id, p.Name, p.Description, p.Price, p.Stock, p.Carat, p.Color, p.Clarity, p.Cut, p.Origin, 1, p.SearchName
FROM #P p JOIN #Cat c ON c.Code = p.CatCode
WHERE NOT EXISTS (SELECT 1 FROM dbo.Products x WHERE x.Name = p.Name) ORDER BY p.Seq;
SET @products = @@ROWCOUNT;
-- Only products created by this script (now or in an earlier run, recognisable by a sample image) get certificates/images.
UPDATE p SET ProductId = x.Id FROM #P p CROSS APPLY (SELECT TOP 1 pr.Id FROM dbo.Products pr WHERE pr.Name = p.Name
    AND (pr.Id IN (SELECT Id FROM @new) OR EXISTS (SELECT 1 FROM dbo.ProductImages i WHERE i.ProductId = pr.Id AND i.ImageUrl LIKE N'/sample-images/%'))
    ORDER BY pr.Id) x;

INSERT INTO dbo.Certificates (ProductId, CertificateNumber, Authority, IssueDate, Notes)
SELECT p.ProductId, p.CertNumber, p.CertAuthority, p.CertIssueDate, N'Chứng nhận mẫu cho môi trường demo.' FROM #P p
WHERE p.ProductId IS NOT NULL AND p.CertNumber IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.Certificates x WHERE x.CertificateNumber = p.CertNumber)
    AND NOT EXISTS (SELECT 1 FROM dbo.Certificates x WHERE x.ProductId = p.ProductId);
SET @certificates = @@ROWCOUNT;

INSERT INTO dbo.ProductImages (ProductId, ImageUrl, IsPrimary, SortOrder)
SELECT p.ProductId, img.Url, CASE WHEN img.Ord = 0 AND NOT EXISTS (SELECT 1 FROM dbo.ProductImages x WHERE x.ProductId = p.ProductId AND x.IsPrimary = 1)
    THEN 1 ELSE 0 END, img.Ord
FROM #P p CROSS APPLY (VALUES (p.Image1, 0), (p.Image2, 1)) img (Url, Ord)
WHERE p.ProductId IS NOT NULL AND img.Url IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.ProductImages x WHERE x.ProductId = p.ProductId AND x.ImageUrl = img.Url)
ORDER BY p.Seq, img.Ord;
SET @images = @@ROWCOUNT;

SELECT @n = COUNT(*) FROM #P WHERE ProductId IS NULL;
PRINT CONCAT(N'SampleData: +', @categories, N' danh mục, +', @products, N' sản phẩm, +', @certificates, N' chứng nhận, +', @images, N' ảnh.');
IF @n > 0 PRINT CONCAT(N'SampleData: bỏ qua ', @n, N' sản phẩm mẫu vì trùng tên với sản phẩm đã có.');
DROP TABLE #P;
DROP TABLE #Cat;
COMMIT;
