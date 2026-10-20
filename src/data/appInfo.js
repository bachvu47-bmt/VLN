// ============================================================
//  THÔNG TIN PHIÊN BẢN & CẬP NHẬT (OTA)
// ============================================================

// Phiên bản hiện đang chạy trên thiết bị
export const PHIEN_BAN_HIEN_TAI = '1.1.18'

// ---- Cấu hình GitHub Releases (nguồn cập nhật OTA) ----
// ⚠️ Đổi owner/repo thành repo GitHub thật của bạn.
export const GITHUB_REPO = {
  owner: 'bachvu47-bmt',
  repo: 'VLN',
}

// Endpoint REST API lấy bản release mới nhất
export const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/releases/latest`

// Dữ liệu "server nội bộ" trả về khi kiểm tra cập nhật (mock).
// Trong thực tế, dữ liệu này đến từ GitHub Releases API ở trên.
export const BAN_CAP_NHAT_SERVER = {
  phienBan: '1.1.18',
  ngayPhatHanh: '2026-10-20',
  batBuoc: false, // true => chặn dùng app cho tới khi cập nhật
  tieuDe: 'Maika tự học: đọc TDS, tự nghiên cứu, tự chấm bài & rút bài học',
  kichThuocMB: { exe: 108, apk: 3.6 },
  changelog: [
    { loai: 'moi', noiDung: 'Maika trả lời như chuyên gia kỹ thuật: xác nhận đúng ý hỏi, tóm gọn tối đa 6 ý, kèm 1 link đúng bài trên vatlieunha.vn — link bấm được ngay trong khung chat.' },
    { loai: 'moi', noiDung: 'Đọc sâu tài liệu kỹ thuật (TDS, hướng dẫn thi công PDF) của nhà sản xuất: định mức, tỷ lệ pha, thời gian chờ lấy từ tài liệu chính hãng.' },
    { loai: 'moi', noiDung: 'Tự nghiên cứu: câu nào Maika "chưa có dữ liệu", đêm đó Maika tự tìm trên vatlieunha.vn, trang + TDS nhà sản xuất rồi học bổ sung.' },
    { loai: 'moi', noiDung: 'Tự chấm bài mỗi đêm: phát hiện số liệu không có căn cứ, câu trả lời bị chê hoặc lạc đề → tự soạn đính chính có trích dẫn nguồn.' },
    { loai: 'moi', noiDung: 'Tự rút bài học từ các lỗi đã sửa và áp dụng cho mọi câu trả lời sau, không lặp lại lỗi cùng kiểu.' },
    { loai: 'caitien', noiDung: 'Tự soát trước khi gửi: câu trả lời có con số không có trong tri thức → Maika tự viết lại ngay.' },
    { loai: 'caitien', noiDung: 'Thẻ tri thức chính hãng đã kiểm chứng được học ngay, không cần Admin duyệt; thẻ chưa chắc chắn vẫn vào "Duyệt kiến thức".' },
    { loai: 'moi', noiDung: 'Maika dùng chung một bộ não với Maika trên vatlieunha.vn: tri thức, đính chính của Admin và vector nằm trên máy chủ, mọi máy cùng dùng.' },
    { loai: 'moi', noiDung: 'Bán gì học nấy: mỗi sản phẩm đang bán có hồ sơ riêng — công dụng, thi công ở đâu, định mức, chống chỉ định, điểm mạnh, giải pháp đi kèm.' },
    { loai: 'caitien', noiDung: 'Cào trang Sika, Jotun, Maxbond chỉ học sản phẩm cửa hàng đang bán, thẻ tri thức theo đúng khung hồ sơ.' },
    { loai: 'caitien', noiDung: 'Hỏi về một sản phẩm → Maika trả lời theo hồ sơ; mục nào chưa có dữ liệu thì không tự điền.' },
    { loai: 'sualoi', noiDung: 'Báo cáo: lấy đúng hình thức thanh toán hoá đơn KiotViet (Tiền mặt / Chuyển khoản).' },
    { loai: 'sualoi', noiDung: 'Sửa lỗi bản cập nhật báo "chưa có link để tải": chỉ báo có bản mới khi file cài cho đúng máy đã sẵn sàng, và kiểm tra lại ngay lúc bấm tải.' },
    { loai: 'moi', noiDung: 'Mỗi ngày 2 lần (5:30, 12:30) Maika đọc trang sản phẩm Sika, Jotun, Maxbond mới/vừa cập nhật và tóm tắt thành thẻ tri thức.' },
    { loai: 'moi', noiDung: 'Duyệt kiến thức: lọc theo nguồn, mở link trang gốc, duyệt nhanh các thẻ có độ tin cậy cao — duyệt xong Maika học ngay.' },
    { loai: 'moi', noiDung: 'Tra cứu: hiện tồn kho & giá bán KiotViet khi tìm sản phẩm; hỏi Maika "còn hàng không, giá bao nhiêu" → trả số liệu thật.' },
    { loai: 'moi', noiDung: 'Sau bán: hoá đơn KiotViet thật — hẹn hỏi thăm khách, Maika soạn tin chăm sóc theo đúng món khách đã mua.' },
    { loai: 'moi', noiDung: 'Khách hàng: 1.976 khách KiotViet, tìm theo tên/SĐT, xem lịch sử mua & công nợ.' },
    { loai: 'caitien', noiDung: 'Bảo mật: app không giữ key KiotViet; dữ liệu mã hoá, mở bằng "Mã dữ liệu cửa hàng" do Admin cấp.' },
    { loai: 'moi', noiDung: 'Báo cáo bán hàng (Admin): doanh thu, tỷ lệ chốt, kênh, tình trạng khách, sản phẩm hỏi nhiều — đọc trực tiếp Google Sheet báo cáo ngày, có biểu đồ.' },
    { loai: 'moi', noiDung: 'Hỏi Maika bằng câu tự nhiên: "Doanh thu tháng 9 theo tuần?", "Kênh nào nhiều khách nhất?" — trả số liệu chính xác kèm biểu đồ.' },
    { loai: 'moi', noiDung: 'Tự tìm báo giá 3–30 ngày chưa liên hệ lại → tạo nhắc follow-up hàng loạt vào màn Hôm nay.' },
    { loai: 'moi', noiDung: 'Màn Hôm nay: "Maika nhắc hôm nay" tóm tắt việc quá hạn, việc trong ngày, báo giá cần follow-up.' },
    { loai: 'moi', noiDung: 'Gõ hoặc nói "Nhắc tôi gọi chị Mai 10h sáng mai" — Maika tự lên lịch và báo đúng giờ (Android báo cả khi đã tắt app).' },
    { loai: 'moi', noiDung: '"Vừa gửi báo giá" → tự tạo lịch follow-up; Sau bán → hẹn hỏi thăm khách sau 3 ngày; Maika soạn sẵn tin nhắn Zalo gửi khách.' },
    { loai: 'caitien', noiDung: 'Câu hỏi chữ dùng Groq (nhiều lượt miễn phí), dành Gemini cho phân tích ảnh hiện trường.' },
    { loai: 'moi', noiDung: 'Gửi ảnh cho Maika (chụp hoặc chọn từ thư viện) — phân tích vết nứt, thấm, bong tróc và đề xuất giải pháp thi công.' },
    { loai: 'moi', noiDung: 'Giữ nút micro để nói (như Zalo) — Maika chuyển giọng nói thành chữ rồi trả lời.' },
    { loai: 'moi', noiDung: 'AI Admin: tab "Phê duyệt Multimodal" duyệt thẻ tri thức kèm ảnh/ghi âm trước khi nạp cho Maika.' },
    { loai: 'sualoi', noiDung: 'Maika không còn kèm danh sách nguồn không liên quan; không có dữ liệu thì nói "Maika chưa có dữ liệu về vấn đề này". Link tài liệu chỉ hiện khi bạn yêu cầu.' },
    { loai: 'moi', noiDung: 'Maika tự chuyển sang Groq (miễn phí, ~1.000 câu/ngày) khi Gemini hết 20 lượt/ngày/model hoặc gặp sự cố.' },
    { loai: 'caitien', noiDung: 'Không chờ quá 30 giây khi máy chủ Google bị treo — tự đổi sang model khác.' },
    { loai: 'sualoi', noiDung: 'Maika tự chuyển sang model Gemini dự phòng khi model chính quá tải (503), hết lượt free trong ngày (429), bị gỡ (404) hoặc mạng chập chờn.' },
    { loai: 'moi', noiDung: 'Maika tự học: Admin sửa sai ngay trong khung chat, Maika áp dụng tức thì; nhân viên báo sai → Admin duyệt.' },
    { loai: 'moi', noiDung: 'Cổng AI Admin: Gemini phân tích PDF/ảnh/ghi chú thành tri thức, duyệt rồi nạp vào bộ nhớ Maika.' },
    { loai: 'caitien', noiDung: 'Đồng bộ vatlieunha.vn lấy thêm quy cách, thương hiệu, định mức, tài liệu PDF; Maika học toàn bộ mô tả kỹ thuật.' },
    { loai: 'sualoi', noiDung: 'Sửa lỗi Maika không trả lời do Google gỡ model gemini-2.0-flash (chuyển sang gemini-flash-latest).' },
  ],
  taiVe: {
    exe: 'https://github.com/bachvu47-bmt/VLN/releases/latest',
    apk: 'https://github.com/bachvu47-bmt/VLN/releases/latest',
  },
}

export const NHAN_CHANGELOG = {
  moi: { nhan: 'MỚI', mau: 'bg-brand-600 text-white' },
  caitien: { nhan: 'CẢI TIẾN', mau: 'bg-blue-600 text-white' },
  sualoi: { nhan: 'SỬA LỖI', mau: 'bg-amber-600 text-white' },
}
