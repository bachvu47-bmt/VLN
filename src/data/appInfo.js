// ============================================================
//  THÔNG TIN PHIÊN BẢN & CẬP NHẬT (OTA)
// ============================================================

// Phiên bản hiện đang chạy trên thiết bị
export const PHIEN_BAN_HIEN_TAI = '1.1.4'

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
  phienBan: '1.1.0',
  ngayPhatHanh: '2026-10-18',
  batBuoc: false, // true => chặn dùng app cho tới khi cập nhật
  tieuDe: 'Giao diện mới + Trợ lý chuyên gia Maika (Claude AI)',
  kichThuocMB: { exe: 108, apk: 3.3 },
  changelog: [
    { loai: 'moi', noiDung: 'Tái thiết kế toàn bộ giao diện theo bộ mẫu mới (Hôm nay, Tra cứu, Khách, Sau bán, Thêm).' },
    { loai: 'moi', noiDung: 'Maika nâng cấp thành trợ lý chuyên gia xây dựng/vật liệu/nội thất, kết nối Claude AI.' },
    { loai: 'caitien', noiDung: 'Auto-update: tự tải bản mới ở nền và cài khi khởi động lại.' },
    { loai: 'sualoi', noiDung: 'Sửa lỗi nút cập nhật trên bản PC không tải được bản mới.' },
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
