import { useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import { coKhoChung, layPinAdmin, luuPinAdmin, xoaPinAdmin } from '../services/khoChung'
import { sauKhiCoPin, trangThaiDongBo } from '../services/vectorStore'

// Xác thực máy Admin với kho tri thức chung (PIN kiểm tra trên máy chủ)
export default function PinAdminCard() {
  useBoNhoMaika() // cập nhật giờ đồng bộ
  const toast = useToast()
  const [pin, setPin] = useState('')
  const [coPin, setCoPin] = useState(() => !!layPinAdmin())
  const [dangKiem, setDangKiem] = useState(false)

  if (!coKhoChung()) return null
  const db = trangThaiDongBo()

  const luu = async () => {
    if (!pin.trim() || dangKiem) return
    setDangKiem(true)
    try {
      await luuPinAdmin(pin.trim())
      setCoPin(true)
      setPin('')
      toast('Đã xác thực Admin — máy này được dạy Maika cho cả hệ thống', 'success')
      sauKhiCoPin()
    } catch (e) {
      toast(e.message || String(e), 'error')
    } finally {
      setDangKiem(false)
    }
  }

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">🔐 Kho tri thức chung</div>
      <p className="mb-3 text-[11px] text-gray-500">
        {db.loi ? <span className="text-red-600">Mất kết nối kho chung: {db.loi}</span> : db.lanCuoi ? `Đã đồng bộ lúc ${new Date(db.lanCuoi).toLocaleTimeString('vi-VN')}` : 'Đang kết nối…'}
      </p>
      {coPin ? (
        <div className="flex items-center justify-between rounded-xl bg-green-50 px-3 py-2.5">
          <span className="text-xs font-bold text-green-700">✓ Máy này đã xác thực Admin</span>
          <button onClick={() => { xoaPinAdmin(); setCoPin(false) }} className="text-[11px] font-semibold text-gray-500 underline">Gỡ khỏi máy này</button>
        </div>
      ) : (
        <>
          <p className="mb-2 text-[11px] text-gray-600">Nhập PIN Admin để dạy Maika, duyệt đề xuất và nạp dữ liệu website cho toàn bộ nhân viên.</p>
          <div className="flex gap-2">
            <input type="password" value={pin} onChange={(e) => setPin(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && luu()}
              placeholder="PIN Admin" autoComplete="off"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white" />
            <button onClick={luu} disabled={dangKiem || !pin.trim()} className="tap rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50">
              {dangKiem ? '…' : 'Xác thực'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
