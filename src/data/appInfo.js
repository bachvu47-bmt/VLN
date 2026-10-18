// ============================================================
//  THÃ”NG TIN PHIÃŠN Báº¢N & Cáº¬P NHáº¬T (OTA)
// ============================================================

// PhiÃªn báº£n hiá»‡n Ä‘ang cháº¡y trÃªn thiáº¿t bá»‹
export const PHIEN_BAN_HIEN_TAI = '1.1.1'

// ---- Cáº¥u hÃ¬nh GitHub Releases (nguá»“n cáº­p nháº­t OTA) ----
// âš ï¸ Äá»•i owner/repo thÃ nh repo GitHub tháº­t cá»§a báº¡n.
export const GITHUB_REPO = {
  owner: 'bachvu47-bmt',
  repo: 'VLN',
}

// Endpoint REST API láº¥y báº£n release má»›i nháº¥t
export const GITHUB_API_LATEST = `https://api.github.com/repos/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/releases/latest`

// Dá»¯ liá»‡u "server ná»™i bá»™" tráº£ vá» khi kiá»ƒm tra cáº­p nháº­t (mock).
// Trong thá»±c táº¿, dá»¯ liá»‡u nÃ y Ä‘áº¿n tá»«: https://ota.vatlieunha.vn/latest.json
export const BAN_CAP_NHAT_SERVER = {
  phienBan: '1.1.0',
  ngayPhatHanh: '2026-10-18',
  batBuoc: false, // true => cháº·n dÃ¹ng app cho tá»›i khi cáº­p nháº­t
  tieuDe: 'Giao diá»‡n má»›i + Trá»£ lÃ½ chuyÃªn gia Maika (Claude AI)',
  kichThuocMB: { exe: 108, apk: 3.3 },
  changelog: [
    { loai: 'moi', noiDung: 'TÃ¡i thiáº¿t káº¿ toÃ n bá»™ giao diá»‡n theo bá»™ máº«u má»›i (HÃ´m nay, Tra cá»©u, KhÃ¡ch, Sau bÃ¡n, ThÃªm).' },
    { loai: 'moi', noiDung: 'Maika nÃ¢ng cáº¥p thÃ nh trá»£ lÃ½ chuyÃªn gia xÃ¢y dá»±ng/váº­t liá»‡u/ná»™i tháº¥t, káº¿t ná»‘i Claude AI.' },
    { loai: 'caitien', noiDung: 'Auto-update: tá»± táº£i báº£n má»›i á»Ÿ ná»n vÃ  cÃ i khi khá»Ÿi Ä‘á»™ng láº¡i.' },
    { loai: 'sualoi', noiDung: 'Sá»­a lá»—i nÃºt cáº­p nháº­t trÃªn báº£n PC khÃ´ng táº£i Ä‘Æ°á»£c báº£n má»›i.' },
  ],
  taiVe: {
    exe: 'https://ota.vatlieunha.vn/builds/VatLieuNha-Sales-Setup-1.1.0.exe',
    apk: 'https://ota.vatlieunha.vn/builds/VatLieuNha-Sales-1.1.0.apk',
  },
}

export const NHAN_CHANGELOG = {
  moi: { nhan: 'Má»šI', mau: 'bg-brand-600 text-white' },
  caitien: { nhan: 'Cáº¢I TIáº¾N', mau: 'bg-blue-600 text-white' },
  sualoi: { nhan: 'Sá»¬A Lá»–I', mau: 'bg-amber-600 text-white' },
}

