// ============================================================
//  THÔNG TIN PHIÊN BẢN & CẬP NHẬT (OTA)
// ============================================================

// Phiên bản hiện đang chạy trên thiết bị
export const PHIEN_BAN_HIEN_TAI = '1.1.8'

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
  phienBan: '1.1.8',
  ngayPhatHanh: '2026-10-19',
  batBuoc: false, // true => chặn dùng app cho tới khi cập nhật
  tieuDe: 'Maika tự học (bộ nhớ vector) + Gemini mới + tài liệu từ website',
  kichThuocMB: { exe: 108, apk: 3.3 },
  changelog: [
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
