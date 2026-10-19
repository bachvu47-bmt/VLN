import { useState } from 'react'
import { NHAN_CHANGELOG, PHIEN_BAN_HIEN_TAI } from '../data/appInfo'
import { nhanDienNenTang } from '../services/updateService'
import { caiDatBanMoi, kiemTraGitHub, taiAssetGitHub } from '../services/githubUpdater'
import { laNativeAndroid, taiVaCaiApk } from '../services/autoUpdateService'
import { useToast } from '../context/ToastContext'

const NHAN_NEN_TANG = {
  pc: { icon: '🖥️', ten: 'PC (.exe)', kieu: 'exe' },
  mobile: { icon: '📱', ten: 'Mobile (.apk)', kieu: 'apk' },
  web: { icon: '🌐', ten: 'Web', kieu: 'exe' },
}

// Props:
//  - onClose: đóng modal
//  - capNhatSan: (tùy chọn) dữ liệu bản mới đã kiểm tra sẵn khi khởi động app
export default function AutoUpdateModal({ onClose, capNhatSan = null }) {
  const nt = nhanDienNenTang()
  const nenTang = NHAN_NEN_TANG[nt]
  const [tt, setTt] = useState(capNhatSan ? 'available' : 'idle')
  const [moi, setMoi] = useState(capNhatSan?.moi || null)
  const [nguon, setNguon] = useState(capNhatSan?.nguon || null)
  const [tienDo, setTienDo] = useState(0)
  const [daTai, setDaTai] = useState(0)
  const [tong, setTong] = useState(0)
  const toast = useToast()
  const apkNative = laNativeAndroid()

  const [loiKiemTra, setLoiKiemTra] = useState('')

  // Áp kết quả kiểm tra GitHub → trạng thái modal; trả về bản mới nếu tải được ngay
  const apKetQua = (kq) => {
    setNguon(kq.nguon)
    if (kq.coCapNhat && kq.moi) {
      setMoi(kq.moi)
      setTt('available')
      return kq.moi
    }
    if (kq.dangChuanBi) {
      setMoi(kq.moi)
      setTt('preparing')
    } else if (kq.loi) {
      setLoiKiemTra(kq.loi)
      setTt('loi')
    } else setTt('uptodate')
    return null
  }

  const kiemTra = async () => {
    setTt('checking')
    apKetQua(await kiemTraGitHub())
  }

  const taiVe = async () => {
    setTt('downloading')
    setTienDo(0)
    await taiAssetGitHub(moi, (p) => setTienDo(p))
    setTt('ready')
  }

  const caiDat = async () => {
    setTt('installing')
    await caiDatBanMoi(moi)
  }

  // MOBILE (.apk): tải nền trong app → tự mở trình cài đặt Android (không ra web)
  const taiVaCaiMobile = async () => {
    // Luôn hỏi lại GitHub ngay lúc bấm — không dùng kết quả cũ (có thể đã 30 phút trước)
    setTt('checking')
    const banMoi = apKetQua(await kiemTraGitHub())
    if (!banMoi?.taiVe?.apk) return // đang chuẩn bị / đã mới nhất / lỗi mạng → modal đã báo rõ
    setTt('downloading')
    setTienDo(0)
    setDaTai(0)
    setTong(0)
    try {
      await taiVaCaiApk(banMoi.taiVe.apk, (bytes, total) => {
        setDaTai(bytes)
        if (total) setTong(total)
        setTienDo(total > 0 ? Math.round((bytes / total) * 100) : 0)
      })
      setTt('installing')
      toast('Đang chuẩn bị cài đặt bản cập nhật mới...', 'info')
      setTimeout(onClose, 900)
    } catch (e) {
      toast('Lỗi tải cập nhật: ' + (e.message || e), 'error')
      setTt('available')
    }
  }

  const kichThuoc = moi ? moi.kichThuocMB[nenTang.kieu] ?? moi.kichThuocMB.exe : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-black text-gray-900">Cập nhật phần mềm</h3>
            <p className="text-xs text-gray-500">
              {nenTang.icon} Bản {nenTang.ten} · Nguồn: GitHub Releases
            </p>
          </div>
          <button onClick={onClose} className="rounded-full bg-gray-100 px-3 py-1 text-sm font-bold text-gray-500">✕</button>
        </div>

        {/* Phiên bản hiện tại */}
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-400">Phiên bản hiện tại</div>
            <div className="text-xl font-black text-gray-900">v{PHIEN_BAN_HIEN_TAI}</div>
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-xl text-white">
            {nenTang.icon}
          </span>
        </div>

        {/* idle */}
        {tt === 'idle' && (
          <button
            onClick={kiemTra}
            className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
          >
            🔄 Kiểm tra cập nhật trên GitHub
          </button>
        )}

        {/* checking */}
        {tt === 'checking' && (
          <div className="rounded-xl bg-gray-50 py-6 text-center text-sm font-semibold text-gray-500">
            <span className="animate-pulse">⏳ Đang gọi GitHub Releases API...</span>
          </div>
        )}

        {/* uptodate */}
        {tt === 'uptodate' && (
          <div className="rounded-xl border border-green-200 bg-green-50 py-6 text-center">
            <div className="text-3xl">✅</div>
            <div className="mt-2 text-sm font-bold text-green-700">Bạn đang dùng phiên bản mới nhất!</div>
          </div>
        )}

        {/* preparing: có bản mới nhưng file cho máy này đang được đăng lên */}
        {tt === 'preparing' && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-center">
            <div className="text-2xl">⏳</div>
            <div className="mt-1 text-sm font-bold text-amber-800">Bản v{moi?.phienBan} đang được đóng gói</div>
            <p className="mt-1 text-xs text-amber-700">Bản cài cho {nenTang.ten} chưa đăng xong. Vui lòng thử lại sau 5–10 phút.</p>
            <button onClick={kiemTra} className="tap mt-3 rounded-lg bg-amber-600 px-4 py-2 text-xs font-bold text-white">🔄 Kiểm tra lại</button>
          </div>
        )}

        {/* loi: không gọi được GitHub (mất mạng / giới hạn tần suất) */}
        {tt === 'loi' && (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
            <div className="text-sm font-bold text-gray-700">Không kiểm tra được bản mới</div>
            <p className="mt-1 text-xs text-gray-500">Kiểm tra kết nối mạng rồi thử lại. ({loiKiemTra})</p>
            <button onClick={kiemTra} className="tap mt-3 rounded-lg bg-brand-600 px-4 py-2 text-xs font-bold text-white">🔄 Thử lại</button>
          </div>
        )}

        {/* available | downloading | ready | installing */}
        {moi && !['idle', 'checking', 'uptodate', 'preparing', 'loi'].includes(tt) && (
          <div>
            {/* Banner bản mới */}
            <div className="mb-3 rounded-2xl border-2 border-brand-600 bg-brand-50 p-4">
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-black text-white">
                  v{moi.phienBan}
                </span>
                <span className="text-[11px] font-semibold text-brand-700">
                  {kichThuoc} MB · {moi.ngayPhatHanh}
                </span>
              </div>
              <div className="mt-2 text-sm font-black text-brand-800">🎉 {moi.tieuDe}</div>
              <div className="mt-0.5 flex items-center gap-2">
                {moi.batBuoc && <span className="text-[11px] font-bold text-brand-700">⚠ Bắt buộc</span>}
                {nguon === 'mock' && (
                  <span className="text-[10px] font-semibold text-amber-600">
                    (dữ liệu mô phỏng — repo GitHub chưa sẵn sàng)
                  </span>
                )}
              </div>
            </div>

            {/* Changelog — thẻ viền Đỏ/Trắng */}
            <div className="mb-4">
              <div className="mb-2 text-sm font-bold text-gray-800">📋 Nhật ký thay đổi</div>
              <div className="space-y-2">
                {moi.changelog.map((c, i) => {
                  const nhan = NHAN_CHANGELOG[c.loai] || NHAN_CHANGELOG.moi
                  return (
                    <div key={i} className="flex gap-2 rounded-xl border border-brand-200 bg-white p-3">
                      <span className={`h-fit flex-shrink-0 rounded px-1.5 py-0.5 text-[9px] font-black ${nhan.mau}`}>
                        {nhan.nhan}
                      </span>
                      <span className="text-xs leading-relaxed text-gray-700">{c.noiDung}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Thanh tiến độ */}
            {(tt === 'downloading' || tt === 'ready') && (
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-[11px] font-semibold text-gray-500">
                  <span>{tt === 'ready' ? 'Đã tải xong' : `Đang tải... ${tienDo}%`}</span>
                  <span>{tienDo}%</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-150"
                    style={{ width: `${tienDo}%` }}
                  />
                </div>
                {apkNative && tt === 'downloading' && (
                  <div className="mt-1 text-center text-[11px] text-gray-500">
                    {(daTai / 1024 / 1024).toFixed(1)} / {tong > 0 ? (tong / 1024 / 1024).toFixed(1) : (moi.kichThuocMB?.apk || 3.3)} MB
                  </div>
                )}
              </div>
            )}

            {/* Nút hành động */}
            {tt === 'available' && (
              <button
                onClick={apkNative ? taiVaCaiMobile : taiVe}
                className="tap w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700"
              >
                ⬇ Tải & Cập nhật v{moi.phienBan}
              </button>
            )}

            {/* PC/web: bước cài đặt riêng sau khi tải (mobile tự cài luôn) */}
            {tt === 'ready' && !apkNative && (
              <button
                onClick={caiDat}
                className="tap w-full rounded-xl bg-green-600 py-3 text-sm font-bold text-white transition hover:bg-green-700"
              >
                {nt === 'pc' ? '🔁 Cài đặt & Khởi động lại' : '🔁 Mở trang Release'}
              </button>
            )}

            {tt === 'installing' && (
              <div className="rounded-xl bg-gray-900 py-4 text-center text-sm font-semibold text-green-300">
                <span className="animate-pulse">
                  {apkNative ? '📲 Đang mở trình cài đặt bản mới...' : '⚙ Đang cài đặt & khởi động lại...'}
                </span>
              </div>
            )}

            {/* Để sau */}
            {!moi.batBuoc && (tt === 'available') && (
              <button onClick={onClose} className="mt-2 w-full py-2 text-xs font-semibold text-gray-400">
                Để sau
              </button>
            )}
          </div>
        )}

        <p className="mt-4 text-center text-[10px] text-gray-400">
          Nguồn cập nhật: GitHub Releases · api.github.com/repos/.../releases/latest
        </p>
      </div>
    </div>
  )
}
