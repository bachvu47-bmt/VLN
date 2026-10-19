import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { canFollowUp, coNguonBaoCao, taiBaoCao } from '../services/baoCaoSheets'
import { useToast } from '../context/ToastContext'
import { useViec } from '../hooks/useViec'
import { LOAI_VIEC, nhanThoiGian, xoaViec } from '../data/viecStore'
import { aiCoCauHinh } from '../services/maikaChatbot'
import {
  doiHan,
  huyNhac,
  moLaiViec,
  soanTinFollowUp,
  tachViecTuCau,
  taoFollowUpBaoGia,
  taoViec,
  tomTatHomNay,
  xongViec,
} from '../services/troLyChuDong'

// ============================================================
//  THẺ "MAIKA NHẮC HÔM NAY" — tóm tắt + tạo việc bằng câu nói
// ============================================================
export function MaikaNhacHomNay({ onThem, onMo }) {
  const { user } = useViec()
  const { laAdmin } = useAuth()
  const toast = useToast()
  const [cau, setCau] = useState('')
  const [dang, setDang] = useState(false)
  const [soFU, setSoFU] = useState(0)

  // Admin: đếm báo giá trên Google Sheet cần follow-up (đọc bản lưu, làm mới nền nếu cũ)
  useEffect(() => {
    if (!laAdmin || !coNguonBaoCao()) return
    let huy = false
    taiBaoCao()
      .then(({ rows }) => !huy && setSoFU(canFollowUp(rows).length))
      .catch(() => {})
    return () => {
      huy = true
    }
  }, [laAdmin])
  const tt = tomTatHomNay(user?.id)
  const ten = user?.hoTen?.split(' ').pop() || ''

  const tao = async () => {
    if (!cau.trim() || dang) return
    setDang(true)
    try {
      const v = await taoViec(await tachViecTuCau(cau.trim(), user.id))
      toast(`Maika sẽ nhắc: ${v.tieuDe} — ${nhanThoiGian(v.hanLuc)}`, 'success')
      setCau('')
    } catch (e) {
      toast('Maika chưa hiểu câu nhắc: ' + (e.message || e), 'error')
    } finally {
      setDang(false)
    }
  }

  const loiChao = tt.tong
    ? [
        tt.quaHan.length && `⚠️ ${tt.quaHan.length} việc quá hạn`,
        tt.trongNgay.length && `${tt.trongNgay.length} việc trong hôm nay`,
        tt.followUp.length && `${tt.followUp.length} báo giá cần follow-up`,
        tt.sapToi.length && `${tt.sapToi.length} việc 2 ngày tới`,
      ]
        .filter(Boolean)
        .join(' · ') || 'Không có việc gấp hôm nay 👍'
    : 'Chưa có việc nào — gõ "Nhắc tôi gọi chị Mai 10h sáng mai" để Maika lên lịch.'

  return (
    <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 to-white p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">M</span>
        <span className="text-sm font-black text-gray-900">Maika nhắc hôm nay{ten ? `, anh/chị ${ten}` : ''}</span>
      </div>
      <p className="mb-3 text-xs leading-relaxed text-gray-600">{loiChao}</p>

      {tt.quaHan[0] && (
        <div className="mb-3 rounded-xl border-l-4 border-brand-600 bg-white px-3 py-2 text-xs">
          <span className="font-bold text-brand-700">Ưu tiên: </span>
          <span className="text-gray-700">{tt.quaHan[0].tieuDe}</span>
          <span className="text-gray-400"> · trễ từ {nhanThoiGian(tt.quaHan[0].hanLuc)}</span>
        </div>
      )}

      {soFU > 0 && (
        <button onClick={() => onMo?.('baocao')} className="tap mb-3 flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-xs">
          <span><b className="text-gray-900">🔔 {soFU} báo giá</b> <span className="text-gray-600">trên báo cáo bán hàng cần follow-up</span></span>
          <span className="font-bold text-brand-600">Xem ›</span>
        </button>
      )}

      {aiCoCauHinh() && (
        <div className="mb-2 flex gap-2">
          <input value={cau} onChange={(e) => setCau(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tao()}
            placeholder='vd: "Nhắc tôi follow-up báo giá anh Hùng thứ 6"'
            className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500" />
          <button onClick={tao} disabled={dang || !cau.trim()} className="tap rounded-xl bg-brand-600 px-3 text-xs font-bold text-white disabled:opacity-50">
            {dang ? '…' : 'Nhắc'}
          </button>
        </div>
      )}
      <div className="flex gap-2">
        <button onClick={() => onThem('viec')} className="tap flex-1 rounded-xl border border-brand-200 bg-white py-2 text-xs font-bold text-brand-700">+ Việc mới</button>
        <button onClick={() => onThem('baogia')} className="tap flex-1 rounded-xl border border-brand-200 bg-white py-2 text-xs font-bold text-brand-700">📑 Vừa gửi báo giá</button>
      </div>
    </div>
  )
}

// ============================================================
//  1 VIỆC — chạm để mở thao tác
// ============================================================
function DongViec({ v, bayGio }) {
  const { user } = useAuth()
  const toast = useToast()
  const [mo, setMo] = useState(false)
  const [tin, setTin] = useState('')
  const [dangSoan, setDangSoan] = useState(false)
  const xong = v.trangThai === 'xong'
  const quaHan = !xong && v.hanLuc < bayGio

  const soan = async () => {
    setDangSoan(true)
    try {
      setTin(await soanTinFollowUp(v, user?.hoTen))
    } catch (e) {
      toast('Maika chưa soạn được: ' + (e.message || e), 'error')
    } finally {
      setDangSoan(false)
    }
  }
  const chep = async () => {
    try {
      await navigator.clipboard.writeText(tin)
      toast('Đã chép tin nhắn — dán vào Zalo/SMS gửi khách', 'success')
    } catch {
      toast('Không chép được — giữ để chọn & chép thủ công', 'error')
    }
  }
  const hanMai9h = () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
    return d.getTime()
  }

  return (
    <div className={`${xong ? 'opacity-50' : ''}`}>
      <button onClick={() => setMo((x) => !x)} className="tap flex w-full items-center gap-3 p-3 text-left">
        <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg ${quaHan ? 'bg-brand-100' : 'bg-brand-50'}`}>
          {xong ? '✅' : LOAI_VIEC[v.loai]?.icon || '📝'}
        </span>
        <div className="min-w-0 flex-1">
          <div className={`truncate text-sm font-bold ${xong ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{v.tieuDe}</div>
          <div className="truncate text-[11px] text-gray-500">{[v.khach, v.sanPham].filter(Boolean).join(' · ') || LOAI_VIEC[v.loai]?.nhan}</div>
        </div>
        <div className={`flex-shrink-0 text-right text-[11px] font-semibold ${quaHan ? 'text-brand-600' : 'text-gray-500'}`}>
          {quaHan && <div className="text-[9px] font-black uppercase">Quá hạn</div>}
          {nhanThoiGian(v.hanLuc)}
        </div>
      </button>

      {mo && (
        <div className="space-y-2 bg-gray-50 px-3 pb-3 pt-1">
          {v.ghiChu && <p className="text-[11px] text-gray-600">📝 {v.ghiChu}</p>}
          <div className="flex flex-wrap gap-1.5">
            {xong ? (
              <button onClick={() => moLaiViec(v)} className="tap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">↩ Mở lại</button>
            ) : (
              <>
                <button onClick={() => xongViec(v).then(() => toast('Đã xong 👍', 'success'))} className="tap rounded-lg bg-green-600 px-2.5 py-1.5 text-[11px] font-bold text-white">✓ Xong</button>
                <button onClick={() => doiHan(v, { phut: 60 }).then(() => toast('Đã dời 1 giờ', 'info'))} className="tap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">⏰ +1 giờ</button>
                <button onClick={() => doiHan(v, { luc: hanMai9h() }).then(() => toast('Đã dời sang 9:00 mai', 'info'))} className="tap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">📅 Mai 9h</button>
                {aiCoCauHinh() && (
                  <button onClick={soan} disabled={dangSoan} className="tap rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1.5 text-[11px] font-bold text-brand-700 disabled:opacity-50">
                    {dangSoan ? '✍️ Đang soạn…' : '✍️ Maika soạn tin'}
                  </button>
                )}
                {v.sdt && (
                  <a href={`tel:${v.sdt.replace(/\s/g, '')}`} className="tap rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-gray-700">📞 {v.sdt}</a>
                )}
              </>
            )}
            <button onClick={() => huyNhac(v).then(() => xoaViec(v.id))} className="tap rounded-lg px-2 py-1.5 text-[11px] font-semibold text-red-500">Xoá</button>
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

// ============================================================
//  DANH SÁCH VIỆC (Màn 1) — mặc định: quá hạn + hôm nay + 2 ngày tới
// ============================================================
export function DanhSachViec({ onThem }) {
  const { ds, bayGio } = useViec()
  const [tatCa, setTatCa] = useState(false)
  const gioiHan = bayGio + 2 * 864e5
  const hien = tatCa ? ds : ds.filter((v) => v.trangThai === 'cho' && v.hanLuc < gioiHan)
  const soXong = ds.filter((v) => v.trangThai === 'xong').length

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-black text-gray-900">Việc cần làm</h3>
        <button onClick={() => setTatCa((x) => !x)} className="text-xs font-semibold text-brand-600">
          {tatCa ? 'Thu gọn' : `Xem tất cả (${ds.length}) ›`}
        </button>
      </div>
      {hien.length === 0 ? (
        <button onClick={() => onThem('viec')} className="tap w-full rounded-2xl border border-dashed border-gray-200 bg-white p-5 text-center text-xs text-gray-400">
          {ds.length ? `Không có việc gấp${soXong ? ` · đã xong ${soXong} việc` : ''}. ` : ''}Chạm để thêm việc / lịch hẹn.
        </button>
      ) : (
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white">
          {hien.map((v) => (
            <DongViec key={v.id} v={v} bayGio={bayGio} />
          ))}
        </div>
      )}
    </div>
  )
}

// ============================================================
//  FORM THÊM VIỆC / BÁO GIÁ VỪA GỬI
// ============================================================
const MOC_NHANH = [
  { nhan: 'Hôm nay 17h', tinh: () => { const d = new Date(); d.setHours(17, 0, 0, 0); return d } },
  { nhan: 'Mai 9h', tinh: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d } },
  { nhan: '3 ngày', tinh: () => { const d = new Date(); d.setDate(d.getDate() + 3); d.setHours(9, 0, 0, 0); return d } },
  { nhan: '1 tuần', tinh: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d } },
]

const sangInput = (d) => {
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function ThemViecSheet({ cheDo = 'viec', onClose }) {
  const { user } = useAuth()
  const toast = useToast()
  const laBaoGia = cheDo === 'baogia'
  const [f, setF] = useState({ loai: laBaoGia ? 'baogia' : 'goi', tieuDe: '', khach: '', sdt: '', sanPham: '', ghiChu: '', giaTri: '', soNgay: 2 })
  const [han, setHan] = useState(() => sangInput(MOC_NHANH[1].tinh()))
  const [dang, setDang] = useState(false)
  const dat = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const luu = async () => {
    if (dang) return
    if (laBaoGia ? !f.khach.trim() : !f.tieuDe.trim()) return toast(laBaoGia ? 'Nhập tên khách' : 'Nhập nội dung việc', 'error')
    setDang(true)
    try {
      const v = laBaoGia
        ? await taoFollowUpBaoGia({ khach: f.khach.trim(), sdt: f.sdt.trim(), sanPham: f.sanPham.trim(), giaTri: f.giaTri.trim(), soNgay: Number(f.soNgay) || 2, nguoiTao: user.id })
        : await taoViec({ loai: f.loai, tieuDe: f.tieuDe.trim(), khach: f.khach.trim(), sdt: f.sdt.trim(), sanPham: f.sanPham.trim(), ghiChu: f.ghiChu.trim(), hanLuc: new Date(han).getTime(), nguoiTao: user.id })
      toast(`Maika sẽ nhắc: ${nhanThoiGian(v.hanLuc)}`, 'success')
      onClose()
    } catch (e) {
      toast('Lưu lỗi: ' + (e.message || e), 'error')
      setDang(false)
    }
  }

  const o = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white'
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={onClose}>
      <div className="anim-sheet max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 text-lg font-black text-gray-900">{laBaoGia ? '📑 Vừa gửi báo giá' : '+ Việc mới'}</div>
        <p className="mb-4 text-xs text-gray-500">
          {laBaoGia ? 'Maika tự tạo lịch follow-up và nhắc bạn đúng hạn.' : 'Maika nhắc bằng thông báo đúng giờ (Android nhắc cả khi đã tắt app).'}
        </p>
        <div className="space-y-2.5">
          {!laBaoGia && (
            <>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(LOAI_VIEC).filter(([k]) => k !== 'baogia').map(([k, l]) => (
                  <button key={k} onClick={() => setF((x) => ({ ...x, loai: k }))}
                    className={`tap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${f.loai === k ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                    {l.icon} {l.nhan}
                  </button>
                ))}
              </div>
              <input value={f.tieuDe} onChange={dat('tieuDe')} placeholder="Việc cần làm (vd: Gọi lại báo giá chống thấm)" className={o} autoFocus />
            </>
          )}
          <input value={f.khach} onChange={dat('khach')} placeholder={laBaoGia ? 'Tên khách *' : 'Khách hàng'} className={o} autoFocus={laBaoGia} />
          <div className="flex gap-2">
            <input value={f.sdt} onChange={dat('sdt')} placeholder="SĐT" inputMode="tel" className={o} />
            <input value={f.sanPham} onChange={dat('sanPham')} placeholder="Sản phẩm" className={o} />
          </div>
          {laBaoGia ? (
            <>
              <input value={f.giaTri} onChange={dat('giaTri')} placeholder="Giá trị báo giá (vd: 12.500.000đ)" className={o} />
              <div>
                <div className="mb-1 text-[11px] font-semibold text-gray-500">Follow-up sau</div>
                <div className="flex gap-1.5">
                  {[1, 2, 3, 5, 7].map((n) => (
                    <button key={n} onClick={() => setF((x) => ({ ...x, soNgay: n }))}
                      className={`tap flex-1 rounded-lg border py-2 text-xs font-bold ${Number(f.soNgay) === n ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                      {n} ngày
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <textarea value={f.ghiChu} onChange={dat('ghiChu')} rows={2} placeholder="Ghi chú" className={o + ' resize-none'} />
              <div>
                <div className="mb-1 text-[11px] font-semibold text-gray-500">Nhắc lúc</div>
                <div className="mb-1.5 flex gap-1.5">
                  {MOC_NHANH.map((m) => (
                    <button key={m.nhan} onClick={() => setHan(sangInput(m.tinh()))} className="tap flex-1 rounded-lg border border-gray-200 py-1.5 text-[11px] font-semibold text-gray-600">{m.nhan}</button>
                  ))}
                </div>
                <input type="datetime-local" value={han} onChange={(e) => setHan(e.target.value)} className={o} />
              </div>
            </>
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button onClick={onClose} className="tap rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold text-gray-600">Huỷ</button>
          <button onClick={luu} disabled={dang} className="tap flex-1 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60">
            {dang ? 'Đang lưu…' : laBaoGia ? 'Lưu & hẹn follow-up' : 'Lưu & nhắc'}
          </button>
        </div>
      </div>
    </div>
  )
}
