# Gem Aurelia — Website bán đá quý (Bài nộp)

Website thương mại điện tử bán đá quý: ASP.NET Core 8 Web API + EF Core (Database First) + SQL Server; giao diện React 19 + Vite + Bootstrap; xác thực JWT, cập nhật thời gian thực bằng SignalR.

- Mã nguồn: https://github.com/AnhHoang06/gemstone-project — nhánh `main`, commit `<<COMMIT>>`
- Ngày đóng gói: <<DATE>>

## Cấu trúc gói nộp

```
GemAurelia_Submission/
├── README_NopBai.md          ← tệp này
├── SETUP.md                  ← hướng dẫn cài đặt chi tiết (tiếng Anh), có tài khoản demo
├── README.md                 ← tài liệu kỹ thuật cho lập trình viên
├── backend/                  ← ASP.NET Core 8 Web API
├── frontend/                 ← React + Vite
├── database/
│   ├── GemstoneShop_Final.bak    ← bản sao lưu CSDL demo (SQL Server 2025 / 17.x)
│   ├── scripts/                  ← bản sao các script SQL
│   └── README_Database.md        ← thứ tự script, dữ liệu demo
├── docs/                     ← tài liệu từng chức năng, ảnh chụp màn hình
└── tests/                    ← kiểm thử tích hợp (không chạy trên CSDL demo)
```

## Chạy nhanh

1. Khôi phục `database/GemstoneShop_Final.bak` vào SQL Server **2025 (17.x) trở lên** (`SETUP.md` mục B, có cả cách dùng SSMS).
2. Đặt khóa JWT: `dotnet user-secrets set "Jwt:Key" ...` (`SETUP.md` mục C.2).
3. Chạy API (`SETUP.md` mục C.4): http://localhost:5113
4. Chạy giao diện: trong `frontend` chạy `npm ci`, đặt `VITE_API_BASE_URL=http://localhost:5113/api`, rồi `npm run dev` (`SETUP.md` mục D).
5. Mở **http://localhost:2222**.

## TÀI KHOẢN DEMO — CHỈ DÙNG ĐỂ CHẤM BÀI / THUYẾT TRÌNH

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@gemaurelia.test` | `<<ADMIN_PASSWORD>>` |
| Khách hàng | `customer@gemaurelia.test` | `<<CUSTOMER_PASSWORD>>` |

Hai tài khoản nằm sẵn trong `GemstoneShop_Final.bak` và đã được kiểm tra đăng nhập đúng vai trò. Mật khẩu chỉ có trong gói nộp, không có trên GitHub. Không dùng các mật khẩu này cho hệ thống thật.

## Dữ liệu demo trong CSDL

- 5 danh mục (Ruby, Sapphire, Emerald, Diamond, Amethyst), 14 sản phẩm đang bán, mỗi sản phẩm có ảnh (phục vụ từ `backend/GemstoneShop/GemstoneShop/wwwroot/catalog-gems/`).
- Khoảng 575 đơn hàng trong 12 tháng gần nhất (để dashboard có số liệu), 173 đánh giá của người mua đã hoàn tất đơn, câu hỏi/trả lời sản phẩm.
- 3 dịch vụ tư vấn và giờ làm việc trong tuần cho chức năng đặt lịch.
- Các khách hàng tạo tự động phía sau đơn hàng demo đều bị vô hiệu hóa, không đăng nhập được.

## Chức năng đã hoàn thành

**Khách hàng**
- Đăng ký, đăng nhập, hồ sơ, đổi mật khẩu.
- Danh mục sản phẩm dạng cây 3 cấp, tìm kiếm tiếng Việt có/không dấu, lọc; chi tiết sản phẩm với thông số, đánh giá, hỏi đáp, sản phẩm liên quan và đã xem gần đây.
- Danh sách yêu thích, giỏ hàng, đặt hàng (chống đặt trùng, trừ kho trong giao dịch).
- Thanh toán **COD** hoặc **chuyển khoản ngân hàng qua mã VietQR** tạo cục bộ: khách bấm "Tôi đã chuyển khoản", admin xác nhận đã nhận tiền.
- Lịch sử đơn hàng, cập nhật trạng thái thời gian thực; hủy đơn, sửa thông tin giao hàng khi đơn còn Pending/Confirmed.
- Đánh giá sản phẩm sau khi đơn hoàn tất (người mua đã xác thực), bình chọn đánh giá hữu ích.
- Đặt lịch tư vấn (`/hen-lich`), xem lịch hẹn của tôi (`/appointments`).
- Liên hệ (`/lien-he`): chat trực tiếp với nhân viên và gửi form liên hệ; Trung tâm hỗ trợ (`/ho-tro`).

**Quản trị (`/admin`)**
- Dashboard doanh thu, đơn hàng, sản phẩm/danh mục bán chạy và phân tích đánh giá, tự làm mới khi đơn hàng thay đổi. Doanh thu chỉ tính đơn **Completed và Paid**.
- Quản lý sản phẩm (ảnh, ẩn/hiện), danh mục nhiều cấp, đơn hàng (xác nhận chuyển khoản, chuyển trạng thái, sửa thông tin giao hàng), khách hàng, đánh giá, dịch vụ/giờ tư vấn, lịch hẹn, chat, hộp thư liên hệ.

## Giới hạn đã biết

- Gói nộp **không chứa thông tin ngân hàng thật**. Mã QR chỉ hiện khi tự cấu hình 4 giá trị `Payment:BankTransfer:*` (`SETUP.md` mục C.3); nếu dùng giá trị giả để xem giao diện thì tài khoản đó chỉ để demo, **không chuyển tiền thật**. Chưa thử quét bằng ứng dụng ngân hàng thật; không có xác minh giao dịch tự động hay hoàn tiền.
- Bản sao lưu cần SQL Server 2025 (17.x) trở lên; không khôi phục được trên bản 2022 hoặc cũ hơn.
- Form liên hệ chỉ lưu vào CSDL, không gửi e-mail.
- Một số ảnh sản phẩm có logo của nguồn ảnh; chỉ dùng cho mục đích demo.
- Khi build frontend có cảnh báo gói JavaScript lớn hơn 500 kB; không ảnh hưởng chức năng.

## Kiểm thử

- Backend build: 0 cảnh báo, 0 lỗi.
- Frontend: lint đạt, 236/236 test đạt (30 tệp), build đạt (chỉ có cảnh báo > 500 kB nói trên).
- Bộ kiểm thử tích hợp `tests/*.integration.mjs`: xem `README.md`. Các bộ này tạo/xóa dữ liệu tạm, chỉ chạy trên bản sao CSDL, **không chạy trên CSDL demo dùng để chấm**.
