import { useRef, useState } from 'react'
import ScreenShell from '../components/ScreenShell'
import { maikaPhanLoai } from '../services/maika'
import { useToast } from '../context/ToastContext'

const LOAI = [
  { id: 'anh', nhan: 'Tải ảnh', meta: 'JPG, PNG', icon: '🖼️', accept: 'image/*' },
  { id: 'video', nhan: 'Tải video', meta: 'MP4, MOV', icon: '🎬', accept: 'video/*' },
  { id: 'pdf', nhan: 'Tải PDF', meta: 'PDF', icon: '📄', accept: 'application/pdf' },
  { id: 'audio', nhan: 'Ghi âm', meta: '5s – 5 phút', icon: '🎙️', accept: 'audio/*' },
]

export default function IngestionScreen({ onClose }) {
  const [loai, setLoai] = useState('pdf')
  const [file, setFile] = useState(null)
  const [noiDung, setNoiDung] = useState('Điều kiện thi công PU: bề mặt khô ráo, sạch bụi, không đọng nước. Độ ẩm bề mặt < 8%. Nhiệt độ thi công 8–35°C. Tránh thi công khi trời sắp mưa.')
  const [tt, setTt] = useState('idle') // idle | analyzing | done
  const [kq, setKq] = useState(null)
  const inputRef = useRef(null)
  const toast = useToast()

  const chonFile = (e) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const chay = () => {
    setTt('analyzing')
    setKq(null)
    setTimeout(() => {
      setKq(maikaPhanLoai(noiDung, file?.name))
      setTt('done')
    }, 1600)
  }

  const loaiHt = LOAI.find((l) => l.id === loai)

  return (
    <ScreenShell title="Cổng update AI" onClose={onClose}>
      <h2 className="text-2xl font-black text-gray-900">Hôm nay cần cập nhật kiến thức gì?</h2>
      <p className="mb-4 mt-1 text-sm text-gray-500">Tải lên tài liệu, hình ảnh, video hoặc ghi âm để Maika phân tích và định tuyến vào kho kiến thức nội bộ.</p>

      {/* Loại dữ liệu */}
      <div className="mb-4 grid grid-cols-4 gap-2">
        {LOAI.map((l) => (
          <button key={l.id} onClick={() => setLoai(l.id)}
            className={`tap flex flex-col items-center gap-1 rounded-xl border py-3 text-center transition ${loai === l.id ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-100 bg-gray-50 text-gray-500'}`}>
            <span className="text-xl">{l.icon}</span>
            <span className="text-[11px] font-bold">{l.nhan}</span>
            <span className="text-[9px] text-gray-400">{l.meta}</span>
          </button>
        ))}
      </div>

      {/* Nội dung */}
      <textarea value={noiDung} onChange={(e) => setNoiDung(e.target.value)} rows={4}
        className="mb-3 w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-3 text-sm outline-none focus:border-brand-500 focus:bg-white" />

      {/* File */}
      <label className="mb-4 flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-brand-300 px-4 py-3 transition hover:bg-brand-50">
        <input ref={inputRef} type="file" accept={loaiHt.accept} className="hidden" onChange={chonFile} />
        <span className="text-2xl">{loaiHt.icon}</span>
        {file ? (
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-gray-800">{file.name}</div>
            <div className="text-[11px] text-gray-400">{(file.size / 1024 / 1024).toFixed(1)} MB</div>
          </div>
        ) : (
          <span className="text-sm font-semibold text-gray-500">Chạm để tải {loaiHt.nhan.toLowerCase()}</span>
        )}
      </label>

      <button onClick={chay} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white hover:bg-brand-700">
        {tt === 'analyzing' ? '⏳ Đang phân tích...' : '✨ Phân tích nội dung'}
      </button>

      {/* Kết quả */}
      {tt === 'done' && kq && (
        <div className="mt-4 rounded-2xl border border-brand-200 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm font-bold text-gray-900"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-[10px] font-black text-white">M</span> Maika đề xuất phân loại</span>
            <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-bold text-green-700">Độ tin cậy {kq.doTinCay}%</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            {kq.tags.map((t) => (
              <span key={t} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">{t}</span>
            ))}
          </div>
          <div className="mb-3 flex items-center gap-3 rounded-xl bg-gray-50 p-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${kq.sp.anhBg} text-xl`}>{kq.sp.icon}</span>
            <div>
              <div className="text-[10px] font-mono text-gray-400">{kq.sp.ma}</div>
              <div className="text-sm font-bold text-gray-900">{kq.sp.ten}</div>
            </div>
          </div>
          <button onClick={() => { toast(`Đã lưu vào mã ${kq.sp.ma}`, 'success'); onClose() }}
            className="tap w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white">✓ Duyệt & Lưu vào {kq.sp.ma}</button>
        </div>
      )}
    </ScreenShell>
  )
}
