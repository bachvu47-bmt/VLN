import { useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useKiotViet } from '../hooks/useKiotViet'
import KhoaKhachHang from '../components/KhoaKhachHang'
import { aiCoCauHinh } from '../services/maikaChatbot'
import { lichSuMua, tienVN, timKhach } from '../services/kiotViet'
import { soanTinFollowUp } from '../services/troLyChuDong'
import { vnd } from '../services/baoCaoSheets'

function vietTat(t = '') {
  const w = t.trim().split(/\s+/)
  return ((w[0]?.[0] || '') + (w[w.length - 1]?.[0] || '')).toUpperCase()
}

// Hồ sơ 1 khách KiotViet: lịch sử mua + Maika soạn tin chăm sóc
function ChiTietKhach({ c }) {
  const { user } = useAuth()
  const toast = useToast()
  const [tin, setTin] = useState('')
  const [dang, setDang] = useState(false)
  const ls = lichSuMua(c.ma)
  const tong = ls.reduce((s, h) => s + h.tong, 0)
  const daMua = [...new Set(ls.flatMap((h) => h.ct.map(([, ten]) => ten)).filter((t) => !/vận chuyển/i.test(t)))]

  const soan = async () => {
    setDang(true)
    try {
      setTin(await soanTinFollowUp({ loai: 'sauban', tieuDe: 'Chăm sóc khách hàng cũ', khach: c.ten, sanPham: daMua.slice(0, 4).join(', '), ghiChu: ls[0] ? `Lần mua gần nhất ${new Date(ls[0].ngay).toLocaleDateString('vi-VN')}. Hỏi thăm công trình, giới thiệu sản phẩm liên quan.` : 'Khách chưa mua trong 180 ngày qua — mời ghé cửa hàng.' }, user.hoTen))
    } catch (e) {
      toast('Maika chưa soạn được: ' + (e.message || e), 'error')
    } finally {
      setDang(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-gray-100 bg-gray-50 p-3">
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-white p-2"><div className="text-sm font-black text-gray-900">{ls.length}</div><div className="text-[10px] text-gray-500">hoá đơn (180 ngày)</div></div>
        <div className="rounded-lg bg-white p-2"><div className="text-sm font-black text-gray-900">{vnd(tong)}</div><div className="text-[10px] text-gray-500">đã mua</div></div>
        <div className="rounded-lg bg-white p-2"><div className={`text-sm font-black ${c.no ? 'text-amber-700' : 'text-gray-900'}`}>{vnd(c.no)}</div><div className="text-[10px] text-gray-500">công nợ</div></div>
      </div>
      {c.dc && <p className="text-[11px] text-gray-600">📍 {c.dc}</p>}
      {ls.slice(0, 5).map((h) => (
        <div key={h.ma} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px]">
          <div className="flex justify-between"><span className="font-mono text-gray-400">{h.ma} · {new Date(h.ngay).toLocaleDateString('vi-VN')}</span><b className="text-gray-800">{tienVN(h.tong)}</b></div>
          <div className="truncate text-gray-600">{h.ct.map(([, ten, sl]) => `${ten} ×${sl}`).join(', ')}</div>
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {c.sdt && <a href={`tel:${c.sdt}`} className="tap rounded-lg bg-brand-600 px-2.5 py-1.5 text-[11px] font-bold text-white">📞 Gọi {c.sdt}</a>}
        {aiCoCauHinh() && (
          <button onClick={soan} disabled={dang} className="tap rounded-lg border border-brand-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-brand-700 disabled:opacity-50">{dang ? '✍️ Đang soạn…' : '✍️ Maika soạn tin chăm sóc'}</button>
        )}
      </div>
      {tin && (
        <div className="rounded-xl border border-brand-100 bg-white p-2.5">
          <textarea value={tin} onChange={(e) => setTin(e.target.value)} rows={5} className="w-full resize-none text-xs leading-relaxed text-gray-700 outline-none" />
          <button onClick={() => navigator.clipboard.writeText(tin).then(() => toast('Đã chép — dán vào Zalo gửi khách', 'success'))} className="tap mt-1 w-full rounded-lg bg-brand-600 py-1.5 text-[11px] font-bold text-white">📋 Chép tin nhắn</button>
        </div>
      )}
    </div>
  )
}

export default function KhachScreen() {
  const kv = useKiotViet()
  const [q, setQ] = useState('')
  const [mo, setMo] = useState(null)
  const coRieng = !!kv?.coRieng // khách hàng KiotViet: chỉ máy Admin
  const ds = useMemo(() => (coRieng ? timKhach(q, 60) : []), [q, coRieng, kv])

  if (!coRieng) {
    return (
      <div>
        <h2 className="text-2xl font-black text-gray-900">Khách hàng</h2>
        <p className="mb-4 mt-1 text-sm text-gray-500">Hồ sơ khách & lịch sử mua hàng</p>
        <KhoaKhachHang />
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-black text-gray-900">Khách hàng</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">{`${kv.khach.length} khách KiotViet · hồ sơ & lịch sử mua`}</p>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 text-gray-400" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z M21 21l-4.3-4.3" /></svg>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên, số điện thoại, mã KH..." className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400" />
      </div>

      <div className="space-y-3">
        {ds.map((c) => (
              <div key={c.ma} className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
                <button onClick={() => setMo(mo === c.ma ? null : c.ma)} className="tap flex w-full items-center gap-3 p-4 text-left">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-600">{vietTat(c.ten)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-bold text-gray-900">{c.ten}</span>
                      {c.no > 0 && <span className="flex-shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">Nợ {tienVN(c.no)}</span>}
                    </div>
                    <div className="truncate text-[12px] text-gray-500">{c.sdt || 'Chưa có SĐT'}{c.dc ? ` · ${c.dc}` : ''}</div>
                    <div className="truncate text-[11px] text-gray-400">{c.ma}{c.nhom ? ` · ${c.nhom}` : ''}</div>
                  </div>
                  <span className={`text-gray-300 transition ${mo === c.ma ? 'rotate-90' : ''}`}>›</span>
                </button>
                {mo === c.ma && <ChiTietKhach c={c} />}
              </div>
            ))}
        {ds.length === 0 && <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400">Không tìm thấy khách.</div>}
      </div>
    </div>
  )
}
