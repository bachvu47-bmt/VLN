import { useState } from 'react'
import { DON_HANG } from '../data/mockData'
import { maikaPhanTichDon } from '../services/maika'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { taoChamSocSauBan } from '../services/troLyChuDong'
import { nhanThoiGian } from '../data/viecStore'

const MAU_TT = {
  'Mới': 'bg-blue-100 text-blue-700',
  'Đang xử lý': 'bg-amber-100 text-amber-700',
  'Đã giao': 'bg-green-100 text-green-700',
}

function CardDon({ don }) {
  const [mo, setMo] = useState(false)
  const [daGui, setDaGui] = useState({})
  const [daHen, setDaHen] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const buoc = maikaPhanTichDon(don)

  // Trợ lý chủ động: hẹn hỏi thăm khách sau bán, Maika nhắc đúng ngày
  const henChamSoc = async () => {
    const v = await taoChamSocSauBan({ don, nguoiTao: user.id })
    setDaHen(true)
    toast(`Maika sẽ nhắc hỏi thăm ${don.khach} — ${nhanThoiGian(v.hanLuc)}`, 'success')
  }

  const gui = (ma, loai, nhan) => {
    setDaGui((d) => ({ ...d, [`${ma}-${loai}`]: true }))
    toast(`Đã gửi ${nhan} tới khách`, 'success')
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button onClick={() => setMo((v) => !v)} className="tap flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-gray-400">{don.maDon}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${MAU_TT[don.trangThai]}`}>{don.trangThai}</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-gray-900">{don.khach} <span className="text-[11px] font-normal text-gray-400">(Dữ liệu minh họa)</span></div>
          <div className="truncate text-[11px] text-gray-500">{don.sanPham.map((s) => `${s.ten} ×${s.soLuong}`).join(' · ')} · {don.ngay}</div>
        </div>
        <span className={`text-gray-300 transition ${mo ? 'rotate-90' : ''}`}>›</span>
      </button>

      {mo && (
        <div className="border-t border-gray-100 bg-gray-50 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold text-brand-600"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">M</span> Maika phân tích đơn hàng</div>
          <div className="space-y-2">
            {buoc.map((b, i) => (
              <div key={b.sp.ma} className="rounded-xl border border-gray-100 bg-white p-3">
                <div className="flex items-start gap-2">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold text-white">{i + 1}</span>
                  <div className="flex-1">
                    <div className="text-sm font-bold text-gray-800">{b.sp.ten}</div>
                    <p className="mt-0.5 text-xs text-gray-600">{b.noiDung}</p>
                    {b.canhBao && <p className="mt-1.5 rounded-lg bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">⛔ Nhắc khách: {b.canhBao}</p>}
                  </div>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button disabled={daGui[`${b.sp.ma}-video`]} onClick={() => gui(b.sp.ma, 'video', 'video')}
                    className={`tap flex-1 rounded-lg py-2 text-xs font-bold ${daGui[`${b.sp.ma}-video`] ? 'bg-green-100 text-green-700' : 'bg-brand-600 text-white'}`}>
                    {daGui[`${b.sp.ma}-video`] ? '✓ Đã gửi video' : '▶ Gửi Video'}
                  </button>
                  <button disabled={daGui[`${b.sp.ma}-tl`]} onClick={() => gui(b.sp.ma, 'tl', 'tài liệu')}
                    className={`tap flex-1 rounded-lg border py-2 text-xs font-bold ${daGui[`${b.sp.ma}-tl`] ? 'border-green-200 bg-green-50 text-green-700' : 'border-gray-200 text-gray-700'}`}>
                    {daGui[`${b.sp.ma}-tl`] ? '✓ Đã gửi' : '📄 Gửi Tài liệu'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={henChamSoc} disabled={daHen}
            className={`tap mt-3 w-full rounded-xl border py-2.5 text-xs font-bold ${daHen ? 'border-green-200 bg-green-50 text-green-700' : 'border-brand-200 bg-white text-brand-700'}`}>
            {daHen ? '✓ Đã hẹn — Maika sẽ nhắc' : '⏰ Hẹn hỏi thăm khách sau 3 ngày'}
          </button>
          <p className="mt-3 text-center text-[10px] text-gray-400">Gửi qua Cổng Server tự động → Zalo / SMS / Email khách hàng</p>
        </div>
      )}
    </div>
  )
}

export default function ConsultScreen({ onMo }) {
  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Gợi ý tư vấn sau bán</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Đơn đồng bộ từ KiotViet · Maika gợi ý & gửi tài liệu</p>

      <div className="mb-3 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-green-500" /> Đã đồng bộ KiotViet
        </div>
        <span className="text-xs text-green-600">{DON_HANG.length} đơn hôm nay</span>
      </div>

      <button onClick={() => onMo && onMo('guitailieu')} className="tap mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 py-3 text-sm font-bold text-brand-700">
        📤 Gửi tài liệu cho khách
      </button>

      <div className="space-y-3">
        {DON_HANG.map((don) => <CardDon key={don.id} don={don} />)}
      </div>
    </div>
  )
}
