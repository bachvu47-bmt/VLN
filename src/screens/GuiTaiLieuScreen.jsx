import { useEffect, useMemo, useRef, useState } from 'react'
import AnhSanPham from '../components/AnhSanPham'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { chiaSeChoKhach, TOI_DA_MB } from '../services/chiaSe'
import { goiYTaiLieu, kiemTraLinkThuongHieu, linkThuongHieu, nhanDienSanPham, nhanLoai, soanTinNhan, theTuLink } from '../services/goiYTaiLieu'
import { timKhach } from '../services/kiotViet'
import { aiCoCauHinh, aiNhanh } from '../services/maikaChatbot'

// ============================================================
//  GỬI TÀI LIỆU CHO KHÁCH — khung chat kiểu Gemini
//  Sales gõ sản phẩm khách đang hỏi → Maika gợi ý tài liệu thật (Smart Cards) → chạm 1 lần để đính kèm
//  (+) đính kèm ảnh/video/PDF/DOCX từ máy hoặc camera → Gửi: mở Zalo (bảng chia sẻ) kèm tin + tệp
// ============================================================

const RE_LINK = /^https?:\/\/\S+$/i

function TheGoiY({ t, chon, onChon }) {
  const moNgoai = t.dinhKem === false
  return (
    <button
      onClick={() => (moNgoai ? window.open(t.url, '_blank', 'noopener') : onChon(t))}
      className={`tap flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition ${
        chon ? 'border-brand-500 bg-brand-50' : moNgoai ? 'border-dashed border-gray-200 bg-white' : 'border-gray-100 bg-white'
      }`}
    >
      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-base">{nhanLoai(t.loai).split(' ')[0]}</span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-bold text-gray-900">{t.ten}</div>
        <div className="truncate text-[10px] text-gray-500">{moNgoai ? t.nguon : `${nhanLoai(t.loai).replace(/^\S+\s/, '')} · ${t.nguon}`}</div>
      </div>
      {moNgoai ? (
        <span className="flex-shrink-0 text-[10px] font-semibold text-brand-600">Mở ›</span>
      ) : (
        <span className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${chon ? 'border-brand-600 bg-brand-600 text-white' : 'border-gray-300'}`}>
          {chon && <span className="text-[11px]">✓</span>}
        </span>
      )}
    </button>
  )
}

function BongMaika({ m, dinhKem, onChon }) {
  return (
    <div className="flex gap-2">
      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-black text-white">M</span>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="rounded-2xl rounded-tl-sm bg-white px-3 py-2 text-sm text-gray-800 shadow-sm">{m.text}</div>
        {m.sps?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {m.sps.map((sp) => (
              <div key={sp.id} className="flex w-44 flex-shrink-0 items-center gap-2 rounded-xl border border-gray-100 bg-white p-2">
                <AnhSanPham sp={sp} co="nho" />
                <div className="min-w-0 text-[11px] font-bold leading-tight text-gray-800">{sp.ten}</div>
              </div>
            ))}
          </div>
        )}
        {m.the?.length > 0 && (
          <div className="space-y-1.5">
            {m.the.map((t) => <TheGoiY key={t.id} t={t} chon={dinhKem.has(t.id)} onChon={onChon} />)}
          </div>
        )}
      </div>
    </div>
  )
}

// Bảng gửi: tên khách · link thương hiệu · xem trước tin nhắn · kênh gửi
function BangGui({ the, tep, onDong, onXong }) {
  const { user, laAdmin } = useAuth()
  const toast = useToast()
  const [khach, setKhach] = useState('')
  const [loiDau, setLoiDau] = useState('')
  const [dungLink, setDungLink] = useState(false)
  const [coLink, setCoLink] = useState(null)
  const [suaTay, setSuaTay] = useState(null) // tin nhắn sales tự sửa
  const [dangViet, setDangViet] = useState(false)
  const [dangGui, setDangGui] = useState(false)

  useEffect(() => {
    kiemTraLinkThuongHieu().then(setCoLink)
  }, [])
  const goiYKhach = laAdmin && khach.trim().length >= 2 ? timKhach(khach, 5) : [] // khách KiotViet: chỉ Admin
  const coTheRutGon = the.some((t) => linkThuongHieu(t))
  const tinTuDong = soanTinNhan({ khach, loiDau, the, tep, dungLinkThuongHieu: dungLink && coLink, kyTen: user?.hoTen })
  const tin = suaTay ?? tinTuDong

  const vietLoiChao = async () => {
    setDangViet(true)
    try {
      const sp = [...new Set(the.map((t) => t.sp?.ten).filter(Boolean))].join(', ')
      const kq = await aiNhanh(
        'Bạn là nhân viên bán hàng của cửa hàng vật liệu xây dựng "Vật Liệu Nhà". Viết 1–2 câu mở đầu tin nhắn Zalo gửi tài liệu cho khách: lịch sự, ấm áp, xưng "em", gọi "anh/chị" (hoặc tên khách). KHÔNG chèn link, KHÔNG bịa giá/khuyến mãi, không markdown. Chỉ trả về câu mở đầu.',
        `Khách: ${khach || 'chưa rõ tên'}. Sản phẩm: ${sp || 'vật liệu xây dựng'}. Tài liệu gửi: ${the.map((t) => nhanLoai(t.loai).replace(/^\S+\s/, '')).join(', ') || 'tệp đính kèm'}.`,
      )
      setLoiDau(kq.replace(/\*\*/g, '').trim())
      setSuaTay(null)
    } catch (e) {
      toast('Maika chưa viết được: ' + (e.message || e), 'error')
    } finally {
      setDangViet(false)
    }
  }

  const gui = async () => {
    setDangGui(true)
    try {
      const kq = await chiaSeChoKhach({ text: tin, tep })
      if (kq === 'da-chep') toast('Máy này không mở được bảng chia sẻ — đã chép tin nhắn, mở Zalo và dán cho khách', 'success')
      if (kq === 'da-mo') toast('Đã mở bảng chia sẻ — chọn Zalo và khách cần gửi', 'success')
      if (kq !== 'huy') onXong()
    } catch (e) {
      toast(e.message || String(e), 'error')
    } finally {
      setDangGui(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-md flex-col justify-end bg-black/40" onClick={onDong}>
      <div className="max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-4" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-200" />
        <div className="mb-3 text-base font-black text-gray-900">Gửi {the.length + tep.length} tài liệu cho khách</div>

        <label className="mb-1 block text-[11px] font-semibold text-gray-600">Tên khách (tuỳ chọn)</label>
        <input value={khach} onChange={(e) => { setKhach(e.target.value); setSuaTay(null) }} placeholder="vd: anh Tuấn"
          className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:bg-white" />
        {goiYKhach.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {goiYKhach.map((c) => (
              <button key={c.ma} onClick={() => { setKhach(c.ten); setSuaTay(null) }} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-700">{c.ten}</button>
            ))}
          </div>
        )}

        {coTheRutGon && (
          <label className={`mt-3 flex items-start gap-2 rounded-xl border p-2.5 ${coLink ? 'border-gray-100' : 'border-dashed border-gray-200 opacity-70'}`}>
            <input type="checkbox" disabled={!coLink} checked={dungLink && !!coLink} onChange={(e) => { setDungLink(e.target.checked); setSuaTay(null) }} className="mt-0.5" />
            <span className="text-[11px] text-gray-600">
              <b className="text-gray-800">Link rút gọn thương hiệu</b> — vatlieunha.vn/tai-lieu/…
              {coLink === false && <span className="block text-gray-400">Website chưa cài plugin link tài liệu (web/vln-tai-lieu.php) — đang gửi link gốc.</span>}
            </span>
          </label>
        )}

        <div className="mb-1 mt-3 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-gray-600">Tin nhắn gửi khách</span>
          {aiCoCauHinh() && (
            <button onClick={vietLoiChao} disabled={dangViet} className="text-[11px] font-semibold text-brand-600 disabled:opacity-50">
              {dangViet ? 'Maika đang viết…' : '✨ Maika viết lời chào'}
            </button>
          )}
        </div>
        <textarea value={tin} onChange={(e) => setSuaTay(e.target.value)} rows={8}
          className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs leading-relaxed outline-none focus:border-brand-500" />

        <button onClick={gui} disabled={dangGui} className="tap mt-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-50">
          {dangGui ? 'Đang chuẩn bị…' : `💬 Gửi qua Zalo${tep.length ? ` (kèm ${tep.length} tệp)` : ''}`}
        </button>
        <button onClick={() => navigator.clipboard.writeText(tin).then(() => toast('Đã chép tin nhắn', 'success'))}
          className="tap mt-2 w-full rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700">
          📋 Chỉ sao chép tin nhắn
        </button>
        <div className="mt-3 rounded-xl bg-gray-50 p-2.5 text-[10px] leading-relaxed text-gray-500">
          <b className="text-gray-700">Zalo OA:</b> chưa kết nối (đang chờ App ID của OA). Khi nối xong, OA chỉ nhắn được cho khách đã nhắn/quan tâm OA trong 48 giờ — khách mới vẫn gửi qua Zalo của nhân viên như nút trên.
        </div>
      </div>
    </div>
  )
}

export default function GuiTaiLieuScreen({ onClose, data }) {
  const toast = useToast()
  const [tinNhan, setTinNhan] = useState([])
  const [nhap, setNhap] = useState('')
  const [dinhKem, setDinhKem] = useState(new Map()) // id → thẻ tài liệu
  const [tep, setTep] = useState([]) // File từ máy / camera
  const [moCong, setMoCong] = useState(false)
  const [moGui, setMoGui] = useState(false)
  const cuon = useRef(null)
  const oAnh = useRef(null)
  const oCamera = useRef(null)
  const oTep = useRef(null)

  const traLoi = (cau, spsSan) => {
    const sps = spsSan || nhanDienSanPham(cau)
    const the = goiYTaiLieu(sps)
    const soDinhKem = the.filter((t) => t.dinhKem).length
    const text = !sps.length
      ? 'Mình chưa nhận ra sản phẩm trong câu này. Anh/chị gõ tên cụ thể hơn nhé (vd "Maxbond 1211", "Sika Latex TH", "Neoproof PU W"), hoặc dán link tài liệu / bấm (+) để đính kèm tệp.'
      : soDinhKem
        ? `Mình tìm được ${soDinhKem} tài liệu cho ${sps.map((s) => s.ten).join(', ')}. Chạm để đính kèm:`
        : `${sps.map((s) => s.ten).join(', ')} chưa có tài liệu trên vatlieunha.vn. Anh/chị bấm (+) để đính kèm tệp từ máy, hoặc tìm clip bên dưới:`
    setTinNhan((ds) => [...ds, { tu: 'maika', text, sps, the }])
  }

  // Mở từ hồ sơ sản phẩm ("Tạo bộ tài liệu") → Maika gợi ý ngay cho sản phẩm đó
  useEffect(() => {
    if (data?.sp) {
      setTinNhan([{ tu: 'user', text: data.sp.ten }])
      traLoi('', [data.sp])
    } else {
      setTinNhan([{ tu: 'maika', text: 'Khách đang hỏi sản phẩm nào? Gõ tên (vd "Maxbond 1211", "Sika Latex") — mình gợi ý hướng dẫn thi công, TDS, video và trang thông số để gửi khách.' }])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ chạy khi mở màn
  }, [])
  useEffect(() => {
    cuon.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) // ScreenShell là khung cuộn
  }, [tinNhan])

  const gui = () => {
    const cau = nhap.trim()
    if (!cau) return
    setNhap('')
    setTinNhan((ds) => [...ds, { tu: 'user', text: cau }])
    if (RE_LINK.test(cau)) {
      const t = theTuLink(cau)
      if (t) {
        setDinhKem((m) => new Map(m).set(t.id, t))
        setTinNhan((ds) => [...ds, { tu: 'maika', text: 'Đã đính kèm link này:', the: [t] }])
        return
      }
    }
    traLoi(cau)
  }

  const chonThe = (t) =>
    setDinhKem((m) => {
      const moi = new Map(m)
      if (moi.has(t.id)) moi.delete(t.id)
      else moi.set(t.id, t)
      return moi
    })

  const themTep = (e) => {
    const ds = [...(e.target.files || [])]
    e.target.value = ''
    setMoCong(false)
    const lon = ds.filter((f) => f.size > TOI_DA_MB * 1024 * 1024)
    if (lon.length) toast(`Bỏ ${lon.length} tệp > ${TOI_DA_MB}MB — gửi link thay vì tệp`, 'error')
    setTep((cu) => [...cu, ...ds.filter((f) => f.size <= TOI_DA_MB * 1024 * 1024)])
  }

  const anhXemTruoc = useMemo(() => tep.map((f) => (f.type.startsWith('image/') ? URL.createObjectURL(f) : '')), [tep])
  useEffect(() => () => anhXemTruoc.forEach((u) => u && URL.revokeObjectURL(u)), [anhXemTruoc])

  const theChon = [...dinhKem.values()]
  const tong = theChon.length + tep.length

  const footer = (
    <div>
      {/* Khay đính kèm */}
      {tong > 0 && (
        <div className="mb-2 flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
            {theChon.map((t) => (
              <span key={t.id} className="flex max-w-[160px] flex-shrink-0 items-center gap-1 rounded-full bg-brand-50 py-1 pl-2 pr-1 text-[10px] font-semibold text-brand-700">
                <span className="truncate">{nhanLoai(t.loai).split(' ')[0]} {t.sp?.ten || t.ten}</span>
                <button onClick={() => chonThe(t)} className="px-1 text-brand-400">✕</button>
              </span>
            ))}
            {tep.map((f, i) => (
              <span key={i} className="flex max-w-[160px] flex-shrink-0 items-center gap-1 rounded-full bg-gray-100 py-1 pl-1 pr-1 text-[10px] font-semibold text-gray-700">
                {anhXemTruoc[i] ? <img src={anhXemTruoc[i]} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="pl-1">{f.type.startsWith('video/') ? '🎬' : '📎'}</span>}
                <span className="truncate">{f.name}</span>
                <button onClick={() => setTep((ds) => ds.filter((_, j) => j !== i))} className="px-1 text-gray-400">✕</button>
              </span>
            ))}
          </div>
          <button onClick={() => setMoGui(true)} className="tap flex-shrink-0 rounded-full bg-brand-600 px-3.5 py-2 text-xs font-bold text-white">Gửi ({tong}) ›</button>
        </div>
      )}

      {/* Menu (+) */}
      {moCong && (
        <div className="mb-2 grid grid-cols-3 gap-2">
          {[
            ['📷', 'Chụp ảnh', oCamera],
            ['🖼️', 'Ảnh / Video', oAnh],
            ['📄', 'PDF / Word', oTep],
          ].map(([ic, ten, ref]) => (
            <button key={ten} onClick={() => ref.current?.click()} className="tap flex flex-col items-center gap-1 rounded-xl border border-gray-100 bg-gray-50 py-3 text-[11px] font-semibold text-gray-700">
              <span className="text-xl">{ic}</span>
              {ten}
            </button>
          ))}
        </div>
      )}
      <input ref={oCamera} type="file" accept="image/*" capture="environment" className="hidden" onChange={themTep} />
      <input ref={oAnh} type="file" accept="image/*,video/*" multiple className="hidden" onChange={themTep} />
      <input ref={oTep} type="file" multiple className="hidden" onChange={themTep}
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" />

      {/* Khung nhập kiểu Gemini */}
      <div className="flex items-end gap-1.5 rounded-3xl border border-gray-200 bg-gray-50 px-1.5 py-1.5 focus-within:border-brand-400 focus-within:bg-white">
        <button onClick={() => setMoCong((v) => !v)} aria-label="Đính kèm"
          className={`tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-2xl font-light transition ${moCong ? 'rotate-45 bg-gray-200 text-gray-700' : 'text-gray-600'}`}>
          +
        </button>
        <textarea
          value={nhap}
          onChange={(e) => setNhap(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), gui())}
          rows={1}
          placeholder="Hỏi Maika: khách cần tài liệu gì?"
          className="max-h-28 min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-gray-400"
        />
        <button onClick={gui} disabled={!nhap.trim()} aria-label="Gửi cho Maika"
          className="tap flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white disabled:bg-gray-200 disabled:text-gray-400">
          ↑
        </button>
      </div>
    </div>
  )

  return (
    <ScreenShell title="Gửi tài liệu cho khách" onClose={onClose} footer={footer}>
      <div ref={cuon} className="scroll-mb-4 space-y-4">
        {tinNhan.map((m, i) =>
          m.tu === 'user' ? (
            <div key={i} className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2 text-sm text-white">{m.text}</div>
            </div>
          ) : (
            <BongMaika key={i} m={m} dinhKem={dinhKem} onChon={chonThe} />
          ),
        )}
      </div>
      {moGui && (
        <BangGui
          the={theChon}
          tep={tep}
          onDong={() => setMoGui(false)}
          onXong={() => {
            setMoGui(false)
            onClose()
          }}
        />
      )}
    </ScreenShell>
  )
}
