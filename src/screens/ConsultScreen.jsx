import { useMemo, useState } from 'react'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { useKiotViet } from '../hooks/useKiotViet'
import KhoaKhachHang from '../components/KhoaKhachHang'
import { aiCoCauHinh } from '../services/maikaChatbot'
import { hoaDonGanDay, tienVN } from '../services/kiotViet'
import { soanTinFollowUp, taoChamSocSauBan } from '../services/troLyChuDong'
import { nhanThoiGian } from '../data/viecStore'

const MAU_TT = {
  'Mới': 'bg-blue-100 text-blue-700',
  'Đang xử lý': 'bg-amber-100 text-amber-700',
  'Đã giao': 'bg-green-100 text-green-700',
  'Hoàn thành': 'bg-green-100 text-green-700',
}

// ============================================================
//  HOÁ ĐƠN KIOTVIET THẬT — hẹn hỏi thăm + Maika soạn tin chăm sóc
// ============================================================
function CardHoaDon({ hd, khachMap }) {
  const [mo, setMo] = useState(false)
  const [daHen, setDaHen] = useState(false)
  const [tin, setTin] = useState('')
  const [dangSoan, setDangSoan] = useState(false)
  const toast = useToast()
  const { user } = useAuth()
  const kh = khachMap.get(hd.maKH)
  const sanPham = hd.ct.map(([, ten]) => ten).filter((t) => !/vận chuyển/i.test(t))

  const henChamSoc = async () => {
    const v = await taoChamSocSauBan({
      don: { khach: hd.khach, sdt: kh?.sdt || '', maDon: hd.ma, sanPham: sanPham.map((ten) => ({ ten })), goiY: '' },
      nguoiTao: user.id,
    })
    setDaHen(true)
    toast(`Maika sẽ nhắc hỏi thăm ${hd.khach} — ${nhanThoiGian(v.hanLuc)}`, 'success')
  }
  const soan = async () => {
    setDangSoan(true)
    try {
      setTin(await soanTinFollowUp({ loai: 'sauban', tieuDe: `Hỏi thăm sau khi mua hàng (hoá đơn ${hd.ma})`, khach: hd.khach, sanPham: sanPham.join(', '), ghiChu: `Mua ngày ${new Date(hd.ngay).toLocaleDateString('vi-VN')}. Hỏi tiến độ thi công, hướng dẫn sử dụng/bảo quản, mời mua thêm phụ kiện nếu cần.` }, user.hoTen))
    } catch (e) {
      toast('Maika chưa soạn được: ' + (e.message || e), 'error')
    } finally {
      setDangSoan(false)
    }
  }
  const chep = () => navigator.clipboard.writeText(tin).then(() => toast('Đã chép — dán vào Zalo gửi khách', 'success'), () => toast('Không chép được', 'error'))

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
      <button onClick={() => setMo((v) => !v)} className="tap flex w-full items-start gap-3 p-4 text-left">
        <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">🧾</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] text-gray-400">{hd.ma}</span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${MAU_TT[hd.tt] || 'bg-gray-100 text-gray-600'}`}>{hd.tt}</span>
            <span className="ml-auto text-xs font-bold text-gray-900">{tienVN(hd.tong)}</span>
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-gray-900">{hd.khach}</div>
          <div className="truncate text-[11px] text-gray-500">{sanPham.join(' · ') || '—'}</div>
          <div className="text-[10px] text-gray-400">{nhanThoiGian(Date.parse(hd.ngay))} · {hd.nv}</div>
        </div>
        <span className={`text-gray-300 transition ${mo ? 'rotate-90' : ''}`}>›</span>
      </button>

      {mo && (
        <div className="space-y-2 border-t border-gray-100 bg-gray-50 p-4">
          <div className="rounded-xl border border-gray-100 bg-white p-2.5">
            {hd.ct.map(([ma, ten, sl, gia], i) => (
              <div key={ma + i} className="flex justify-between gap-2 py-0.5 text-[11px]">
                <span className="text-gray-700">{ten} <span className="text-gray-400">×{sl}</span></span>
                <span className="flex-shrink-0 tabular-nums text-gray-500">{tienVN(gia * sl)}</span>
              </div>
            ))}
            {hd.tong > hd.daTra && <div className="mt-1 text-right text-[11px] font-bold text-amber-700">Còn nợ {tienVN(hd.tong - hd.daTra)}</div>}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={henChamSoc} disabled={daHen} className={`tap rounded-lg px-2.5 py-1.5 text-[11px] font-bold ${daHen ? 'bg-green-50 text-green-700' : 'bg-brand-600 text-white'}`}>
              {daHen ? '✓ Đã hẹn' : '⏰ Hẹn hỏi thăm sau 3 ngày'}
            </button>
            {aiCoCauHinh() && (
              <button onClick={soan} disabled={dangSoan} className="tap rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-700 disabled:opacity-50">
                {dangSoan ? '✍️ Đang soạn…' : '✍️ Maika soạn tin chăm sóc'}
              </button>
            )}
            {kh?.sdt && <a href={`tel:${kh.sdt}`} className="tap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">📞 {kh.sdt}</a>}
          </div>
          {tin && (
            <div className="rounded-xl border border-brand-100 bg-white p-2.5">
              <textarea value={tin} onChange={(e) => setTin(e.target.value)} rows={5} className="w-full resize-none text-xs leading-relaxed text-gray-700 outline-none" />
              <button onClick={chep} className="tap mt-1 w-full rounded-lg bg-brand-600 py-1.5 text-[11px] font-bold text-white">📋 Chép tin nhắn</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const KHOANG = [
  { so: 1, nhan: 'Hôm nay' },
  { so: 3, nhan: '3 ngày' },
  { so: 7, nhan: '7 ngày' },
  { so: 14, nhan: '14 ngày' },
]

function DanhSachKiotViet({ kv }) {
  const [soNgay, setSoNgay] = useState(3)
  const khachMap = useMemo(() => new Map(kv.khach.map((c) => [c.ma, c])), [kv])
  // kv nằm trong deps để danh sách tính lại sau mỗi lần đồng bộ KiotViet
  const ds = useMemo(() => (kv ? hoaDonGanDay(soNgay) : []), [kv, soNgay])
  const tong = ds.reduce((s, h) => s + h.tong, 0)
  return (
    <>
      <div className="mb-3 flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
          <span className="h-2 w-2 rounded-full bg-green-500" /> KiotViet · {new Date(kv.capNhat).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
        </div>
        <span className="text-xs text-green-600">{ds.length} hoá đơn · {tienVN(tong)}</span>
      </div>
      <div className="mb-3 flex gap-1.5">
        {KHOANG.map((k) => (
          <button key={k.so} onClick={() => setSoNgay(k.so)}
            className={`tap rounded-full border px-3 py-1 text-[11px] font-semibold ${soNgay === k.so ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`}>
            {k.nhan}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {ds.slice(0, 60).map((hd) => <CardHoaDon key={hd.ma} hd={hd} khachMap={khachMap} />)}
        {ds.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400">Chưa có hoá đơn trong khoảng này.</div>}
      </div>
    </>
  )
}

export default function ConsultScreen({ onMo }) {
  const kv = useKiotViet()
  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Chăm sóc sau bán</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Hoá đơn KiotViet · Maika hẹn hỏi thăm & soạn tin chăm sóc khách</p>

      <button onClick={() => onMo && onMo('guitailieu')} className="tap mb-4 flex w-full items-center justify-center gap-2 rounded-xl border border-brand-200 bg-brand-50 py-3 text-sm font-bold text-brand-700">
        📤 Gửi tài liệu cho khách
      </button>

      {kv?.coRieng ? <DanhSachKiotViet kv={kv} /> : <KhoaKhachHang />}
    </div>
  )
}
