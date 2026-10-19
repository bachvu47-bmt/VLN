import { useCallback, useEffect, useMemo, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import BieuDo, { TheSo } from '../components/BieuDo'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { layViec } from '../data/viecStore'
import { aiCoCauHinh } from '../services/maikaChatbot'
import { taoViec } from '../services/troLyChuDong'
import {
  canFollowUp,
  coNguonBaoCao,
  danhSachNhanVien,
  datNguon,
  dauNgay,
  hoiBaoCao,
  layBaoCaoCache,
  loc,
  nhomTheo,
  taiBaoCao,
  theoThoiGian,
  tongHop,
  topSanPham,
  vnd,
  vndDay,
} from '../services/baoCaoSheets'

const KHOANG = [
  { id: '7', nhan: '7 ngày', tinh: (n) => [dauNgay(n) - 6 * 864e5, dauNgay(n) + 864e5] },
  { id: '30', nhan: '30 ngày', tinh: (n) => [dauNgay(n) - 29 * 864e5, dauNgay(n) + 864e5] },
  { id: 'thang', nhan: 'Tháng này', tinh: (n) => { const d = new Date(n); return [new Date(d.getFullYear(), d.getMonth(), 1).getTime(), dauNgay(n) + 864e5] } },
  { id: 'thangTruoc', nhan: 'Tháng trước', tinh: (n) => { const d = new Date(n); return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), new Date(d.getFullYear(), d.getMonth(), 1).getTime()] } },
  { id: 'all', nhan: 'Tất cả', tinh: (n, rows) => [Math.min(...rows.map((r) => r.thoiGian)), dauNgay(n) + 864e5] },
]

// Mốc nhắc follow-up: rải 15 phút/khách từ giờ tới (sau 17h → sáng mai 9h)
function mocNhac(i, bayGio) {
  const d = new Date(bayGio)
  if (d.getHours() >= 17) {
    d.setDate(d.getDate() + 1)
    d.setHours(9, 0, 0, 0)
  } else d.setMinutes(d.getMinutes() + 10)
  return d.getTime() + i * 15 * 60000
}

function CauHinhNguon({ onXong }) {
  const toast = useToast()
  const [link, setLink] = useState('')
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-4">
      <div className="mb-1 text-sm font-black text-gray-900">Kết nối Google Sheet báo cáo</div>
      <p className="mb-3 text-xs text-gray-500">Dán link Google Sheet "Báo cáo bán hàng ngày". Sheet cần chia sẻ: Bất kỳ ai có link · <b>Người xem</b>.</p>
      <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..." className="mb-2 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs outline-none focus:border-brand-500" />
      <button onClick={() => { if (!/\/d\/[\w-]{20,}/.test(link)) return toast('Link Google Sheet không hợp lệ', 'error'); datNguon(link); onXong() }}
        className="tap w-full rounded-xl bg-brand-600 py-2.5 text-sm font-bold text-white">Kết nối</button>
    </div>
  )
}

function HoiMaika({ coDuLieu }) {
  const toast = useToast()
  const [cau, setCau] = useState('')
  const [dang, setDang] = useState(false)
  const [kq, setKq] = useState(null)
  if (!aiCoCauHinh() || !coDuLieu) return null
  const hoi = async (q) => {
    const c = (q ?? cau).trim()
    if (!c || dang) return
    setDang(true)
    setCau(c)
    try {
      setKq(await hoiBaoCao(c))
    } catch (e) {
      toast('Maika chưa trả lời được: ' + (e.message || e), 'error')
    } finally {
      setDang(false)
    }
  }
  return (
    <div className="rounded-2xl border border-brand-100 bg-brand-50 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-black text-gray-900">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">M</span> Hỏi Maika về số liệu
      </div>
      <div className="mb-2 flex gap-2">
        <input value={cau} onChange={(e) => setCau(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && hoi()}
          placeholder="vd: Doanh thu tháng 9 theo tuần?" className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs outline-none focus:border-brand-500" />
        <button onClick={() => hoi()} disabled={dang || !cau.trim()} className="tap rounded-xl bg-brand-600 px-3 text-xs font-bold text-white disabled:opacity-50">{dang ? '…' : 'Hỏi'}</button>
      </div>
      {!kq && (
        <div className="flex flex-wrap gap-1.5">
          {['Doanh thu tháng này theo tuần', 'Sản phẩm khách hỏi nhiều nhất tháng này', 'Kênh nào mang nhiều khách nhất?'].map((g) => (
            <button key={g} onClick={() => hoi(g)} className="tap rounded-full border border-brand-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-brand-700">{g}</button>
          ))}
        </div>
      )}
      {kq && (
        <div className="space-y-2">
          <div className="whitespace-pre-line rounded-xl bg-white p-3 text-xs leading-relaxed text-gray-800">{kq.text}</div>
          {kq.bieuDo && <BieuDo {...kq.bieuDo} />}
        </div>
      )}
    </div>
  )
}

export default function BaoCaoScreen({ onClose }) {
  const { user } = useAuth()
  const toast = useToast()
  const [du, setDu] = useState(null) // { luc, rows, loiMang? }
  const [loi, setLoi] = useState('')
  const [coNguon, setCoNguon] = useState(coNguonBaoCao())
  const [dang, setDang] = useState(coNguon)
  const [khoang, setKhoang] = useState('30')
  const [nv, setNv] = useState('')
  const [bayGio] = useState(() => Date.now())
  const [daNhac, setDaNhac] = useState(() => new Set())

  const napDuLieu = useCallback(async (batBuoc) => {
    try {
      setDu(await taiBaoCao({ batBuoc }))
      setLoi('')
    } catch (e) {
      setLoi(e.message || String(e))
    } finally {
      setDang(false)
    }
  }, [])
  const tai = (batBuoc) => {
    setDang(true)
    napDuLieu(batBuoc)
  }

  useEffect(() => {
    if (!coNguon) return
    let huy = false
    layBaoCaoCache().then((c) => !huy && c && setDu((x) => x || c)) // hiện bản cache ngay, rồi làm mới
    taiBaoCao()
      .then((d) => {
        if (huy) return
        setDu(d)
        setLoi('')
      })
      .catch((e) => !huy && setLoi(e.message || String(e)))
      .finally(() => !huy && setDang(false))
    return () => {
      huy = true
    }
  }, [coNguon])

  const rows = useMemo(() => du?.rows || [], [du])
  const [tu, den] = rows.length ? KHOANG.find((k) => k.id === khoang).tinh(bayGio, rows) : [0, 0]
  const ds = useMemo(() => loc(rows, { tu, den, nhanVien: nv || undefined }), [rows, tu, den, nv])
  const th = tongHop(ds)
  const nvs = danhSachNhanVien(rows)
  const soNgay = (den - tu) / 864e5
  const buoc = soNgay > 120 ? 'thang' : soNgay > 31 ? 'tuan' : 'ngay'
  const fu = useMemo(() => canFollowUp(rows, { nhanVien: nv || undefined }), [rows, nv])
  const moiNhat = rows.length ? Math.max(...rows.map((r) => r.thoiGian)) : 0

  // Tạo việc follow-up trong Trợ lý chủ động (bỏ qua khách đã có nhắc đang chờ)
  const taoNhac = async (dsKhach) => {
    const dangCho = new Set(layViec(user.id).filter((v) => v.trangThai === 'cho' && v.loai === 'baogia').map((v) => v.khach.toLowerCase()))
    const moi = dsKhach.filter((r) => !dangCho.has((r.khach || r.sdt).toLowerCase()))
    for (const [i, r] of moi.entries()) {
      await taoViec({
        loai: 'baogia',
        tieuDe: `Follow-up ${r.khach || r.sdt} — ${r.sanPham.slice(0, 40)}`,
        khach: r.khach || r.sdt,
        sdt: r.sdt,
        sanPham: r.sanPham,
        ghiChu: [`${r.soNgayIm} ngày chưa liên hệ`, r.lyDo && `Lý do: ${r.lyDo}`, `NV: ${r.nhanVien}`].filter(Boolean).join(' · '),
        hanLuc: mocNhac(i, Date.now()),
        nguon: 'baogia',
        nguoiTao: user.id,
      })
    }
    setDaNhac((s) => new Set([...s, ...dsKhach.map((r) => r.khach || r.sdt)]))
    toast(moi.length ? `Đã tạo ${moi.length} nhắc follow-up — xem ở màn Hôm nay` : 'Các khách này đã có nhắc follow-up', 'success')
  }

  const right = coNguon && (
    <button onClick={() => tai(true)} disabled={dang} className="tap rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-bold text-gray-600 disabled:opacity-50">
      {dang ? '⏳' : '↻ Làm mới'}
    </button>
  )

  return (
    <ScreenShell title="Báo cáo bán hàng" onClose={onClose} right={right}>
      {!coNguon ? (
        <CauHinhNguon onXong={() => { setDang(true); setCoNguon(true) }} />
      ) : (
        <div className="space-y-4">
          <p className="text-[11px] text-gray-500">
            {du ? `Google Sheet · cập nhật ${new Date(du.luc).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} · dữ liệu đến ${new Date(moiNhat).toLocaleDateString('vi-VN')} · ${rows.length} dòng` : dang ? 'Đang tải dữ liệu từ Google Sheet…' : ''}
            {du?.loiMang && <span className="text-amber-600"> · đang dùng bản lưu (mất mạng)</span>}
          </p>
          {loi && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{loi}</div>}

          {rows.length > 0 && (
            <>
              {/* Bộ lọc — 1 hàng phía trên biểu đồ */}
              <div className="flex flex-wrap items-center gap-1.5">
                {KHOANG.map((k) => (
                  <button key={k.id} onClick={() => setKhoang(k.id)}
                    className={`tap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${khoang === k.id ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600'}`}>
                    {k.nhan}
                  </button>
                ))}
                {nvs.length > 1 && (
                  <select value={nv} onChange={(e) => setNv(e.target.value)} className="rounded-full border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-600 outline-none">
                    <option value="">Mọi nhân viên</option>
                    {nvs.map((x) => <option key={x} value={x}>{x}</option>)}
                  </select>
                )}
              </div>

              {ds.length === 0 ? (
                <div className="rounded-2xl bg-white p-6 text-center text-xs text-gray-500">
                  Không có dữ liệu trong khoảng này. <button onClick={() => setKhoang('all')} className="font-bold text-brand-600 underline">Xem tất cả</button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <TheSo nhan="Doanh thu" giaTri={vnd(th.doanhThu)} phu={`${th.soDon} đơn · ${vndDay(th.doanhThu)}`} />
                    <TheSo nhan="Tỷ lệ chốt" giaTri={`${Math.round(th.tyLeChot * 100)}%`} phu={`${th.soKhachChot}/${th.soKhach} khách`} />
                    <TheSo nhan="Lượt tư vấn" giaTri={th.soLuot.toLocaleString('vi-VN')} phu={`${th.soKhach} khách`} />
                    <TheSo nhan="Báo giá đang chờ" giaTri={th.soBaoGiaCho} phu={th.congNo ? `Công nợ ${vnd(th.congNo)}` : 'khách đang xem xét'} />
                  </div>

                  <BieuDo kieu="cot" tieuDe={`Doanh thu theo ${buoc === 'ngay' ? 'ngày' : buoc === 'tuan' ? 'tuần' : 'tháng'}`} diem={theoThoiGian(ds, tu, den, buoc)} donVi="vnd" />
                  {!nv && danhSachNhanVien(ds).length > 1 && <BieuDo kieu="ngang" tieuDe="Doanh thu theo nhân viên" diem={nhomTheo(ds, 'nhanVien')} donVi="vnd" />}
                  <BieuDo kieu="ngang" tieuDe="Số khách theo kênh" diem={nhomTheo(ds, 'kenh', 'soKhach').slice(0, 6)} />
                  <BieuDo kieu="ngang" tieuDe="Tình trạng khách" diem={nhomTheo(ds, 'tinhTrang', 'soKhach')} />
                  <BieuDo kieu="ngang" tieuDe="Sản phẩm khách hỏi nhiều nhất (lượt)" diem={topSanPham(ds, 8)} />
                </>
              )}

              <HoiMaika coDuLieu={rows.length > 0} />

              {/* Báo giá cần follow-up → Trợ lý chủ động */}
              <div className="rounded-2xl border border-gray-100 bg-white p-3">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-black text-gray-900">🔔 Báo giá cần follow-up</span>
                  <span className="text-[11px] text-gray-500">{fu.length} khách</span>
                </div>
                <p className="mb-2 text-[11px] text-gray-500">
                  Đang chờ báo giá / tư vấn, 3–30 ngày chưa liên hệ lại{fu.soNguoi ? ` · thêm ${fu.soNguoi} khách im lặng > 30 ngày` : ''}. Gần nhất ở trên — còn "nóng", dễ chốt hơn.
                </p>
                {fu.length > 0 && (
                  <button onClick={() => taoNhac(fu.slice(0, 10))} className="tap mb-2 w-full rounded-xl bg-brand-600 py-2.5 text-xs font-bold text-white">
                    ⏰ Tạo nhắc follow-up cho {Math.min(10, fu.length)} khách gần nhất
                  </button>
                )}
                <div className="divide-y divide-gray-100">
                  {fu.slice(0, 15).map((r) => {
                    const ten = r.khach || r.sdt
                    return (
                      <div key={ten + r.lienHe} className="flex items-center gap-2 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-bold text-gray-900">{ten} <span className="font-normal text-gray-400">· {r.nhanVien}</span></div>
                          <div className="truncate text-[11px] text-gray-500">{r.sanPham}</div>
                          {r.lyDo && <div className="truncate text-[10px] italic text-gray-400">{r.lyDo}</div>}
                        </div>
                        <span className="flex-shrink-0 text-[10px] font-semibold text-gray-500">{r.soNgayIm} ngày</span>
                        <button onClick={() => taoNhac([r])} disabled={daNhac.has(ten)}
                          className={`tap flex-shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold ${daNhac.has(ten) ? 'bg-green-50 text-green-700' : 'border border-brand-200 text-brand-700'}`}>
                          {daNhac.has(ten) ? '✓' : 'Nhắc'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>

              <button onClick={() => { setCoNguon(false); setDu(null) }} className="w-full text-center text-[10px] text-gray-400 underline">
                Đổi Google Sheet nguồn
              </button>
            </>
          )}
        </div>
      )}
    </ScreenShell>
  )
}
