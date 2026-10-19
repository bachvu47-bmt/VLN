import { useState } from 'react'
import { VAI_TRO } from '../data/mockData'
import { PHIEN_BAN_HIEN_TAI } from '../data/appInfo'
import { useToast } from '../context/ToastContext'
import { dongBoVaHoc } from '../services/webSyncService'
import { laySanPhamWeb } from '../data/productStore'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import ChangePasswordModal from '../components/ChangePasswordModal'
import PinAdminCard from '../components/PinAdminCard'
import MaDuLieuCard from '../components/MaDuLieuCard'

function vietTat(t = '') {
  const w = t.trim().split(/\s+/)
  return (w[0][0] + (w[w.length - 1][0] || '')).toUpperCase()
}

function Ico({ d, className = 'h-5 w-5' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}><path d={d} /></svg>
}

export default function ThemScreen({ user, onMo, onCapNhat, onLogout }) {
  const vt = VAI_TRO[user.vaiTro]
  const admin = user.vaiTro === 'admin'
  const toast = useToast()
  const [moDoiMK, setMoDoiMK] = useState(false)
  const [dangDongBo, setDangDongBo] = useState(false)
  const [soWeb, setSoWeb] = useState(laySanPhamWeb().length)
  const { tk } = useBoNhoMaika()

  const dongBo = async () => {
    if (dangDongBo) return
    setDangDongBo(true)
    toast('Đang đồng bộ sản phẩm từ vatlieunha.vn...', 'info')
    try {
      const kq = await dongBoVaHoc(() => {})
      setSoWeb(kq.soSanPham)
      toast(
        kq.boQua
          ? `Đã đồng bộ ${kq.soSanPham} sản phẩm vào Tra cứu · Nhập PIN Admin để nạp tri thức lên kho chung`
          : `Đã đồng bộ ${kq.soSanPham} sản phẩm vào Tra cứu · Maika đang học ${kq.doanMoi} đoạn tri thức mới`,
        'success',
      )
    } catch (e) {
      toast('Đồng bộ lỗi: ' + (e.message || e) + ' (có thể do CORS trên web — thử trên bản .apk)', 'error')
    } finally {
      setDangDongBo(false)
    }
  }

  const MENU = [
    { ten: 'Trợ lý Maika', phu: 'Hỏi đáp kỹ thuật & tư vấn sản phẩm', d: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10Z M8 9h8 M8 12h5', on: () => onMo('tuvanai') },
    admin && { ten: 'Báo cáo bán hàng', phu: 'Doanh thu, tỷ lệ chốt, báo giá cần follow-up (Google Sheets)', d: 'M4 20V10 M10 20V4 M16 20v-7 M22 20H2', on: () => onMo('baocao') },
    admin && { ten: 'AI Admin — Dạy Maika', phu: `Nạp tài liệu, bộ nhớ vector: ${tk.tong} mẩu tri thức`, d: 'M12 3v3 M9 6h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z M9.5 12h.01 M14.5 12h.01 M9 16h6', on: () => onMo('ingest') },
    admin && { ten: 'Duyệt kiến thức', phu: tk.choDuyet ? `${tk.choDuyet} đề xuất đính chính đang chờ duyệt` : 'Xét duyệt đề xuất cập nhật kỹ thuật', badge: tk.choDuyet, d: 'M9 12l2 2 4-4 M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z', on: () => onMo('duyet') },
    admin && { ten: 'Nhân sự & Tài khoản', phu: 'Quản lý người dùng, phiên đăng nhập', d: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z M2.5 20a6.5 6.5 0 0 1 13 0 M17 11a3 3 0 1 0 0-6 M21.5 20a5.5 5.5 0 0 0-5-5.5', on: () => onMo('users') },
    { ten: 'Đổi mật khẩu', phu: 'Cập nhật mật khẩu đăng nhập', d: 'M6 10V8a6 6 0 1 1 12 0v2 M5 10h14v10H5z M12 14v2', on: () => setMoDoiMK(true) },
    { ten: 'Cập nhật phần mềm', phu: `Phiên bản hiện tại v${PHIEN_BAN_HIEN_TAI}`, d: 'M21 12a9 9 0 1 1-3-6.7 M21 3v6h-6', on: onCapNhat },
  ].filter(Boolean)

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-black text-gray-900">Tài khoản</h2>

      {/* Hồ sơ cá nhân */}
      <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{vietTat(user.hoTen)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-base font-black text-gray-900">{user.hoTen}</div>
          <div className="truncate text-xs text-gray-500">{user.email}</div>
          <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold text-white ${vt.mau}`}>{vt.ten}</span>
        </div>
      </div>

      {/* Menu */}
      <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
        {MENU.map((m) => (
          <button key={m.ten} onClick={m.on} className="tap flex w-full items-center gap-3 p-4 text-left">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600"><Ico d={m.d} /></span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-gray-900">{m.ten}</div>
              <div className="truncate text-[11px] text-gray-500">{m.phu}</div>
            </div>
            {m.badge > 0 && <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">{m.badge}</span>}
            <span className="text-gray-300">›</span>
          </button>
        ))}
      </div>

      <MaDuLieuCard />

      {admin && <PinAdminCard />}

      {/* Đồng bộ dữ liệu từ Website (Admin) */}
      {admin && (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 p-4">
          <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">🔄 Đồng bộ dải sản phẩm</div>
          <p className="mb-3 text-xs text-gray-600">
            Lấy danh mục, hình ảnh, tài liệu kỹ thuật & sản phẩm mới nhất từ <b>vatlieunha.vn</b> vào Tra cứu (Flashcard) và nạp vào bộ nhớ Maika.
            {soWeb > 0 && <span className="font-semibold text-brand-700"> Đã có {soWeb} sản phẩm web.</span>}
          </p>
          <button onClick={dongBo} disabled={dangDongBo}
            className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white hover:bg-brand-700 disabled:opacity-60">
            {dangDongBo ? '⏳ Đang đồng bộ...' : '⬇ Đồng bộ dữ liệu từ Website vatlieunha.vn'}
          </button>
        </div>
      )}

      {/* Đăng xuất */}
      <button onClick={onLogout} className="tap flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 py-3 text-sm font-bold text-brand-700">
        <Ico d="M15 12H3 M9 6l-6 6 6 6 M15 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" /> Đăng xuất
      </button>

      <p className="pb-2 text-center text-[11px] text-gray-400">© 2026 Vật Liệu Nhà · Hệ thống bán hàng nội bộ</p>

      {moDoiMK && <ChangePasswordModal onClose={() => setMoDoiMK(false)} />}
    </div>
  )
}
