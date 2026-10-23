import { useAuth } from '../context/AuthContext'
import { useKiotViet } from '../hooks/useKiotViet'
import { coKhoChung, coQuyenAdmin } from '../services/khoChung'
import { dangDongBoKV, napKiotViet } from '../services/kiotViet'
import PinAdminCard from './PinAdminCard'

// Hiện thay cho danh sách khách hàng / hoá đơn KiotViet khi máy CHƯA có phần riêng tư.
// Không còn ô nhập mã, không còn dữ liệu minh hoạ:
//  · không phải Admin → khoá (chỉ Admin được xem)
//  · Admin chưa xác thực với máy chủ → đăng nhập email Admin 1 lần, xong tự tải
//  · còn lại → "Đang đồng bộ…"
export default function KhoaKhachHang() {
  useKiotViet() // render lại khi đồng bộ xong
  const { laAdmin } = useAuth()

  if (!laAdmin) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-6 text-center">
        <div className="mb-2 text-3xl">🔒</div>
        <div className="text-sm font-bold text-gray-700">Hoá đơn & khách hàng chỉ Admin xem được</div>
        <p className="mt-1 text-xs text-gray-400">Tra tồn kho và giá bán ở mục Tra cứu.</p>
      </div>
    )
  }

  if (coKhoChung() && !coQuyenAdmin()) {
    return <PinAdminCard gon />
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
      <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
      <div className="text-sm font-bold text-gray-700">Đang đồng bộ dữ liệu KiotViet…</div>
      <p className="mt-1 text-xs text-gray-400">
        {dangDongBoKV() ? 'Đang tải hoá đơn & khách hàng từ máy chủ.' : 'Máy chủ tự đồng bộ KiotViet 30 phút/lần (7:00–22:30) — dữ liệu sẽ tự hiện.'}
      </p>
      {!dangDongBoKV() && (
        <button onClick={() => napKiotViet({ batBuoc: true }).catch(() => {})} className="tap mt-3 text-xs font-semibold text-brand-600 underline">
          Tải lại ngay
        </button>
      )}
    </div>
  )
}
