// ============================================================
//  THÔNG TIN PHIÊN BẢN & CẬP NHẬT (OTA)
// ============================================================

// Phiên bản hiện đang chạy trên thiết bị
export const PHIEN_BAN_HIEN_TAI = '1.0.0'

// ---- Cấu hình GitHub Releases (nguồn cập nhật OTA) ----
// ⚠️ Đổi owner/repo thành repo GitHub thật của bạn.
export const GITHUB_REPO = {
  owner: 'bachvu47-bmt',
  repo: 'VLN',
}

// Endpoint REST API lấy bản release mới nhất
export const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/releases/latest`

// Dữ liệu "server nội bộ" trả về khi kiểm tra cập nhật (mock).
// Trong thực tế, dữ liệu này đến từ: https://ota.vatlieunha.vn/latest.json
export const BAN_CAP_NHAT_SERVER = {
  phienBan: '1.1.0',
  ngayPhatHanh: '2026-10-18',
  batBuoc: false, // true => chặn dùng app cho tới khi cập nhật
  tieuDe: 'Bổ sung Bot AI quét TikTok / YouTube',
  kichThuocMB: { exe: 82.3, apk: 24.6 },
  changelog: [
    { loai: 'moi', noiDung: 'Bot AI tự quét video kỹ thuật trên TikTok & YouTube, gợi ý gắn vào mã sản phẩm.' },
    { loai: 'moi', noiDung: 'Thêm Thẻ Cảnh báo Đỏ động cho dòng chống thấm PU khi độ ẩm sàn vượt ngưỡng.' },
    { loai: 'caitien', noiDung: 'Đồng bộ đơn hàng KiotViet nhanh hơn ~2× và ổn định hơn.' },
    { loai: 'sualoi', noiDung: 'Sửa lỗi đăng xuất từ xa không hiệu lực trên iPad.' },
  ],
  taiVe: {
    exe: 'https://ota.vatlieunha.vn/builds/VatLieuNha-Sales-Setup-1.1.0.exe',
    apk: 'https://ota.vatlieunha.vn/builds/VatLieuNha-Sales-1.1.0.apk',
  },
}

export const NHAN_CHANGELOG = {
  moi: { nhan: 'MỚI', mau: 'bg-brand-600 text-white' },
  caitien: { nhan: 'CẢI TIẾN', mau: 'bg-blue-600 text-white' },
  sualoi: { nhan: 'SỬA LỖI', mau: 'bg-amber-600 text-white' },
}
