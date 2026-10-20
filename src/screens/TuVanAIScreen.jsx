import { useEffect, useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useGhiAm } from '../hooks/useGhiAm'
import { blobSangBase64, capNhatMedia, chepFileVaoBoNho, luuMedia, thuNhoAnh } from '../data/mediaStore'
import { MAIKA, MAIKA_GOI_Y, maikaChao } from '../services/maika'
import { maikaChatAI, maikaCheDo } from '../services/maikaAI'
import { chuyenGiongNoi } from '../services/maikaChatbot'
import { adminSuaSai, deXuatSuaSai, deXuatTriThucMedia } from '../services/vectorStore'
import { huyNhac, laCauTaoViec, tachViecTuCau, taoViec } from '../services/troLyChuDong'
import { nhanThoiGian, xoaViec } from '../data/viecStore'
import { coNguonBaoCao, hoiBaoCao, laCauBaoCao } from '../services/baoCaoSheets'
import BieuDo from '../components/BieuDo'

let _mid = 0

function Ico({ d, className = 'h-5 w-5' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d={d} />
    </svg>
  )
}
const ICO = {
  camera: 'M4 8h3l2-3h6l2 3h3v11H4z M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z',
  anh: 'M4 5h16v14H4z M8.5 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z M4 17l5-5 4 4 3-3 4 4',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z M5 11a7 7 0 0 0 14 0 M12 18v3',
  gui: 'M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z',
}

// HITL: Admin sửa sai → Maika học ngay; nhân viên báo sai → chờ Admin duyệt.
// Câu hỏi có ảnh/âm thoại → media đi kèm đề xuất (thẻ tri thức Multimodal).
function SuaSai({ cauHoi, traLoiSai, media, sku, onXong }) {
  const { user, laAdmin } = useAuth()
  const toast = useToast()
  const [mo, setMo] = useState(false)
  const [dung, setDung] = useState('')
  const [dangLuu, setDangLuu] = useState(false)

  const luu = async () => {
    if (!dung.trim() || dangLuu) return
    setDangLuu(true)
    const thamSo = { cauHoi, traLoiSai, traLoiDung: dung.trim(), nguoi: user.hoTen, media, sku }
    try {
      if (laAdmin) {
        const kq = await adminSuaSai(thamSo)
        toast(kq.daHoc ? 'Maika đã học đính chính này ✓' : 'Đã lưu — Maika sẽ học khi có mạng', 'success')
      } else {
        await deXuatSuaSai(thamSo)
        toast('Đã gửi đề xuất đính chính cho Admin duyệt', 'success')
      }
      setMo(false)
      onXong('sua')
    } catch (e) {
      toast('Lưu lỗi: ' + (e.message || e), 'error')
    } finally {
      setDangLuu(false)
    }
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="tap text-[11px] font-semibold text-gray-400 hover:text-brand-600">
        {laAdmin ? '✏️ Sửa sai để Maika học' : '👎 Báo Maika trả lời sai'}
      </button>
    )
  }
  return (
    <div className="mt-2 w-full rounded-xl border border-amber-200 bg-amber-50 p-2.5">
      <div className="mb-1 text-[11px] font-bold text-amber-800">
        {laAdmin ? 'Câu trả lời ĐÚNG (Maika sẽ học ngay):' : 'Câu trả lời đúng theo bạn (gửi Admin duyệt):'}
      </div>
      <textarea value={dung} onChange={(e) => setDung(e.target.value)} rows={3} autoFocus
        placeholder="vd: Không thi công PU khi độ ẩm sàn > 8%; phải dùng lót kháng ẩm..."
        className="w-full resize-none rounded-lg border border-amber-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-brand-500" />
      <div className="mt-1.5 flex gap-2">
        <button onClick={() => setMo(false)} className="tap rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600">Huỷ</button>
        <button onClick={luu} disabled={!dung.trim() || dangLuu} className="tap flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-bold text-white disabled:opacity-50">
          {dangLuu ? 'Đang lưu…' : laAdmin ? 'Lưu & dạy Maika' : 'Gửi đề xuất'}
        </button>
      </div>
    </div>
  )
}

// Câu hỏi có ảnh/âm thoại + Maika trả lời tốt → đề xuất thành tri thức (Admin duyệt ở AI Admin)
function DeXuatMedia({ cauHoi, traLoi, media, sku, onXong }) {
  const { user } = useAuth()
  const toast = useToast()
  const [dang, setDang] = useState(false)
  const gui = async () => {
    setDang(true)
    try {
      await deXuatTriThucMedia({ cauHoi, traLoi, media, sku, nguoi: user.hoTen })
      toast('Đã gửi thẻ tri thức (kèm media) vào hàng chờ duyệt', 'success')
      onXong('dexuat')
    } catch (e) {
      toast('Lỗi: ' + (e.message || e), 'error')
      setDang(false)
    }
  }
  return (
    <button onClick={gui} disabled={dang} className="tap text-[11px] font-semibold text-gray-400 hover:text-brand-600 disabled:opacity-50">
      💡 Lưu thành tri thức
    </button>
  )
}

function MaikaAvatar({ className = 'h-8 w-8 text-xs' }) {
  return (
    <span className={`flex flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-black text-white ${className}`}>M</span>
  )
}

function SPCard({ sp }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2">
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg ${sp.anhBg} text-xl`}>
        {sp.anh ? <img src={sp.anh} alt="" className="h-full w-full object-contain" /> : sp.icon}
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-gray-900">{sp.ten} <span className="font-normal text-gray-400">· {sp.hang}</span></div>
        <div className="truncate text-[11px] text-gray-500">{sp.tenNgan}</div>
      </div>
    </div>
  )
}

// Tài liệu chỉ hiện khi người dùng xin ("cung cấp tài liệu chi tiết", "cho link TDS"...)
function TaiLieu({ ds }) {
  if (!ds?.length) return null
  return (
    <div className="mt-2 space-y-1 rounded-xl border border-gray-100 bg-white p-2">
      <div className="text-[11px] font-bold text-gray-700">Tài liệu</div>
      {ds.map((t) => (
        <a key={t.url} href={t.url} target="_blank" rel="noreferrer" className="block truncate text-xs font-semibold text-brand-700 underline">
          {t.ten}
        </a>
      ))}
    </div>
  )
}

export default function TuVanAIScreen({ onClose, onMo }) {
  const { user, laAdmin } = useAuth()
  const toast = useToast()
  const [tin, setTin] = useState('')
  const [dangGo, setDangGo] = useState(false)
  const [anhCho, setAnhCho] = useState(null) // { file, url } ảnh đã chọn, chờ gửi
  const [msgs, setMsgs] = useState([{ id: ++_mid, tu: 'maika', text: maikaChao(), goiY: MAIKA_GOI_Y }])
  const cuoiRef = useRef(null)
  const camRef = useRef(null)
  const thuVienRef = useRef(null)
  const keoRef = useRef({ y0: 0, huy: false })
  const ghiAm = useGhiAm()
  const [keoHuy, setKeoHuy] = useState(false)
  const msgsRef = useRef(msgs) // bản mới nhất cho các xử lý bất đồng bộ (ghi âm)

  useEffect(() => {
    msgsRef.current = msgs
    cuoiRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, dangGo])

  const capNhatTin = (id, thayDoi) => setMsgs((ds) => ds.map((x) => (x.id === id ? { ...x, ...thayDoi } : x)))

  // Gửi lịch sử cho Maika — chỉ tin nhắn cuối mang dữ liệu ảnh, ảnh cũ bỏ base64 cho đỡ tốn quota
  const hoiMaika = async (lichSu, tinHoi) => {
    setDangGo(true)
    // "Nhắc tôi gọi chị Mai 10h mai" (gõ hoặc nói) → trợ lý chủ động lên lịch nhắc
    if (!tinHoi.anh && laCauTaoViec(tinHoi.text)) {
      try {
        const v = await taoViec(await tachViecTuCau(tinHoi.text, user.id))
        setMsgs((m) => [...m, { id: ++_mid, tu: 'maika', viecMoi: v, text: `✅ Đã lên lịch nhắc: ${v.tieuDe}\n⏰ ${nhanThoiGian(v.hanLuc)}${v.khach ? `\n👤 ${v.khach}` : ''}\nMaika sẽ báo bạn đúng giờ — xem ở màn Hôm nay.` }])
        setDangGo(false)
        return
      } catch {
        /* không tách được việc → trả lời như câu hỏi thường */
      }
    }
    // Admin hỏi số liệu bán hàng ("doanh thu tháng này?") → đọc Google Sheet báo cáo, trả số + biểu đồ
    if (laAdmin && !tinHoi.anh && coNguonBaoCao() && laCauBaoCao(tinHoi.text)) {
      try {
        const kq = await hoiBaoCao(tinHoi.text)
        setMsgs((m) => [...m, { id: ++_mid, tu: 'maika', text: kq.text, bieuDo: kq.bieuDo }])
        setDangGo(false)
        return
      } catch {
        /* lỗi đọc sheet → trả lời như câu hỏi thường */
      }
    }
    const gon = lichSu.map((m) => (m.id === tinHoi.id ? m : { ...m, anh: undefined }))
    const tl = await maikaChatAI(gon)
    setDangGo(false)
    setMsgs((m) => [...m, { id: ++_mid, tu: 'maika', ...tl }])
    // Gán SKU sản phẩm Maika nhận ra cho ảnh/âm thoại vừa gửi
    if (tl.sp?.ma && tinHoi.media?.length) {
      tinHoi.media.forEach((md) => capNhatMedia(md.id, { sku: tl.sp.ma }))
      capNhatTin(tinHoi.id, { sku: tl.sp.ma })
    }
  }

  const gui = async (text) => {
    const noiDung = (text ?? tin).trim()
    if ((!noiDung && !anhCho) || dangGo) return
    const tinMoi = { id: ++_mid, tu: 'user', text: noiDung }
    if (anhCho) {
      let blob
      try {
        blob = await thuNhoAnh(anhCho.file)
        Object.assign(tinMoi, {
          anh: { mime: blob.type || 'image/jpeg', base64: await blobSangBase64(blob) },
          coAnh: true,
          anhUrl: anhCho.url,
        })
      } catch (e) {
        return toast('Không đọc được ảnh: ' + (e.message || e), 'error')
      }
      // Lưu kho media chỉ để làm thẻ tri thức — lỗi ghi IndexedDB KHÔNG được chặn việc hỏi Maika
      try {
        const md = await luuMedia(blob, { loai: 'anh', nguoi: user.hoTen })
        tinMoi.media = [{ id: md.id, loai: 'anh' }]
      } catch (e) {
        console.warn('[Maika] Không lưu được ảnh vào máy:', e.message)
      }
    }
    const lichSu = [...msgs, tinMoi]
    setMsgs(lichSu)
    setTin('')
    setAnhCho(null)
    hoiMaika(lichSu, tinMoi)
  }

  const chonAnh = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // Một số trình chọn ảnh Android trả type rỗng → nhận theo đuôi tệp
    // HEIC (iPhone/một số máy Samsung): WebView/Electron không hiển thị & không thu nhỏ được → báo rõ
    if (/heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)) return toast('Ảnh HEIC chưa hỗ trợ — chụp lại bằng camera trong app hoặc chọn ảnh JPG/PNG', 'error')
    if (!f.type.startsWith('image/') && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)) return toast('Chỉ hỗ trợ tệp ảnh', 'error')
    try {
      const file = await chepFileVaoBoNho(f) // đọc ngay khi còn quyền truy cập tệp
      setAnhCho({ file, url: URL.createObjectURL(file) })
    } catch (err) {
      toast(`Không có quyền đọc ảnh (${err.name || err.message}). Thử chọn lại ảnh, hoặc cấp quyền Ảnh/Bộ nhớ cho app trong Cài đặt.`, 'error')
    }
  }

  // ---- Giữ để nói ----
  const guiGhiAm = async (huy) => {
    const blob = await ghiAm.ketThuc(huy)
    setKeoHuy(false)
    if (!blob) return huy || toast('Giữ nút micro lâu hơn để ghi âm', 'info')
    const url = URL.createObjectURL(blob)
    const tinMoi = { id: ++_mid, tu: 'user', text: '', amThanhUrl: url, dangChep: true }
    setMsgs((ds) => [...ds, tinMoi])
    try {
      const banGhi = await chuyenGiongNoi(blob)
      const md = await luuMedia(blob, { loai: 'am_thanh', nguoi: user.hoTen, banGhi }).catch((e) => console.warn('[Maika] Không lưu được ghi âm:', e.message))
      const xong = { ...tinMoi, text: banGhi, dangChep: false, media: md ? [{ id: md.id, loai: 'am_thanh' }] : [] }
      const lichSu = msgsRef.current.map((x) => (x.id === tinMoi.id ? xong : x))
      setMsgs(lichSu)
      hoiMaika(lichSu, xong)
    } catch (e) {
      capNhatTin(tinMoi.id, { dangChep: false, loiChep: true, text: 'Không nhận dạng được giọng nói: ' + (e.message || e) })
    }
  }
  useEffect(() => {
    ghiAm.khiHetGio(() => guiGhiAm(false)) // quá 60s → tự gửi
  })

  const nhanMic = async (e) => {
    e.currentTarget.setPointerCapture?.(e.pointerId)
    keoRef.current = { y0: e.clientY, huy: false }
    try {
      await ghiAm.batDau()
    } catch (err) {
      toast(err.name === 'NotAllowedError' ? 'Chưa cấp quyền micro cho ứng dụng' : 'Không bật được micro: ' + (err.message || err), 'error')
    }
  }
  const diMic = (e) => {
    if (!ghiAm.dangGhi) return
    const huy = keoRef.current.y0 - e.clientY > 60 // kéo lên 60px → huỷ
    keoRef.current.huy = huy
    setKeoHuy(huy)
  }
  const thaMic = () => ghiAm.dangGhi && guiGhiAm(keoRef.current.huy)

  const chipCuoi = (() => {
    const last = msgs[msgs.length - 1]
    return last?.tu === 'maika' && last.goiY ? last.goiY : null
  })()

  const coChu = tin.trim().length > 0 || anhCho
  const footer = (
    <div>
      {anhCho && (
        <div className="mb-2 flex items-center gap-2">
          <img src={anhCho.url} alt="" className="h-14 w-14 rounded-lg border border-gray-200 object-cover" />
          <span className="flex-1 text-[11px] text-gray-500">Ảnh sẽ gửi kèm — nhập câu hỏi (vd: "Phân tích vết nứt này") hoặc bấm gửi.</span>
          <button onClick={() => setAnhCho(null)} className="tap h-7 w-7 rounded-full bg-gray-100 text-sm text-gray-500">✕</button>
        </div>
      )}
      {ghiAm.dangGhi ? (
        <div className={`mb-2 rounded-xl px-3 py-2 text-center text-xs font-bold ${keoHuy ? 'bg-gray-200 text-gray-600' : 'bg-red-50 text-red-600'}`}>
          {keoHuy ? '✋ Thả tay để HUỶ ghi âm' : `🔴 Đang ghi âm 0:${String(ghiAm.giay).padStart(2, '0')} — thả tay để gửi, kéo lên để huỷ`}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={chonAnh} />
        <input ref={thuVienRef} type="file" accept="image/*" className="hidden" onChange={chonAnh} />
        <button onClick={() => camRef.current?.click()} title="Chụp ảnh" className="tap flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:text-brand-600">
          <Ico d={ICO.camera} />
        </button>
        <button onClick={() => thuVienRef.current?.click()} title="Chọn ảnh" className="tap flex h-10 w-9 flex-shrink-0 items-center justify-center rounded-full text-gray-500 hover:text-brand-600">
          <Ico d={ICO.anh} />
        </button>
        <input
          value={tin}
          onChange={(e) => setTin(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && gui()}
          placeholder={anhCho ? 'Hỏi về ảnh này...' : 'Nhập tin nhắn cho Maika...'}
          className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
        {coChu ? (
          <button onClick={() => gui()} className="tap flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-brand-600 text-white">
            <Ico d={ICO.gui} />
          </button>
        ) : (
          <button
            onPointerDown={nhanMic}
            onPointerMove={diMic}
            onPointerUp={thaMic}
            onPointerCancel={() => ghiAm.dangGhi && guiGhiAm(true)}
            onContextMenu={(e) => e.preventDefault()}
            title="Giữ để nói"
            style={{ touchAction: 'none' }}
            className={`flex h-10 w-10 flex-shrink-0 select-none items-center justify-center rounded-full text-white transition ${ghiAm.dangGhi ? 'scale-125 bg-red-600' : 'bg-brand-600'}`}
          >
            <Ico d={ICO.mic} />
          </button>
        )}
      </div>
    </div>
  )

  const online = maikaCheDo() !== 'offline'
  const right = (
    <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${online ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${online ? 'bg-green-500' : 'bg-gray-400'}`} /> {online ? 'AI trực tuyến' : 'Ngoại tuyến'}
    </span>
  )

  return (
    <ScreenShell title={`${MAIKA.ten} · ${MAIKA.vaiTro}`} onClose={onClose} right={right} footer={footer}>
      <div className="space-y-3">
        {msgs.map((m, idx) => {
          if (m.tu === 'user') {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="anim-sheet max-w-[80%] space-y-1.5 rounded-2xl rounded-tr-sm bg-brand-600 px-3 py-2.5 text-sm text-white">
                  {m.anhUrl && <img src={m.anhUrl} alt="Ảnh gửi Maika" className="max-h-60 rounded-xl object-contain" />}
                  {m.amThanhUrl && <audio src={m.amThanhUrl} controls className="h-9 w-56 max-w-full" />}
                  {m.dangChep && <div className="animate-pulse text-xs text-brand-100">🎙️ Đang chuyển giọng nói thành chữ…</div>}
                  {m.text && <div className={`whitespace-pre-line ${m.amThanhUrl ? 'text-xs italic text-brand-50' : ''}`}>{m.amThanhUrl && !m.loiChep ? `“${m.text}”` : m.text}</div>}
                  {m.sku && <div className="text-[10px] text-brand-100">SKU: {m.sku}</div>}
                </div>
              </div>
            )
          }
          const hoi = idx > 0 && msgs[idx - 1]?.tu === 'user' ? msgs[idx - 1] : null
          const cauHoi = hoi ? hoi.text || (hoi.anhUrl ? '(ảnh gửi kèm)' : '') : ''
          return (
            <div key={m.id} className="flex gap-2">
              <MaikaAvatar />
              <div className="max-w-[82%]">
                <div className="anim-sheet whitespace-pre-line rounded-2xl rounded-tl-sm border border-brand-100 bg-brand-50 px-3.5 py-2.5 text-sm text-gray-800">
                  {m.text}
                  {m.sp && <SPCard sp={m.sp} />}
                  {m.calc && m.sp && (
                    <button onClick={() => onMo && onMo('tinhvattu', m.sp)} className="tap mt-2 w-full rounded-lg bg-brand-600 py-2 text-xs font-bold text-white">
                      🧮 Mở Tính vật tư cho {m.sp.ten}
                    </button>
                  )}
                  <TaiLieu ds={m.taiLieu} />
                  {m.bieuDo && <div className="mt-2 whitespace-normal"><BieuDo {...m.bieuDo} /></div>}
                  {m.viecMoi && !m.daHuyViec && (
                    <button onClick={() => huyNhac(m.viecMoi).then(() => xoaViec(m.viecMoi.id)).then(() => capNhatTin(m.id, { daHuyViec: true, text: 'Đã huỷ lịch nhắc.' }))}
                      className="tap mt-2 block text-[11px] font-semibold text-gray-500 underline">Huỷ nhắc này</button>
                  )}
                </div>
                {hoi && !m.loi && !m.daXuLy && !m.viecMoi && !m.bieuDo && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3">
                    <SuaSai cauHoi={cauHoi} traLoiSai={m.text} media={hoi.media || []} sku={hoi.sku || ''}
                      onXong={(loai) => capNhatTin(m.id, { daXuLy: loai })} />
                    {hoi.media?.length > 0 && (
                      <DeXuatMedia cauHoi={cauHoi} traLoi={m.text} media={hoi.media} sku={hoi.sku || ''}
                        onXong={(loai) => capNhatTin(m.id, { daXuLy: loai })} />
                    )}
                  </div>
                )}
                {m.daXuLy === 'sua' && <div className="mt-1 text-[11px] font-semibold text-green-600">✓ Đã ghi nhận đính chính</div>}
                {m.daXuLy === 'dexuat' && <div className="mt-1 text-[11px] font-semibold text-green-600">✓ Đã gửi thẻ tri thức chờ duyệt</div>}
              </div>
            </div>
          )
        })}

        {dangGo && (
          <div className="flex gap-2">
            <MaikaAvatar />
            <div className="rounded-2xl rounded-tl-sm border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-gray-400">
              <span className="animate-pulse">Maika đang soạn…</span>
            </div>
          </div>
        )}

        {/* Gợi ý nhanh */}
        {chipCuoi && !dangGo && (
          <div className="flex flex-wrap gap-2 pl-10">
            {chipCuoi.map((g) => (
              <button key={g} onClick={() => gui(g)} className="tap rounded-full border border-brand-200 bg-white px-3 py-1.5 text-xs font-semibold text-brand-700">
                {g}
              </button>
            ))}
          </div>
        )}
        <div ref={cuoiRef} />
      </div>
    </ScreenShell>
  )
}
