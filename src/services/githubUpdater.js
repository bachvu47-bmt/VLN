// ============================================================
//  GITHUB UPDATER — đấu nối GitHub Releases API cho Auto-Update
//  Nguồn: https://api.github.com/repos/{owner}/{repo}/releases/latest
//  Dùng chung cho PC (.exe) & Mobile (.apk).
// ============================================================
import {
  BAN_CAP_NHAT_SERVER,
  GITHUB_API_LATEST,
  GITHUB_REPO,
  PHIEN_BAN_HIEN_TAI,
} from '../data/appInfo'
import { nhanDienNenTang } from './updateService'

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- So sánh semver: "v1.2.3" > "1.2.0" ? ----
function tachSemver(v) {
  return String(v)
    .replace(/^v/i, '') // bỏ tiền tố 'v'
    .split('-')[0] // bỏ hậu tố -beta, -rc...
    .split('.')
    .map((n) => parseInt(n, 10) || 0)
}

export function phienBanMoiHon(a, b) {
  const pa = tachSemver(a)
  const pb = tachSemver(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0
    const y = pb[i] || 0
    if (x > y) return true
    if (x < y) return false
  }
  return false
}

// ---- Bóc tách Changelog từ `body` của Release ----
function parseChangelog(body) {
  if (!body) return [{ loai: 'moi', noiDung: 'Xem chi tiết trên trang GitHub Release.' }]
  return body
    .split(/\r?\n/)
    .map((d) => d.trim())
    .filter((d) => /^[-*•]/.test(d)) // chỉ lấy dòng gạch đầu dòng
    .map((d) => {
      const noiDung = d.replace(/^[-*•]\s*/, '')
      const low = noiDung.toLowerCase()
      let loai = 'moi'
      if (/(fix|sửa|lỗi|bug)/.test(low)) loai = 'sualoi'
      else if (/(cải tiến|cải thiện|tối ưu|improve|perf)/.test(low)) loai = 'caitien'
      return { loai, noiDung }
    })
    .slice(0, 12)
}

// ---- Tìm asset (.apk / .exe) trong danh sách assets ----
function timAsset(assets, duoi) {
  return (assets || []).find((a) => a.name?.toLowerCase().endsWith(duoi))
}

// ---- Chuẩn hoá dữ liệu Release → model dùng trong UI ----
function chuanHoaRelease(data) {
  const apk = timAsset(data.assets, '.apk')
  const exe = timAsset(data.assets, '.exe')
  return {
    phienBan: String(data.tag_name || '').replace(/^v/i, ''),
    tag: data.tag_name,
    tieuDe: data.name || `Bản phát hành ${data.tag_name}`,
    ngayPhatHanh: (data.published_at || '').slice(0, 10),
    batBuoc: /\[bắt buộc\]|\[required\]/i.test(data.body || ''),
    changelog: parseChangelog(data.body),
    kichThuocMB: {
      apk: apk ? Math.round((apk.size / 1024 / 1024) * 10) / 10 : BAN_CAP_NHAT_SERVER.kichThuocMB.apk,
      exe: exe ? Math.round((exe.size / 1024 / 1024) * 10) / 10 : BAN_CAP_NHAT_SERVER.kichThuocMB.exe,
    },
    taiVe: {
      apk: apk?.browser_download_url || null,
      exe: exe?.browser_download_url || null,
    },
    trangRelease: data.html_url,
  }
}

// ============================================================
//  1) KIỂM TRA BẢN MỚI TRÊN GITHUB
// ============================================================
// Bản mới chỉ "dùng được" khi Release đã có ĐÚNG file của nền tảng đang chạy
// (Android cần .apk; PC cần .exe). Release đang đính file dở dang → coi như chưa có,
// tránh báo cập nhật rồi bấm tải lại lỗi "Không có link .apk".
function coFileChoNenTang(moi) {
  const nt = nhanDienNenTang()
  if (nt === 'mobile') return !!moi.taiVe.apk
  if (nt === 'pc') return !!moi.taiVe.exe
  return true // web: chỉ mở trang Release
}

export async function kiemTraGitHub() {
  try {
    const res = await fetch(GITHUB_API_LATEST, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store', // luôn lấy trạng thái Release mới nhất, không dùng bản cache
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const data = await res.json()
    const moi = chuanHoaRelease(data)
    const moiHon = phienBanMoiHon(moi.phienBan, PHIEN_BAN_HIEN_TAI)
    const sanSang = coFileChoNenTang(moi)
    return {
      nguon: 'github',
      coCapNhat: moiHon && sanSang,
      dangChuanBi: moiHon && !sanSang, // có bản mới nhưng file cho máy này chưa đăng xong
      hienTai: PHIEN_BAN_HIEN_TAI,
      moi,
    }
  } catch (e) {
    // Repo chưa tồn tại / offline / chưa có release → fallback dữ liệu mock
    // Dữ liệu dự phòng KHÔNG có link file thật → không bao giờ báo "có cập nhật" từ đây
    // (trước đây có thể hiện nút Tải rồi lỗi vì link chỉ là trang web, không phải .apk/.exe)
    console.warn('[githubUpdater] Không gọi được GitHub:', e.message)
    await delay(500)
    const fb = BAN_CAP_NHAT_SERVER
    return {
      nguon: 'mock',
      coCapNhat: false,
      loi: e.message,
      hienTai: PHIEN_BAN_HIEN_TAI,
      moi: {
        ...fb,
        taiVe: {
          apk: fb.taiVe.apk,
          exe: fb.taiVe.exe,
        },
        trangRelease: `https://github.com/${GITHUB_REPO.owner}/${GITHUB_REPO.repo}/releases/latest`,
      },
    }
  }
}

// ============================================================
//  2) TẢI ASSET (.apk / .exe) TỪ GITHUB RELEASE
//     Báo tiến độ qua onProgress(0..100).
// ============================================================
export async function taiAssetGitHub(moi, onProgress) {
  const nt = nhanDienNenTang()
  const url = nt === 'mobile' ? moi?.taiVe?.apk : moi?.taiVe?.exe

  // PC có electron-updater → ưu tiên luồng gốc (tải nền + xác thực chữ ký)
  if (nt === 'pc' && window.desktop?.updater) {
    return window.desktop.updater.download(onProgress)
  }

  // Thử tải trực tiếp kèm tiến độ thật (nếu CORS cho phép)
  if (url) {
    try {
      const res = await fetch(url)
      const tong = Number(res.headers.get('content-length')) || 0
      const reader = res.body?.getReader?.()
      if (reader && tong > 0) {
        let daTai = 0
        const chunks = []
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          daTai += value.length
          onProgress?.(Math.round((daTai / tong) * 100))
        }
        return { ok: true, blob: new Blob(chunks), url }
      }
    } catch (e) {
      console.warn('[githubUpdater] Tải trực tiếp thất bại, mô phỏng tiến độ:', e.message)
    }
  }

  // Fallback: mô phỏng tiến độ (web/dev hoặc bị chặn CORS)
  for (let p = 0; p <= 100; p += 5) {
    onProgress?.(p)
    await delay(90)
  }
  return { ok: true, url }
}

// ============================================================
//  3) CÀI ĐẶT BẢN MỚI
// ============================================================
export async function caiDatBanMoi(moi) {
  const nt = nhanDienNenTang()

  if (nt === 'pc') {
    if (window.desktop?.updater) return window.desktop.updater.install()
    // Không có electron-updater: mở link .exe để người dùng cài tay
    if (moi?.taiVe?.exe) window.open(moi.taiVe.exe, '_blank')
    return { ok: true }
  }

  if (nt === 'mobile') {
    // Android: mở file .apk đã tải để kích hoạt trình cài đặt đè.
    // Bản thật dùng plugin mở Intent ACTION_VIEW tới file .apk trong bộ nhớ.
    if (moi?.taiVe?.apk) window.open(moi.taiVe.apk, '_blank')
    alert('Đang mở trình cài đặt .apk để cập nhật đè phiên bản mới...')
    return { ok: true }
  }

  if (moi?.trangRelease) window.open(moi.trangRelease, '_blank')
  return { ok: true }
}
