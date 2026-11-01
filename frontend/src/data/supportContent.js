// Baseline: develop 2cae92f. Update with backend changes; see docs/support-center.md.
export const supportCategories = [
  ['ordering', 'Đặt hàng'], ['payment', 'Thanh toán'], ['delivery', 'Giao hàng'],
  ['cancellation', 'Hủy đơn'], ['account', 'Tài khoản'], ['wishlist', 'Yêu thích'],
  ['reviews', 'Đánh giá sản phẩm'], ['products', 'Sản phẩm & kiểm định'],
].map(([id, title]) => ({ id, title }));
export const supportLinks = [
  { to: '/shop', label: 'Xem sản phẩm' }, { to: '/cart', label: 'Giỏ hàng' },
  { to: '/orders', label: 'Đơn hàng của tôi' }, { to: '/account', label: 'Tài khoản' },
  { to: '/lien-he', label: 'Liên hệ' },
];
export const orderGuide = [
  { id: 'pending', title: 'Chờ xác nhận', icon: 'clock', text: 'Đơn đã được tạo, đang chờ cửa hàng xác nhận.' },
  { id: 'confirmed', title: 'Đã xác nhận', icon: 'check', text: 'Cửa hàng đã xác nhận đơn, chưa chuyển sang giao hàng.' },
  { id: 'shipping', title: 'Đang giao', icon: 'truck', text: 'Cửa hàng đã cập nhật đơn sang trạng thái giao hàng.' },
  { id: 'completed', title: 'Hoàn tất', icon: 'check', text: 'Cửa hàng đã đánh dấu hoàn tất đơn. Xem riêng thông tin thanh toán trong chi tiết đơn.' },
];
export const supportFaq = [
  { id: 'place-order', category: 'ordering', title: 'Làm thế nào để đặt hàng?', keywords: 'mua giỏ checkout người nhận địa chỉ',
    content: 'Đăng nhập, thêm sản phẩm vào giỏ và kiểm tra số lượng, tổng tiền. Chọn phương thức thanh toán rồi nhấn Đặt hàng. Trong hộp Thông tin giao hàng, kiểm tra người nhận, điện thoại và địa chỉ; ghi chú là tùy chọn. Chỉ khi nhấn Xác nhận đặt hàng, hệ thống mới tạo đơn. Thông tin giao hàng lưu cho đơn này, không tự ghi đè hồ sơ tài khoản.', link: { to: '/cart', label: 'Mở giỏ hàng' } },
  { id: 'cart-quantity', category: 'ordering', title: 'Thay đổi số lượng trong giỏ như thế nào?', keywords: 'cộng trừ tồn kho giá tổng tiền',
    content: 'Dùng nút + hoặc −; nếu nhập tay, nhấn Enter hoặc rời ô nhập để lưu. Số lượng tối thiểu là 1. Tổng tiền cập nhật từ hệ thống sau khi lưu thành công. Nếu không đủ tồn kho hoặc cập nhật lỗi, kiểm tra thông báo trong giỏ trước khi đặt hàng.' },
  { id: 'find-orders', category: 'ordering', title: 'Tôi xem đơn hàng ở đâu?', keywords: 'lịch sử theo dõi chi tiết',
    content: 'Mở Đơn hàng của tôi rồi chọn một đơn để xem sản phẩm, người nhận và trạng thái. Bạn cần đăng nhập tài khoản đã đặt đơn.', link: { to: '/orders', label: 'Xem đơn hàng của tôi' } },
  { id: 'confirmation', category: 'ordering', title: 'Khi nào đơn được xác nhận?', keywords: 'pending confirmed chờ xử lý',
    content: 'Đơn mới ở trạng thái Chờ xác nhận. Cửa hàng chuyển trạng thái khi xử lý đơn; hệ thống chưa quy định thời gian xác nhận cố định. Nếu cần kiểm tra thêm, liên hệ cửa hàng và cung cấp mã đơn.', link: { to: '/lien-he', label: 'Liên hệ cửa hàng' } },
  { id: 'payment-methods', category: 'payment', title: 'Gem Aurelia hỗ trợ phương thức thanh toán nào?', keywords: 'COD ngân hàng chuyển khoản',
    content: 'Bạn có thể chọn Thanh toán khi nhận hàng (COD) hoặc Chuyển khoản ngân hàng trong giỏ. Đơn COD mở trang chi tiết đơn; đơn chuyển khoản mở trang thanh toán sau khi tạo đơn thành công.' },
  { id: 'cod', category: 'payment', title: 'Thanh toán COD hoạt động như thế nào?', keywords: 'trả tiền nhận hàng unpaid paid',
    content: 'COD là lựa chọn thanh toán khi nhận hàng. Đơn mới là Chờ xác nhận và Chưa thanh toán. Trạng thái đơn và trạng thái thanh toán được lưu riêng: chuyển đơn sang Hoàn tất chưa tự đánh dấu Đã thanh toán. Nếu cần đối chiếu thông tin thanh toán, liên hệ cửa hàng với mã đơn.' },
  { id: 'bank-transfer', category: 'payment', title: 'Chuyển khoản ngân hàng hoặc QR hoạt động như thế nào?', keywords: 'số tài khoản chủ tài khoản nội dung ngân hàng mã QR',
    content: 'Sau khi tạo đơn chuyển khoản, trang thanh toán hiển thị số tiền, nội dung chuyển khoản và thông tin ngân hàng nếu đã được cấu hình. Chỉ dùng thông tin trên đơn của bạn. Nếu chưa có thông tin ngân hàng, chưa chuyển tiền và liên hệ cửa hàng. Phiên bản hiện tại chưa hiển thị mã QR thanh toán. Không chuyển khoản cho đơn đã hủy.' },
  { id: 'transfer-status', category: 'payment', title: 'Vì sao đã chuyển khoản nhưng đơn vẫn ghi Chưa thanh toán?', keywords: 'chờ xác nhận thanh toán tôi đã chuyển khoản đối soát',
    content: 'Nút Tôi đã chuyển khoản hiện chỉ hiển thị thông báo trên trang; chưa gửi báo cáo chuyển khoản đến máy chủ và không đánh dấu đơn đã thanh toán. Phiên bản này chưa có màn hình xác nhận tiền đã nhận. Liên hệ cửa hàng để đối soát; không chuyển thêm tiền chỉ vì trạng thái chưa đổi.', link: { to: '/lien-he', label: 'Liên hệ với chúng tôi' } },
  { id: 'delivery-status', category: 'delivery', title: 'Các trạng thái đơn hàng có ý nghĩa gì?', keywords: 'pending confirmed shipping completed cancelled giao hàng',
    content: 'Luồng xử lý là Chờ xác nhận → Đã xác nhận → Đang giao → Hoàn tất. Đã hủy là trạng thái riêng, không phải một bước giao hàng. Đây là trạng thái do cửa hàng cập nhật; hệ thống không cung cấp vị trí giao hàng trực tiếp.', link: { to: '/orders', label: 'Kiểm tra trạng thái đơn' } },
  { id: 'delivery-policy', category: 'delivery', title: 'Tôi hỏi thời gian giao, phí giao hàng hoặc đổi trả ở đâu?', keywords: 'vận chuyển phí hoàn tiền bảo hành đổi trả',
    content: 'Hệ thống hiện chưa công bố chính sách cố định về thời gian giao, phí giao hàng, đổi trả hay hoàn tiền. Liên hệ cửa hàng để được hướng dẫn theo đơn cụ thể.', link: { to: '/lien-he', label: 'Hỏi cửa hàng' } },
  { id: 'cancel-order', category: 'cancellation', title: 'Khi nào tôi có thể hủy đơn?', keywords: 'pending hủy đơn chờ xác nhận',
    content: 'Bạn chỉ có thể tự hủy đơn của mình khi đơn còn Chờ xác nhận. Chọn Hủy đơn trong lịch sử hoặc chi tiết đơn và xác nhận trong hộp thoại. Nếu trạng thái đã thay đổi, hệ thống có thể từ chối hủy; tải lại đơn để kiểm tra. Đơn Đã xác nhận cần cửa hàng xem xét; cửa hàng chỉ có thể hủy khi đơn Chờ xác nhận hoặc Đã xác nhận. Hủy đơn không đồng nghĩa hệ thống đã xử lý hoàn tiền.', link: { to: '/orders', label: 'Mở lịch sử đơn hàng' } },
  { id: 'sign-in', category: 'account', title: 'Tôi đăng ký và đăng nhập như thế nào?', keywords: 'email mật khẩu tài khoản đăng ký đăng nhập',
    content: 'Chọn Đăng ký để nhập họ tên, email và mật khẩu theo hướng dẫn trên biểu mẫu. Sau đó đăng nhập bằng email và mật khẩu. Các trang tài khoản, giỏ hàng và đơn hàng sẽ yêu cầu đăng nhập nếu phiên của bạn đã hết hạn.', link: { to: '/register', label: 'Đăng ký tài khoản' } },
  { id: 'profile', category: 'account', title: 'Tôi cập nhật thông tin cá nhân ở đâu?', keywords: 'họ tên số điện thoại địa chỉ hồ sơ email quyền',
    content: 'Mở Tài khoản để sửa họ tên, số điện thoại và địa chỉ, rồi nhấn Cập nhật. Email và vai trò chỉ đọc. Kiểm tra thông báo lưu thành công trước khi rời trang.', link: { to: '/account', label: 'Mở tài khoản' } },
  { id: 'password', category: 'account', title: 'Tôi đổi mật khẩu như thế nào?', keywords: 'mật khẩu cũ mới bảo mật',
    content: 'Khi đã đăng nhập, chọn Đổi mật khẩu từ trang Tài khoản. Nhập mật khẩu hiện tại, mật khẩu mới và xác nhận mật khẩu mới theo hướng dẫn. Nếu không thể đăng nhập, liên hệ cửa hàng để được hướng dẫn; không gửi mật khẩu qua chat.', link: { to: '/change-password', label: 'Đổi mật khẩu' } },
  { id: 'favorites', category: 'wishlist', title: 'Làm thế nào để thêm hoặc bỏ yêu thích?', keywords: 'tim wishlist lưu sản phẩm',
    content: 'Đăng nhập rồi nhấn biểu tượng trái tim trên sản phẩm. Tim được tô khi đã lưu; nhấn lại để bỏ yêu thích. Danh sách thuộc tài khoản của bạn. Sản phẩm không còn hiển thị công khai sẽ không xuất hiện trong danh sách yêu thích thông thường.', link: { to: '/wishlist', label: 'Xem yêu thích' } },
  { id: 'review-eligibility', category: 'reviews', title: 'Khi nào tôi được đánh giá sản phẩm?', keywords: 'đã mua verified purchase sao hoàn tất',
    content: 'Tài khoản khách hàng phải có đơn chứa sản phẩm ở trạng thái Hoàn tất mới được đánh giá. Mỗi tài khoản có một đánh giá cho mỗi sản phẩm. Nhãn Đã mua hàng cho biết hệ thống đã kiểm tra điều kiện mua hàng; không phải chứng nhận chất lượng viên đá.', link: { to: '/orders', label: 'Xem các đơn đã mua' } },
  { id: 'edit-review', category: 'reviews', title: 'Tôi có thể sửa đánh giá đã gửi không?', keywords: 'sửa sao nội dung đánh giá ẩn kiểm duyệt',
    content: 'Đăng nhập tài khoản đã đánh giá, mở phần đánh giá sản phẩm hoặc đường dẫn đánh giá từ đơn hàng để sửa đánh giá hiện có. Điều kiện mua hàng vẫn được kiểm tra. Cửa hàng có thể ẩn nội dung khỏi phần công khai; đánh giá bị ẩn không được tính vào điểm sao công khai.' },
  { id: 'gem-information', category: 'products', title: 'Tôi đọc thông tin đá quý như thế nào?', keywords: 'carat ct ruby sapphire emerald nguồn gốc màu độ tinh khiết kiểu cắt',
    content: 'Trang chi tiết hiển thị loại đá/danh mục, carat, màu, độ tinh khiết, kiểu cắt và nguồn gốc nếu có dữ liệu. Carat (ct) là đơn vị khối lượng đá quý. Chưa có thông tin nghĩa là dữ liệu chưa được cung cấp, không phải cam kết về chất lượng.', link: { to: '/shop', label: 'Khám phá đá quý' } },
  { id: 'certificate', category: 'products', title: 'Tôi xem thông tin kiểm định ở đâu?', keywords: 'certificate authority giấy chứng nhận kiểm định',
    content: 'Xem mục Chứng nhận trong chi tiết sản phẩm. Khi có dữ liệu, trang hiển thị cơ quan kiểm định và thông tin chứng nhận; liên kết giấy chứng nhận chỉ xuất hiện nếu có tài liệu. Không phải mọi sản phẩm đều có chứng nhận. Liên hệ cửa hàng để làm rõ thông tin trước khi mua.', link: { to: '/lien-he', label: 'Hỏi về sản phẩm' } },
];
export function normalizeHelpSearch(value) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/\s+/g, ' ').trim();
}
export function filterSupportFaq(query, category = '') {
  const tokens = normalizeHelpSearch(query).split(' ').filter(Boolean);
  return supportFaq.filter(item => (!category || item.category === category) && tokens.every(token =>
    normalizeHelpSearch(`${item.title} ${item.content} ${item.keywords}`).includes(token)));
}
