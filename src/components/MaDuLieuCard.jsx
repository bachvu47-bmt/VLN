import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useKiotViet } from '../hooks/useKiotViet'
import { coMaDuLieu, luuMaDuLieu, napKiotViet, xoaMaDuLieu } from '../services/kiotViet'

// Nhập "Mã dữ liệu cửa hàng" (Admin cấp) để mở dữ liệu KiotViet trên máy này
export default function MaDuLieuCard({ gon = false }) {
  const toast = useToast()
  const kv = useKiotViet()
  const [ma, setMa] = useState('')
  const [dang, setDang] = useState(false)

  const luu = async () => {
    if (!ma.trim() || dang) return
    setDang(true)
    try {
      const d = await luuMaDuLieu(ma)
      toast(`Đã kết nối KiotViet: ${d.sanPham.length} hàng hoá, ${d.khach.length} khách`, 'success')
      setMa('')
    } catch (e) {
      toast(e.message || String(e), 'error')
    } finally {
      setDang(false)
    }
  }
  const lamMoi = async () => {
    setDang(true)
    try {
      await napKiotViet({ batBuoc: true })
      toast('Đã cập nhật dữ liệu KiotViet', 'success')
    } catch (e) {
      toast('Làm mới lỗi: ' + (e.message || e), 'error')
    } finally {
      setDang(false)
    }
  }

  if (kv) {
    if (gon) return null
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-4">
        <div className="mb-1 text-sm font-black text-gray-900">🏪 KiotViet đã kết nối</div>
        <p className="mb-3 text-[11px] text-gray-500">
          {kv.sanPham.length} hàng hoá · {kv.hoaDon.length} hoá đơn (180 ngày) · {kv.khach.length} khách · đồng bộ lúc {new Date(kv.capNhat).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
        </p>
        <div className="flex gap-2">
          <button onClick={lamMoi} disabled={dang} className="tap flex-1 rounded-xl border border-gray-200 py-2 text-xs font-bold text-gray-700 disabled:opacity-50">{dang ? '⏳' : '↻ Làm mới'}</button>
          <button onClick={xoaMaDuLieu} className="tap rounded-xl px-3 py-2 text-xs font-semibold text-gray-400">Gỡ khỏi máy</button>
        </div>
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-dashed border-brand-200 bg-brand-50 p-4">
      <div className="mb-1 text-sm font-black text-gray-900">🏪 Kết nối dữ liệu KiotViet</div>
      <p className="mb-3 text-[11px] text-gray-600">
        Nhập <b>Mã dữ liệu cửa hàng</b> (hỏi Admin) để xem tồn kho, giá bán, hoá đơn & khách hàng thật.{coMaDuLieu() ? ' Mã đã lưu nhưng chưa tải được dữ liệu — kiểm tra mạng.' : ''}
      </p>
      <div className="flex gap-2">
        <input type="password" value={ma} onChange={(e) => setMa(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && luu()} placeholder="Mã dữ liệu cửa hàng" autoComplete="off"
          className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
        <button onClick={luu} disabled={dang || !ma.trim()} className="tap rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50">{dang ? '…' : 'Mở'}</button>
      </div>
    </div>
  )
}
