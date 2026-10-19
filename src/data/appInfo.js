// ============================================================
//  THÔNG TIN PHIÊN BẢN & CẬP NHẬT (OTA)
// ============================================================

// Phiên bản hiện đang chạy trên thiết bị
export const PHIEN_BAN_HIEN_TAI = '1.1.12'

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
  phienBan: '1.1.12',
  ngayPhatHanh: '2026-10-19',
  batBuoc: false, // true => chặn dùng app cho tới khi cập nhật
  tieuDe: 'Trợ lý chủ động: Maika tự nhắc follow-up báo giá & lịch hẹn',
  kichThuocMB: { exe: 108, apk: 3.6 },
  changelog: [
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
