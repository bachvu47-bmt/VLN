import { useEffect, useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { MAIKA, MAIKA_GOI_Y, maikaChao } from '../services/maika'
import { maikaChatAI, maikaCheDo } from '../services/maikaAI'
import { adminSuaSai, deXuatSuaSai } from '../services/vectorStore'

let _mid = 0

const NHAN_NGUON = { sua_sai: 'Đính chính', tai_lieu: 'Tài liệu', web: 'Website' }

// HITL: Admin sửa sai → Maika học ngay; nhân viên báo sai → chờ Admin duyệt
function SuaSai({ cauHoi, traLoiSai, onXong }) {
  const { user, laAdmin } = useAuth()
  const toast = useToast()
  const [mo, setMo] = useState(false)
  const [dung, setDung] = useState('')
  const [dangLuu, setDangLuu] = useState(false)

  const luu = async () => {
    if (!dung.trim() || dangLuu) return
    setDangLuu(true)
    const thamSo = { cauHoi, traLoiSai, traLoiDung: dung.trim(), nguoi: user.hoTen }
    try {
      if (laAdmin) {
        const kq = await adminSuaSai(thamSo)
        toast(kq.daHoc ? 'Maika đã học đính chính này ✓' : 'Đã lưu — Maika sẽ học khi có mạng', 'success')
      } else {
        await deXuatSuaSai(thamSo)
        toast('Đã gửi đề xuất đính chính cho Admin duyệt', 'success')
      }
      setMo(false)
      onXong()
    } catch (e) {
      toast('Lưu lỗi: ' + (e.message || e), 'error')
    } finally {
      setDangLuu(false)
    }
  }

  if (!mo) {
    return (
      <button onClick={() => setMo(true)} className="tap mt-1 text-[11px] font-semibold text-gray-400 hover:text-brand-600">
        {laAdmin ? '✏️ Sửa sai để Maika học' : '👎 Báo Maika trả lời sai'}
      </button>
    )
  }
  return (
    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
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

function MaikaAvatar({ className = 'h-8 w-8 text-xs' }) {
  return (
    <span className={`flex flex-shrink-0 items-center justify-center rounded-full bg-brand-600 font-black text-white ${className}`}>M</span>
  )
}

function SPCard({ sp }) {
  return (
    <div className="mt-2 flex items-center gap-2 rounded-xl border border-gray-100 bg-white p-2">
      <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${sp.anhBg} text-xl`}>{sp.icon}</span>
      <div className="min-w-0">
        <div className="truncate text-xs font-bold text-gray-900">{sp.ten} <span className="font-normal text-gray-400">· {sp.hang}</span></div>
        <div className="truncate text-[11px] text-gray-500">{sp.tenNgan}</div>
      </div>
    </div>
  )
}

export default function TuVanAIScreen({ onClose, onMo }) {
  const [tin, setTin] = useState('')
  const [dangGo, setDangGo] = useState(false)
  const [msgs, setMsgs] = useState([{ id: ++_mid, tu: 'maika', text: maikaChao(), goiY: MAIKA_GOI_Y }])
  const cuoiRef = useRef(null)

  useEffect(() => {
    cuoiRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, dangGo])

  const gui = (text) => {
    const noiDung = (text ?? tin).trim()
    if (!noiDung) return
    const newMsgs = [...msgs, { id: ++_mid, tu: 'user', text: noiDung }]
    setMsgs(newMsgs)
    setTin('')
    setDangGo(true)
    maikaChatAI(newMsgs).then((tl) => {
      setMsgs((m) => [...m, { id: ++_mid, tu: 'maika', ...tl }])
      setDangGo(false)
    })
  }

  const chipCuoi = (() => {
    const last = msgs[msgs.length - 1]
    return last?.tu === 'maika' && last.goiY ? last.goiY : null
  })()

  const footer = (
    <div className="flex items-center gap-2">
      <input
        value={tin}
        onChange={(e) => setTin(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && gui()}
        placeholder="Nhập tin nhắn cho Maika..."
        className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:bg-white"
      />
      <button onClick={() => gui()} className="tap flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-white">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2 11 13 M22 2l-7 20-4-9-9-4 20-7Z" /></svg>
      </button>
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
        {msgs.map((m, idx) =>
          m.tu === 'user' ? (
            <div key={m.id} className="flex justify-end">
              <div className="anim-sheet max-w-[80%] whitespace-pre-line rounded-2xl rounded-tr-sm bg-brand-600 px-3.5 py-2.5 text-sm text-white">{m.text}</div>
            </div>
          ) : (
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
                </div>
                {m.thamKhao?.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {m.thamKhao.slice(0, 4).map((t) => (
                      <span key={t.id} title={t.tieuDe}
                        className={`max-w-[180px] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.loai === 'sua_sai' ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-500'}`}>
                        📚 {NHAN_NGUON[t.loai]}: {t.tieuDe}
                      </span>
                    ))}
                  </div>
                )}
                {idx > 0 && !m.loi && !m.daSua && msgs[idx - 1]?.tu === 'user' && (
                  <SuaSai cauHoi={msgs[idx - 1].text} traLoiSai={m.text}
                    onXong={() => setMsgs((ds) => ds.map((x) => (x.id === m.id ? { ...x, daSua: true } : x)))} />
                )}
                {m.daSua && <div className="mt-1 text-[11px] font-semibold text-green-600">✓ Đã ghi nhận đính chính</div>}
              </div>
            </div>
          ),
        )}

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
