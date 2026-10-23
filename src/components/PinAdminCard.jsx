import { useEffect, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useBoNhoMaika } from '../hooks/useBoNhoMaika'
import {
  coDangNhapEmail, coKhoChung, coPhienAdmin, coQuyenAdmin, dangXuatEmailAdmin, EMAIL_ADMIN, guiMaEmailAdmin, layPinAdmin, luuPinAdmin, xacMinhMaEmailAdmin, xoaPinAdmin,
} from '../services/khoChung'
import { napKiotViet } from '../services/kiotViet'
import { sauKhiCoPin, trangThaiDongBo } from '../services/vectorStore'

// Xác thực máy Admin với kho tri thức chung — mặc định đăng nhập email Admin bằng mã 6 số (1 lần/máy),
// PIN chỉ là đường dự phòng. Máy chủ kiểm tra lại (schema.sql: _la_email_admin / _bat_pin).
// gon: dạng thu gọn đặt trong thẻ duyệt; onXong: gọi sau khi xác thực xong (vd. duyệt tiếp thẻ đang dở)
export default function PinAdminCard({ gon = false, onXong, onHuy }) {
  useBoNhoMaika() // cập nhật giờ đồng bộ
  const toast = useToast()
  const [, setLai] = useState(0)
  const [buoc, setBuoc] = useState('dau') // dau | ma | pin
  const [giaTri, setGiaTri] = useState('')
  const [dangLam, setDangLam] = useState(false)
  const [coEmail, setCoEmail] = useState(false)

  // Máy chủ chưa gửi được email có mã (gói Free, chưa có SMTP riêng) → chỉ dùng PIN
  useEffect(() => {
    coDangNhapEmail().then((co) => {
      setCoEmail(co)
      if (!co) setBuoc((b) => (b === 'dau' ? 'pin' : b))
    })
  }, [])

  if (!coKhoChung()) return null
  const db = trangThaiDongBo()

  const lam = async (viec) => {
    if (dangLam) return
    setDangLam(true)
    try {
      await viec()
    } catch (e) {
      toast(e.message || String(e), 'error')
    } finally {
      setDangLam(false)
    }
  }

  const xong = (thongBao) => {
    toast(thongBao, 'success')
    setGiaTri('')
    setBuoc('dau')
    setLai((n) => n + 1)
    sauKhiCoPin()
    napKiotViet({ batBuoc: true }).catch(() => {}) // Admin → tải thêm khách hàng & hoá đơn
    onXong?.()
  }

  const guiMa = () =>
    lam(async () => {
      await guiMaEmailAdmin()
      setBuoc('ma')
      setGiaTri('')
      toast(`Đã gửi mã tới ${EMAIL_ADMIN} — mở Gmail để lấy mã`, 'success')
    })

  const xacNhan = () =>
    lam(async () => {
      if (!giaTri.trim()) return
      if (buoc === 'pin') {
        await luuPinAdmin(giaTri.trim())
        xong('Đã xác thực Admin bằng PIN')
      } else {
        await xacMinhMaEmailAdmin(giaTri)
        xong('Đã đăng nhập Admin — máy này không hỏi lại nữa')
      }
    })

  const tieuDe = gon ? '🔐 Xác thực máy Admin (chỉ 1 lần)' : '🔐 Kho tri thức chung'

  const khung = (noiDung) => (
    <div className={gon ? 'rounded-xl border border-brand-100 bg-brand-50/60 p-3' : 'rounded-2xl border border-gray-100 bg-white p-4'}>
      <div className="mb-1 flex items-center gap-2 text-sm font-black text-gray-900">{tieuDe}</div>
      {!gon && (
        <p className="mb-3 text-[11px] text-gray-500">
          {db.loi ? <span className="text-red-600">Mất kết nối kho chung: {db.loi}</span> : db.lanCuoi ? `Đã đồng bộ lúc ${new Date(db.lanCuoi).toLocaleTimeString('vi-VN')}` : 'Đang kết nối…'}
        </p>
      )}
      {noiDung}
    </div>
  )

  if (coQuyenAdmin()) {
    if (gon) return null
    const quaEmail = coPhienAdmin()
    return khung(
      <div className="flex items-center justify-between gap-2 rounded-xl bg-green-50 px-3 py-2.5">
        <span className="text-xs font-bold text-green-700">✓ Máy này đã xác thực Admin{quaEmail ? ` · ${EMAIL_ADMIN}` : ' · PIN'}</span>
        <button
          onClick={() => {
            dangXuatEmailAdmin()
            if (layPinAdmin()) xoaPinAdmin()
            setLai((n) => n + 1)
            napKiotViet().catch(() => {}) // bỏ khách hàng & hoá đơn khỏi RAM
          }}
          className="text-[11px] font-semibold text-gray-500 underline">
          Gỡ khỏi máy này
        </button>
      </div>,
    )
  }

  const o = (goiY, kieu) => (
    <div className="flex gap-2">
      <input type={kieu} inputMode={kieu === 'password' ? undefined : 'numeric'} autoFocus value={giaTri} onChange={(e) => setGiaTri(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && xacNhan()} placeholder={goiY} autoComplete={kieu === 'password' ? 'off' : 'one-time-code'}
        className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500" />
      <button onClick={xacNhan} disabled={dangLam || !giaTri.trim()} className="tap rounded-xl bg-brand-600 px-4 text-sm font-bold text-white disabled:opacity-50">
        {dangLam ? '…' : 'Xác nhận'}
      </button>
    </div>
  )

  return khung(
    <>
      {buoc === 'dau' && (
        <>
          <p className="mb-2 text-[11px] text-gray-600">
            Đăng nhập email Admin <b>{EMAIL_ADMIN}</b> để duyệt tri thức, dạy Maika và nạp dữ liệu cho toàn bộ nhân viên. Chỉ cần 1 lần trên mỗi máy.
          </p>
          <button onClick={guiMa} disabled={dangLam} className="tap w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white disabled:opacity-50">
            {dangLam ? 'Đang gửi…' : `✉️ Gửi mã đăng nhập tới ${EMAIL_ADMIN}`}
          </button>
        </>
      )}
      {buoc === 'ma' && (
        <>
          <p className="mb-2 text-[11px] text-gray-600">Nhập mã 6 số trong email vừa gửi tới {EMAIL_ADMIN} (xem cả mục Spam).</p>
          {o('Mã 6 số', 'text')}
          <button onClick={guiMa} disabled={dangLam} className="mt-1.5 text-[11px] text-brand-600 underline">Gửi lại mã</button>
        </>
      )}
      {buoc === 'pin' && (
        <>
          <p className="mb-2 text-[11px] text-gray-600">Nhập PIN Admin 1 lần — máy này nhớ luôn, không hỏi lại.</p>
          {o('PIN Admin', 'password')}
        </>
      )}
      <div className="mt-2 flex gap-3 text-[11px] text-gray-500">
        {buoc !== 'pin' ? (
          <button onClick={() => { setBuoc('pin'); setGiaTri('') }} className="underline">Dùng PIN thay thế</button>
        ) : (
          coEmail && <button onClick={() => { setBuoc('dau'); setGiaTri('') }} className="underline">Đăng nhập bằng email</button>
        )}
        {onHuy && <button onClick={onHuy} className="underline">Huỷ</button>}
      </div>
    </>,
  )
}
