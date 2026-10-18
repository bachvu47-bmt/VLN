import { useEffect, useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { MAIKA, MAIKA_GOI_Y, maikaChao, maikaTraLoi } from '../services/maika'

let _mid = 0

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
    setMsgs((m) => [...m, { id: ++_mid, tu: 'user', text: noiDung }])
    setTin('')
    setDangGo(true)
    setTimeout(() => {
      const tl = maikaTraLoi(noiDung)
      setMsgs((m) => [...m, { id: ++_mid, tu: 'maika', ...tl }])
      setDangGo(false)
    }, 650)
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

  const right = (
    <span className="flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-600">
      <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Trực tuyến
    </span>
  )

  return (
    <ScreenShell title={`${MAIKA.ten} · ${MAIKA.vaiTro}`} onClose={onClose} right={right} footer={footer}>
      <div className="space-y-3">
        {msgs.map((m) =>
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
